// graphql/src/datasources/fhir/appointmentAPI.js
// FIXED VERSION - JSON parsing
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

  async getToken() {
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
      const token = await this.getToken();

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
        const response = await this.get(
          nextUrl === `${this.baseURL}/Appointment` ? "Appointment" : nextUrl,
          nextUrl === `${this.baseURL}/Appointment` ? params : undefined,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // FIXED: Parse the response if it's a string
        let parsedResponse = response;
        if (typeof response === "string") {
          try {
            parsedResponse = JSON.parse(response);
          } catch (error) {
            console.error(
              "[HCHBAppointmentAPI] Failed to parse response:",
              error
            );
            throw new Error("Invalid JSON response from FHIR server");
          }
        }

        if (parsedResponse.entry && parsedResponse.entry.length > 0) {
          const batchAppointments = parsedResponse.entry.map((entry) =>
            this.transformToAppointment(entry.resource)
          );

          appointments.push(...batchAppointments);
          console.log(
            `[HCHBAppointmentAPI] Fetched ${batchAppointments.length} appointments (total: ${appointments.length})`
          );
        }

        // Find next page URL
        nextUrl = null;
        if (parsedResponse.link && Array.isArray(parsedResponse.link)) {
          const nextLink = parsedResponse.link.find(
            (link) => link.relation === "next"
          );
          if (nextLink && nextLink.url) {
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
      const token = await this.getToken();

      console.log(`[HCHBAppointmentAPI] Fetching appointment with ID: ${id}`);

      const response = await this.get(`Appointment/${id}`, undefined, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // FIXED: Parse if string
      let parsedResponse = response;
      if (typeof response === "string") {
        parsedResponse = JSON.parse(response);
      }

      return this.transformToAppointment(parsedResponse);
    } catch (error) {
      console.error(
        `[HCHBAppointmentAPI] Error fetching appointment ${id}:`,
        error
      );
      throw error;
    }
  }

  async createAppointment(input) {
    // Implementation for creating appointments
    throw new Error("Not implemented yet");
  }

  async updateAppointment(id, input) {
    // Implementation for updating appointments
    throw new Error("Not implemented yet");
  }

  async cancelAppointment(id, reason) {
    try {
      const token = await this.getToken();

      const appointment = await this.getAppointmentById(id);

      const cancelledAppointment = {
        ...appointment,
        status: "cancelled",
        cancelationReason: {
          text: reason || "Cancelled via scheduling system",
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

      // FIXED: Parse if string
      let parsedResponse = response;
      if (typeof response === "string") {
        parsedResponse = JSON.parse(response);
      }

      return this.transformToAppointment(parsedResponse);
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

    const appointmentId =
      appointment.id ||
      appointment.identifier?.[0]?.value ||
      `unknown-${Date.now()}`;

    let startTime = null;
    let endTime = null;

    if (appointment.requestedPeriod && appointment.requestedPeriod.length > 0) {
      const period = appointment.requestPeriod[0];
      startTime = period.start;
      endTime = period.end;
    }

    if (!startTime) {
      const dateTimeExt = appointment.extension?.find(
        (ext) =>
          ext.url ===
          "https://api.hchb.com/fhir/r4/StructureDefinition/appointment-date-time"
      );

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

        const appointmentDate = dateExt?.valueString;

        if (startExt?.valueString && appointmentDate) {
          const timeMatch = startExt.valueString.match(/T(\d{2}:\d{2}:\d{2})/);
          if (timeMatch) {
            startTime = `${appointmentDate}T${timeMatch[1]}.000Z`;
          }
        }

        if (endExt?.valueString && appointmentDate) {
          const timeMatch = endExt.valueString.match(/T(\d{2}:\d{2}:\d{2})/);
          if (timeMatch) {
            endTime = `${appointmentDate}T${timeMatch[1]}.000Z`;
          }
        }
      }
    }

    if (!startTime) {
      if (appointment.start) {
        startTime = appointment.start;
      }
    }

    // If still no start time, use created date as fallback
    if (!startTime && appointment.created) {
      console.warn(
        `[HCHBAppointmentAPI] No start time found for appointment ${appointmentId}, using created date`
      );
      startTime = appointment.created;
      // Add 1 hour for end time
      const start = new Date(startTime);
      endTime = new Date(start.getTime() + 3600000).toISOString();
    }

    // Extract patient reference - check extension first
    let patientId = null;
    const subjectExt = appointment.extension?.find(
      (ext) =>
        ext.url === "https://api.hchb.com/fhir/r4/StructureDefinition/subject"
    );
    if (subjectExt?.valueReference?.reference) {
      patientId = subjectExt.valueReference.reference.replace("Patient/", "");
    }

    // Fallback to standard subject field
    if (!patientId && appointment.subject?.reference) {
      patientId = appointment.subject.reference.replace("Patient/", "");
    }

    // Extract practitioner from participants
    let practitionerId = null;
    if (appointment.participant && appointment.participant.length > 0) {
      const practitionerParticipant = appointment.participant.find((p) =>
        p.actor?.reference?.startsWith("Practitioner/")
      );
      if (practitionerParticipant?.actor?.reference) {
        practitionerId = practitionerParticipant.actor.reference.replace(
          "Practitioner/",
          ""
        );
      }
    }

    // Map status
    const status = this.mapFhirStatusToGraphQL(appointment.status);

    // Extract services
    const careServices = this.extractCareServices(appointment);

    return {
      id: appointmentId,
      patientId: patientId,
      nurseId: practitionerId,
      startTime: startTime || new Date().toISOString(), // Absolute fallback to prevent null
      endTime: endTime || startTime || new Date().toISOString(),
      status: status || "SCHEDULED",
      notes: appointment.comment || appointment.description || null,
      careServices: careServices,
      location: this.extractLocation(appointment),
      // These will be resolved by field resolvers
      patient: null,
      nurse: null,
    };
  }

  // Also ensure extractCareServices handles the HCHB structure
  extractCareServices(appointment) {
    const services = [];

    if (appointment.serviceType && appointment.serviceType.length > 0) {
      appointment.serviceType.forEach((service) => {
        // Handle HCHB's coding structure
        if (service.coding && service.coding.length > 0) {
          const code = service.coding[0];
          if (code.display) {
            services.push(code.display);
          } else if (code.code) {
            services.push(code.code);
          }
        } else if (service.text) {
          services.push(service.text);
        }
      });
    }

    // Also check appointmentType
    if (services.length === 0 && appointment.appointmentType?.coding?.[0]) {
      const type = appointment.appointmentType.coding[0];
      services.push(type.display || type.code || "General Care");
    }

    return services.length > 0 ? services : ["General Care"];
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
    // HCHB might store location in extensions or we might need to get from patient
    // For now, return null and handle in a separate resolver if needed
    return null;
  }
}

module.exports = appointmentAPI;
