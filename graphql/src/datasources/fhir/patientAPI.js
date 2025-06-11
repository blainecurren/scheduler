// graphql/src/datasources/fhir/HCHBPatientAPI.js
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

  async getAuthToken() {
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
      const token = await this.getAuthToken();

      console.log("[HCHBPatientAPI] Fetching all patients...");

      const patients = [];
      let nextUrl = `${this.baseURL}/Patient`;

      const params = {
        _count: 50,
        _sort: "family",
        active: "true",
      };

      while (nextUrl && patients.length < 500) {
        // Limit to 500 for safety
        const response = await this.get(
          nextUrl === `${this.baseURL}/Patient` ? "Patient" : nextUrl,
          nextUrl === `${this.baseURL}/Patient` ? params : undefined,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.entry && response.entry.length > 0) {
          const batchPatients = response.entry.map((entry) =>
            this.transformToPatient(entry.resource)
          );

          patients.push(...batchPatients);
          console.log(
            `[HCHBPatientAPI] Fetched ${batchPatients.length} patients (total: ${patients.length})`
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
        `[HCHBPatientAPI] Successfully fetched ${patients.length} patients total`
      );
      return patients;
    } catch (error) {
      console.error("[HCHBPatientAPI] Error fetching patients:", error);
      throw error;
    }
  }

  async getPatientById(id) {
    try {
      const token = await this.getAuthToken();

      console.log(`[HCHBPatientAPI] Fetching patient with ID: ${id}`);

      const response = await this.get(`Patient/${id}`, undefined, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return this.transformToPatient(response);
    } catch (error) {
      console.error(`[HCHBPatientAPI] Error fetching patient ${id}:`, error);
      throw error;
    }
  }

  // Transform FHIR Patient to our GraphQL Patient type
  transformToPatient(patient) {
    if (!patient) return null;

    // Extract name
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

    // Map to our GraphQL Patient type
    return {
      id: patient.id,
      name: name,
      phoneNumber: phoneNumber,
      email: email,
      careNeeds: careNeeds,
      medicalNotes: medicalNotes,
      location: this.extractLocation(patient),
      // These will be resolved by field resolvers
      appointments: null,
    };
  }

  extractCareNeeds(patient) {
    // HCHB might store care needs in extensions or other fields
    const careNeeds = [];

    // Check extensions
    if (patient.extension) {
      patient.extension.forEach((ext) => {
        if (ext.url && ext.url.includes("care-need")) {
          if (ext.valueString) {
            careNeeds.push(ext.valueString);
          } else if (ext.valueCodeableConcept?.text) {
            careNeeds.push(ext.valueCodeableConcept.text);
          }
        }
      });
    }

    // Check for conditions or other indicators
    // This might require fetching related Condition resources

    return careNeeds;
  }

  extractMedicalNotes(patient) {
    // Extract medical notes from text narrative or extensions
    if (patient.text?.div) {
      // Strip HTML tags
      return patient.text.div.replace(/<[^>]*>/g, "");
    }

    // Check for note extensions
    if (patient.extension) {
      const noteExt = patient.extension.find(
        (ext) => ext.url && ext.url.includes("note")
      );
      if (noteExt?.valueString) {
        return noteExt.valueString;
      }
    }

    return null;
  }

  extractLocation(patient) {
    // Extract location from address
    if (patient.address && patient.address.length > 0) {
      const primaryAddress =
        patient.address.find((addr) => addr.use === "home") ||
        patient.address[0];

      if (primaryAddress) {
        return {
          lat: null, // Would need geocoding
          lng: null, // Would need geocoding
          address: this.formatAddress(primaryAddress),
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
}

module.exports = patientAPI;
