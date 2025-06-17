// graphql/src/datasources/fhir/patientAPI.js
// FIXED VERSION - JSON parsing + getPatients method
const { RESTDataSource } = require("apollo-datasource-rest");
const { getToken, transformPatient } = require("./service");

class patientAPI extends RESTDataSource {
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

    console.log("[HCHBPatientAPI] Getting new auth token...");
    this.token = await getToken();
    this.tokenExpiry = new Date(Date.now() + 3600 * 1000);
    return this.token;
  }

  async getAllPatients() {
    try {
      const token = await this.getToken();

      console.log("[HCHBPatientAPI] Fetching all patients...");

      const patients = [];
      let nextUrl = `${this.baseURL}/Patient`;

      const params = {
        _count: 50,
        _sort: "family",
        active: "true",
      };

      while (nextUrl && patients.length < 500) {
        const response = await this.get(
          nextUrl === `${this.baseURL}/Patient` ? "Patient" : nextUrl,
          nextUrl === `${this.baseURL}/Patient` ? params : undefined,
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
            console.error("[HCHBPatientAPI] Failed to parse response:", error);
            throw new Error("Invalid JSON response from FHIR server");
          }
        }

        if (parsedResponse.entry && parsedResponse.entry.length > 0) {
          const batchPatients = parsedResponse.entry.map((entry) =>
            this.transformToPatient(entry.resource)
          );

          patients.push(...batchPatients);
          console.log(
            `[HCHBPatientAPI] Fetched ${batchPatients.length} patients (total: ${patients.length})`
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
        `[HCHBPatientAPI] Successfully fetched ${patients.length} patients total`
      );
      return patients;
    } catch (error) {
      console.error("[HCHBPatientAPI] Error fetching patients:", error);
      throw error;
    }
  }

  // FIXED: Added this method for resolver compatibility
  async getPatients() {
    return this.getAllPatients();
  }

  async getPatientById(id) {
    try {
      const token = await this.getToken();

      console.log(`[HCHBPatientAPI] Fetching patient with ID: ${id}`);

      const response = await this.get(`Patient/${id}`, undefined, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // FIXED: Parse if string
      let parsedResponse = response;
      if (typeof response === "string") {
        parsedResponse = JSON.parse(response);
      }

      return this.transformToPatient(parsedResponse);
    } catch (error) {
      console.error(`[HCHBPatientAPI] Error fetching patient ${id}:`, error);
      throw error;
    }
  }

  // Transform FHIR Patient to our GraphQL Patient type
  transformToPatient(patient) {
    if (!patient) return null;

    // IMPORTANT: Ensure we have an ID
    const patientId =
      patient.id || patient.identifier?.[0]?.value || `unknown-${Date.now()}`;

    // Use transformation from service.js if available
    if (transformPatient) {
      try {
        const transformed = transformPatient(patient);

        // CRITICAL FIX: The service.js transformPatient doesn't return an id field
        // We need to add it manually
        return {
          id: patientId, // Use the patient's FHIR id
          name: transformed.name || "Unknown Patient",
          phoneNumber: transformed.phoneNumber,
          email: transformed.email,
          careNeeds: transformed.careNeeds || [],
          medicalNotes: transformed.medicalNotes,
          location: transformed.address
            ? {
                address: transformed.address,
                lat: null,
                lng: null,
              }
            : null,
          appointments: null,
        };
      } catch (error) {
        console.error("[HCHBPatientAPI] Service transformation error:", error);
        // Fall through to manual transformation
      }
    }
    // Fallback transformation
    let name = "";
    if (patient.name && patient.name.length > 0) {
      const officialName =
        patient.name.find((n) => n.use === "official") || patient.name[0];
      if (officialName) {
        const parts = [];
        if (officialName.given) parts.push(...officialName.given);
        if (officialName.family) parts.push(officialName.family);
        name = parts.join(" ");
      }
    }

    // Extract phone and email
    let phoneNumber = null;
    let email = null;

    if (patient.telecom) {
      const mobile = patient.telecom.find(
        (t) => t.system === "phone" && t.use === "mobile" && t.value
      );
      const home = patient.telecom.find(
        (t) => t.system === "phone" && t.use === "home" && t.value
      );
      phoneNumber = mobile?.value || home?.value;

      const emailContact = patient.telecom.find(
        (t) => t.system === "email" && t.value
      );
      email = emailContact?.value;
    }

    // Extract care needs from extensions
    const careNeeds = [];
    if (patient.extension) {
      const diagnosisExt = patient.extension.find(
        (ext) => ext.url === "diagnosis"
      );
      if (diagnosisExt?.valueString) {
        careNeeds.push(diagnosisExt.valueString);
      }

      const serviceCodeExt = patient.extension.find(
        (ext) => ext.url === "serviceCode"
      );
      if (serviceCodeExt?.valueString) {
        careNeeds.push(`Service: ${serviceCodeExt.valueString}`);
      }

      const dietExt = patient.extension.find((ext) => ext.url === "diet");
      if (dietExt?.valueString) {
        careNeeds.push(`Diet: ${dietExt.valueString}`);
      }
    }

    // Extract medical notes
    let medicalNotes = null;
    const infoExt = patient.extension?.find((ext) => ext.url === "information");
    if (infoExt?.valueString) {
      medicalNotes = infoExt.valueString;
    }

    // Extract address for location
    let location = null;
    if (patient.address && patient.address.length > 0) {
      const primaryAddress = patient.address[0];
      location = {
        address: [
          primaryAddress.line?.join(" "),
          primaryAddress.city,
          primaryAddress.state,
          primaryAddress.postalCode,
        ]
          .filter(Boolean)
          .join(", "),
        lat: null,
        lng: null,
      };
    }

    return {
      id: patient.id,
      name: name || "Unknown",
      phoneNumber: phoneNumber,
      email: email,
      careNeeds: careNeeds,
      medicalNotes: medicalNotes,
      location: location,
      appointments: null,
    };
  }
}

module.exports = patientAPI;
