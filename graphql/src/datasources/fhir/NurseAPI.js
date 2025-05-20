const { RESTDataSource } = require("apollo-datasource-rest");

class NurseAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = process.env.FHIR_API_URL || "http://localhost:8000/fhir";
  }

  async getNurses() {
    // FHIR search for Practitioner resources representing nurses
    const response = await this.get("Practitioner", {
      _tag: "nurse",
    });

    return this.nursesReducer(response.entry || []);
  }

  async getNurseById(id) {
    const nurse = await this.get(`Practitioner/${id}`);
    return this.nurseReducer(nurse);
  }

  async getNursesBySpecialty(specialty) {
    // FHIR search for Practitioners with specific specialty
    const response = await this.get("Practitioner", {
      _tag: "nurse",
      qualification: specialty,
    });

    return this.nursesReducer(response.entry || []);
  }

  // Transform FHIR Practitioner to our GraphQL Nurse type
  nurseReducer(practitioner) {
    return {
      id: practitioner.id,
      name: this.formatHumanName(practitioner.name?.[0]),
      title: this.getQualificationDisplay(practitioner.qualification),
      phoneNumber: this.getContactValue(practitioner.telecom, "phone"),
      email: this.getContactValue(practitioner.telecom, "email"),
      specialty: this.getExtensionValue(practitioner.extension, "specialty"),
      // Location will be handled by resolvers
    };
  }

  nursesReducer(entries) {
    return entries.map((entry) => this.nurseReducer(entry.resource));
  }

  // Helper methods for FHIR data extraction
  formatHumanName(name) {
    if (!name) return "";

    const parts = [];
    if (name.prefix) parts.push(name.prefix.join(" "));
    if (name.given) parts.push(name.given.join(" "));
    if (name.family) parts.push(name.family);

    return parts.filter(Boolean).join(" ");
  }

  getQualificationDisplay(qualifications) {
    if (!qualifications || !qualifications.length) return null;
    return (
      qualifications[0]?.code?.text ||
      qualifications[0]?.code?.coding?.[0]?.display
    );
  }

  getContactValue(telecom, system) {
    if (!telecom || !telecom.length) return null;
    const contact = telecom.find((t) => t.system === system);
    return contact?.value;
  }

  getExtensionValue(extensions, url) {
    if (!extensions || !extensions.length) return null;
    const extension = extensions.find((ext) => ext.url.endsWith(url));
    return extension?.valueString || extension?.valueCode;
  }
}

// graphql/src/datasources/fhir/PatientAPI.js
const { RESTDataSource } = require("apollo-datasource-rest");

class PatientAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = process.env.FHIR_API_URL || "http://localhost:8000/fhir";
  }

  async getPatients() {
    const response = await this.get("Patient");
    return this.patientsReducer(response.entry || []);
  }

  async getPatientById(id) {
    const patient = await this.get(`Patient/${id}`);
    return this.patientReducer(patient);
  }

  // Transform FHIR Patient to our GraphQL Patient type
  patientReducer(patient) {
    return {
      id: patient.id,
      name: this.formatHumanName(patient.name?.[0]),
      phoneNumber: this.getContactValue(patient.telecom, "phone"),
      email: this.getContactValue(patient.telecom, "email"),
      medicalNotes: patient.text?.div
        ? this.stripHtmlTags(patient.text.div)
        : null,
      careNeeds: this.getCareNeeds(patient.extension),
      // Location will be handled by resolvers
    };
  }

  patientsReducer(entries) {
    return entries.map((entry) => this.patientReducer(entry.resource));
  }

  // Helper methods for FHIR data extraction
  formatHumanName(name) {
    if (!name) return "";

    const parts = [];
    if (name.prefix) parts.push(name.prefix.join(" "));
    if (name.given) parts.push(name.given.join(" "));
    if (name.family) parts.push(name.family);

    return parts.filter(Boolean).join(" ");
  }

  getContactValue(telecom, system) {
    if (!telecom || !telecom.length) return null;
    const contact = telecom.find((t) => t.system === system);
    return contact?.value;
  }

  stripHtmlTags(html) {
    return html.replace(/<[^>]*>?/gm, "");
  }

  getCareNeeds(extensions) {
    if (!extensions || !extensions.length) return [];

    const careNeedsExt = extensions.find(
      (ext) => ext.url.includes("care-needs") || ext.url.includes("careNeeds")
    );

    if (!careNeedsExt) return [];

    if (careNeedsExt.valueCodeableConcept) {
      return [careNeedsExt.valueCodeableConcept.text];
    }

    if (careNeedsExt.extension) {
      return careNeedsExt.extension
        .filter((ext) => ext.valueString || ext.valueCodeableConcept)
        .map((ext) => ext.valueString || ext.valueCodeableConcept.text);
    }

    return [];
  }
}

// graphql/src/datasources/fhir/AppointmentAPI.js
const { RESTDataSource } = require("apollo-datasource-rest");

class AppointmentAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = process.env.FHIR_API_URL || "http://localhost:8000/fhir";
  }

  async getAppointments(filters = {}) {
    const { date, nurseId, patientId } = filters;
    const params = {};

    if (date) {
      params.date = date;
    }

    if (nurseId) {
      params["actor"] = `Practitioner/${nurseId}`;
    }

    if (patientId) {
      params["actor"] = `Patient/${patientId}`;
    }

    const response = await this.get("Appointment", params);
    return this.appointmentsReducer(response.entry || []);
  }

  async getAppointmentById(id) {
    const appointment = await this.get(`Appointment/${id}`);
    return this.appointmentReducer(appointment);
  }

  async createAppointment(appointmentData) {
    // Convert from GraphQL format to FHIR format
    const fhirAppointment = this.createFhirAppointment(appointmentData);

    // Post to FHIR server
    const response = await this.post("Appointment", fhirAppointment);

    return this.appointmentReducer(response);
  }

  async updateAppointment(id, appointmentData) {
    // Get the current appointment
    const currentAppointment = await this.get(`Appointment/${id}`);

    // Merge with updates
    const updatedFhirAppointment = {
      ...currentAppointment,
      ...this.createFhirAppointment(appointmentData),
    };

    // Put to FHIR server
    const response = await this.put(
      `Appointment/${id}`,
      updatedFhirAppointment
    );

    return this.appointmentReducer(response);
  }

  async cancelAppointment(id, reason) {
    // Get the current appointment
    const currentAppointment = await this.get(`Appointment/${id}`);

    // Update the status to cancelled
    const cancelledAppointment = {
      ...currentAppointment,
      status: "cancelled",
      comment: reason || "Cancelled through the scheduling system",
    };

    // Put to FHIR server
    const response = await this.put(`Appointment/${id}`, cancelledAppointment);

    return this.appointmentReducer(response);
  }

  // Transform FHIR Appointment to our GraphQL Appointment type
  appointmentReducer(appointment) {
    // Get patient and practitioner references
    const patientParticipant = appointment.participant?.find((p) =>
      p.actor?.reference?.startsWith("Patient/")
    );

    const nurseParticipant = appointment.participant?.find((p) =>
      p.actor?.reference?.startsWith("Practitioner/")
    );

    const patientId = patientParticipant?.actor?.reference?.replace(
      "Patient/",
      ""
    );
    const nurseId = nurseParticipant?.actor?.reference?.replace(
      "Practitioner/",
      ""
    );

    return {
      id: appointment.id,
      patientId,
      nurseId,
      startTime: appointment.start,
      endTime: appointment.end,
      status: this.mapFhirStatus(appointment.status),
      notes: appointment.comment,
      careServices: this.getCareServices(appointment.serviceType),
      // Location will be resolved separately
    };
  }

  appointmentsReducer(entries) {
    return entries.map((entry) => this.appointmentReducer(entry.resource));
  }

  // Helper for mapping FHIR status to our GraphQL enum
  mapFhirStatus(fhirStatus) {
    const statusMap = {
      proposed: "SCHEDULED",
      pending: "SCHEDULED",
      booked: "SCHEDULED",
      arrived: "IN_PROGRESS",
      fulfilled: "COMPLETED",
      cancelled: "CANCELLED",
      noshow: "MISSED",
    };

    return statusMap[fhirStatus] || "SCHEDULED";
  }

  getCareServices(serviceTypes) {
    if (!serviceTypes || !serviceTypes.length) return [];

    return serviceTypes.map(
      (service) =>
        service.text || service.coding?.[0]?.display || "General Care"
    );
  }

  // Helper to create a FHIR appointment from GraphQL input
  createFhirAppointment(appointmentData) {
    const {
      patientId,
      nurseId,
      startTime,
      endTime,
      status,
      notes,
      careServices,
    } = appointmentData;

    const fhirAppointment = {
      resourceType: "Appointment",
      status: this.mapGraphqlStatus(status || "SCHEDULED"),
      start: startTime,
      end: endTime,
      participant: [
        {
          actor: {
            reference: `Patient/${patientId}`,
          },
          status: "accepted",
        },
        {
          actor: {
            reference: `Practitioner/${nurseId}`,
          },
          status: "accepted",
        },
      ],
    };

    if (notes) {
      fhirAppointment.comment = notes;
    }

    if (careServices && careServices.length) {
      fhirAppointment.serviceType = careServices.map((service) => ({
        text: service,
      }));
    }

    return fhirAppointment;
  }

  // Helper for mapping GraphQL status to FHIR
  mapGraphqlStatus(graphqlStatus) {
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

// graphql/src/datasources/index.js
const NurseAPI = require("./fhir/NurseAPI");
const PatientAPI = require("./fhir/PatientAPI");
const AppointmentAPI = require("./fhir/AppointmentAPI");

module.exports = {
  nurseAPI: new NurseAPI(),
  patientAPI: new PatientAPI(),
  appointmentAPI: new AppointmentAPI(),
};
