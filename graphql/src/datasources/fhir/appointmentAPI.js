// graphql/src/datasources/fhir/HCHBAppointmentAPI.js
const { RESTDataSource } = require("apollo-datasource-rest");
const { getToken } = require("./service");

class appointmentAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = process.env.API_BASE_URL || "https://api.hchb.com/fhir/r4";
    this.token = null;
    this.tokenExpiry = null;
  }

  willSendRequest(request) {
    request.headers.set("Accept", "application/fhir+json");
    request.headers.set("Content-Type", "application/fhir+json");
  }

  async getAuthToken() {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    console.log("[HCHBAppointmentAPI] Getting new auth token...");
    this.token = await getToken();
    this.tokenExpiry = new Date(Date.now() + 3600 * 1000);
    return this.token;
  }

  async getAppointments(filters = {}) {
    try {
      const token = await this.getAuthToken();

      console.log(
        "[HCHBAppointmentAPI] Fetching appointments with filters:",
        filters
      );

      const appointments = [];
      let nextUrl = `${this.baseURL}/Appointment`;

      // Build FHIR search parameters
      const params = {
        _count: 50,
        _sort: "date",
      };

      // Date filter
      if (filters.date) {
        const date = new Date(filters.date);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        params.date = [
          `ge${date.toISOString().split("T")[0]}`,
          `lt${nextDay.toISOString().split("T")[0]}`,
        ];
      }

      // Nurse filter (Practitioner in FHIR)
      if (filters.nurseId) {
        params.actor = `Practitioner/${filters.nurseId}`;
      }

      // Patient filter
      if (filters.patientId) {
        // If we already have actor set for nurse, we need to handle multiple actors
        if (params.actor) {
          params.actor = [params.actor, `Patient/${filters.patientId}`];
        } else {
          params.actor = `Patient/${filters.patientId}`;
        }
      }

      while (nextUrl && appointments.length < 500) {
        // Limit for safety
        const response = await this.get(
          nextUrl === `${this.baseURL}/Appointment` ? "Appointment" : nextUrl,
          nextUrl === `${this.baseURL}/Appointment` ? params : undefined,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.entry && response.entry.length > 0) {
          const batchAppointments = response.entry.map((entry) =>
            this.transformToAppointment(entry.resource)
          );

          appointments.push(...batchAppointments);
          console.log(
            `[HCHBAppointmentAPI] Fetched ${batchAppointments.length} appointments (total: ${appointments.length})`
          );
        }

        // Find next page URL
        nextUrl = null;
        if (response.link) {
          const nextLink = response.link.find(
            (link) => link.relation === "next"
          );
          if (nextLink) {
            nextUrl = nextLink.url;
          }
        }
      }

      console.log(
        `[HCHBAppointmentAPI] Successfully fetched ${appointments.length} appointments total`
      );
      return appointments;
    } catch (error) {
      console.error("[HCHBAppointmentAPI] Error fetching appointments:", error);
      throw error;
    }
  }

  async getAppointmentById(id) {
    try {
      const token = await this.getAuthToken();

      console.log(`[HCHBAppointmentAPI] Fetching appointment with ID: ${id}`);

      const response = await this.get(`Appointment/${id}`, undefined, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return this.transformToAppointment(response);
    } catch (error) {
      console.error(
        `[HCHBAppointmentAPI] Error fetching appointment ${id}:`,
        error
      );
      throw error;
    }
  }

  async createAppointment(input) {
    try {
      const token = await this.getAuthToken();

      console.log("[HCHBAppointmentAPI] Creating new appointment");

      // Convert GraphQL input to FHIR Appointment
      const fhirAppointment = this.createFhirAppointment(input);

      const response = await this.post("Appointment", fhirAppointment, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return this.transformToAppointment(response);
    } catch (error) {
      console.error("[HCHBAppointmentAPI] Error creating appointment:", error);
      throw error;
    }
  }

  async updateAppointment(id, input) {
    try {
      const token = await this.getAuthToken();

      console.log(`[HCHBAppointmentAPI] Updating appointment ${id}`);

      // First get the current appointment
      const currentAppointment = await this.get(
        `Appointment/${id}`,
        undefined,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Merge with updates
      const updatedFhirAppointment = {
        ...currentAppointment,
        ...this.createFhirAppointment(input),
        id: id, // Preserve the ID
      };

      const response = await this.put(
        `Appointment/${id}`,
        updatedFhirAppointment,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return this.transformToAppointment(response);
    } catch (error) {
      console.error(
        `[HCHBAppointmentAPI] Error updating appointment ${id}:`,
        error
      );
      throw error;
    }
  }

  async cancelAppointment(id, reason) {
    try {
      const token = await this.getAuthToken();

      console.log(`[HCHBAppointmentAPI] Cancelling appointment ${id}`);

      // Get the current appointment
      const currentAppointment = await this.get(
        `Appointment/${id}`,
        undefined,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update status to cancelled
      const cancelledAppointment = {
        ...currentAppointment,
        status: "cancelled",
        cancelationReason: {
          text: reason || "Cancelled through scheduling system",
        },
      };

      const response = await this.put(
        `Appointment/${id}`,
        cancelledAppointment,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return this.transformToAppointment(response);
    } catch (error) {
      console.error(
        `[HCHBAppointmentAPI] Error cancelling appointment ${id}:`,
        error
      );
      throw error;
    }
  }

  // Transform FHIR Appointment to our GraphQL Appointment type
  transformToAppointment(appointment) {
    if (!appointment) return null;

    // Extract date/time from HCHB extensions
    const dateTimeExt = appointment.extension?.find(
      (ext) =>
        ext.url ===
        "https://api.hchb.com/fhir/r4/StructureDefinition/appointment-date-time"
    );

    let appointmentDate = null;
    let startTime = null;
    let endTime = null;

    if (dateTimeExt?.extension) {
      const dateExt = dateTimeExt.extension.find(
        (e) => e.url === "AppointmentDate"
      );
      const startExt = dateTimeExt.extension.find(
        (e) => e.url === "AppointmentStartTime"
      );
      const endExt = dateTimeExt.extension.find(
        (e) => e.url === "AppointmentEndTime"
      );

      appointmentDate = dateExt?.valueString;

      // Extract time from the datetime strings (format: "1900-01-01T11:08:16.000+00:00")
      if (startExt?.valueString) {
        const timeMatch = startExt.valueString.match(/T(\d{2}:\d{2}:\d{2})/);
        if (timeMatch && appointmentDate) {
          startTime = `${appointmentDate}T${timeMatch[1]}Z`;
        }
      }

      if (endExt?.valueString) {
        const timeMatch = endExt.valueString.match(/T(\d{2}:\d{2}:\d{2})/);
        if (timeMatch && appointmentDate) {
          endTime = `${appointmentDate}T${timeMatch[1]}Z`;
        }
      }
    }

    // Fallback to requestedPeriod if available
    if (!startTime && appointment.requestedPeriod?.[0]) {
      startTime = appointment.requestedPeriod[0].start;
      endTime = appointment.requestedPeriod[0].end;
    }

    // Extract patient reference from extension
    const subjectExt = appointment.extension?.find(
      (ext) =>
        ext.url === "https://api.hchb.com/fhir/r4/StructureDefinition/subject"
    );
    const patientRef = subjectExt?.valueReference?.reference;
    const patientId = patientRef?.replace("Patient/", "");

    // Extract practitioner from participants
    const participants = appointment.participant || [];
    const practitionerParticipant = participants.find((p) =>
      p.actor?.reference?.startsWith("Practitioner/")
    );
    const practitionerId = practitionerParticipant?.actor?.reference?.replace(
      "Practitioner/",
      ""
    );

    // Map to our GraphQL Appointment type
    return {
      id: appointment.id,
      patientId: patientId || null,
      nurseId: practitionerId || null,
      startTime: startTime,
      endTime: endTime,
      status: this.mapFhirStatusToGraphQL(appointment.status),
      notes: appointment.comment || appointment.description || null,
      careServices: this.extractCareServices(appointment),
      location: this.extractLocation(appointment),
      // These will be resolved by field resolvers
      patient: null,
      nurse: null,
    };
  }

  mapFhirStatusToGraphQL(fhirStatus) {
    const statusMap = {
      proposed: "SCHEDULED",
      pending: "SCHEDULED",
      booked: "SCHEDULED",
      arrived: "IN_PROGRESS",
      fulfilled: "COMPLETED",
      cancelled: "CANCELLED",
      noshow: "MISSED",
      "entered-in-error": "CANCELLED",
    };

    return statusMap[fhirStatus] || "SCHEDULED";
  }

  extractCareServices(appointment) {
    const services = [];

    if (appointment.serviceType) {
      appointment.serviceType.forEach((service) => {
        if (service.text) {
          services.push(service.text);
        } else if (service.coding && service.coding.length > 0) {
          services.push(service.coding[0].display || service.coding[0].code);
        }
      });
    }

    return services.length > 0 ? services : ["General Care"];
  }

  extractLocation(appointment) {
    // Check if appointment has a location reference
    if (appointment.participant) {
      const locationParticipant = appointment.participant.find((p) =>
        p.actor?.reference?.startsWith("Location/")
      );

      if (locationParticipant) {
        // Would need to fetch the Location resource
        return null; // Handle in resolver if needed
      }
    }

    // Check for location in extensions
    if (appointment.extension) {
      const locationExt = appointment.extension.find(
        (ext) => ext.url && ext.url.includes("location")
      );

      if (locationExt?.valueAddress) {
        return {
          lat: null,
          lng: null,
          address: this.formatAddress(locationExt.valueAddress),
        };
      }
    }

    return null;
  }

  formatAddress(fhirAddress) {
    const parts = [];

    if (fhirAddress.line) {
      parts.push(...fhirAddress.line);
    }

    if (fhirAddress.city) {
      parts.push(fhirAddress.city);
    }

    if (fhirAddress.state) {
      parts.push(fhirAddress.state);
    }

    if (fhirAddress.postalCode) {
      parts.push(fhirAddress.postalCode);
    }

    return parts.join(", ");
  }

  createFhirAppointment(input) {
    const fhirAppointment = {
      resourceType: "Appointment",
      status: this.mapGraphQLStatusToFhir(input.status || "SCHEDULED"),
      start: input.startTime,
      end: input.endTime,
      participant: [],
    };

    // Add patient participant
    if (input.patientId) {
      fhirAppointment.participant.push({
        actor: {
          reference: `Patient/${input.patientId}`,
        },
        status: "accepted",
      });
    }

    // Add nurse/practitioner participant
    if (input.nurseId) {
      fhirAppointment.participant.push({
        actor: {
          reference: `Practitioner/${input.nurseId}`,
        },
        status: "accepted",
      });
    }

    // Add notes
    if (input.notes) {
      fhirAppointment.comment = input.notes;
    }

    // Add service types
    if (input.careServices && input.careServices.length > 0) {
      fhirAppointment.serviceType = input.careServices.map((service) => ({
        text: service,
      }));
    }

    return fhirAppointment;
  }

  mapGraphQLStatusToFhir(graphqlStatus) {
    const statusMap = {
      SCHEDULED: "booked",
      IN_PROGRESS: "arrived",
      COMPLETED: "fulfilled",
      CANCELLED: "cancelled",
      MISSED: "noshow",
    };

    return statusMap[graphqlStatus] || "booked";
  }
}

module.exports = appointmentAPI;
