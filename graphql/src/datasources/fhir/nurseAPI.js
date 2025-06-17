// graphql/src/datasources/fhir/nurseAPI.js
// FIXED VERSION - Parse JSON response from RESTDataSource
const { RESTDataSource } = require("apollo-datasource-rest");
const { getToken, transformPractitioner } = require("./service.js");

class nurseAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = process.env.API_BASE_URL || "https://api.hchb.com/fhir/r4";
    this.token = null;
    this.tokenExpiry = null;
  }

  willSendRequest(request) {
    // Set FHIR headers
    request.headers.set("Accept", "application/fhir+json");
    request.headers.set("Content-Type", "application/fhir+json");
  }

  async getToken() {
    // Check if we have a valid token
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    // Get a new token
    console.log("[HCHBNurseAPI] Getting new auth token...");
    this.token = await getToken();
    // Assume token expires in 1 hour (adjust based on actual token expiry)
    this.tokenExpiry = new Date(Date.now() + 3600 * 1000);
    return this.token;
  }

  async getNurses() {
    try {
      const token = await this.getToken();

      console.log("[HCHBNurseAPI] Fetching all nurses...");

      const nurses = [];
      let nextUrl = `${this.baseURL}/Practitioner`;

      const params = {
        _count: 50,
        _sort: "family",
        active: "true",
      };

      while (nextUrl) {
        const response = await this.get(
          nextUrl === `${this.baseURL}/Practitioner` ? "Practitioner" : nextUrl,
          nextUrl === `${this.baseURL}/Practitioner` ? params : undefined,
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
            console.error("[HCHBNurseAPI] Failed to parse response:", error);
            throw new Error("Invalid JSON response from FHIR server");
          }
        }

        if (parsedResponse.entry && parsedResponse.entry.length > 0) {
          // Transform FHIR Practitioners to our Nurse format
          const batchNurses = parsedResponse.entry
            .map((entry) => this.transformToNurse(entry.resource))
            .filter((nurse) => nurse !== null);

          nurses.push(...batchNurses);
          console.log(
            `[HCHBNurseAPI] Fetched ${batchNurses.length} nurses (total: ${nurses.length})`
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
        `[HCHBNurseAPI] Successfully fetched ${nurses.length} nurses total`
      );
      return nurses;
    } catch (error) {
      console.error("[HCHBNurseAPI] Error fetching nurses:", error);
      throw error;
    }
  }

  async getNurseById(id) {
    try {
      const token = await this.getToken();

      console.log(`[HCHBNurseAPI] Fetching nurse with ID: ${id}`);

      const response = await this.get(`Practitioner/${id}`, undefined, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // FIXED: Parse if string
      let parsedResponse = response;
      if (typeof response === "string") {
        parsedResponse = JSON.parse(response);
      }

      return this.transformToNurse(parsedResponse);
    } catch (error) {
      console.error(`[HCHBNurseAPI] Error fetching nurse ${id}:`, error);
      throw error;
    }
  }

  async getNursesBySpecialty(specialty) {
    try {
      const token = await this.getToken();

      console.log(
        `[HCHBNurseAPI] Fetching nurses with specialty: ${specialty}`
      );

      const nurses = [];
      let nextUrl = `${this.baseURL}/Practitioner`;

      const params = {
        _count: 50,
        "qualification-code": specialty,
        active: "true",
      };

      while (nextUrl) {
        const response = await this.get(
          nextUrl === `${this.baseURL}/Practitioner` ? "Practitioner" : nextUrl,
          nextUrl === `${this.baseURL}/Practitioner` ? params : undefined,
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

        if (parsedResponse.entry && parsedResponse.entry.length > 0) {
          const batchNurses = parsedResponse.entry
            .map((entry) => this.transformToNurse(entry.resource))
            .filter((nurse) => nurse !== null);

          nurses.push(...batchNurses);
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

      return nurses;
    } catch (error) {
      console.error(
        `[HCHBNurseAPI] Error fetching nurses by specialty:`,
        error
      );
      throw error;
    }
  }

  // Transform FHIR Practitioner to our GraphQL Nurse type
  transformToNurse(practitioner) {
    if (!practitioner) return null;

    // Extract name
    let name = "";
    if (practitioner.name && practitioner.name.length > 0) {
      const usualName =
        practitioner.name.find((n) => n.use === "usual") ||
        practitioner.name[0];
      if (usualName) {
        if (usualName.text) {
          name = usualName.text;
        } else {
          const parts = [];
          if (usualName.given) parts.push(...usualName.given);
          if (usualName.family) parts.push(usualName.family);
          name = parts.join(" ");
        }
      }
    }

    // Extract phone and email
    let phoneNumber = null;
    let email = null;

    if (practitioner.telecom) {
      const mobile = practitioner.telecom.find(
        (t) => t.system === "phone" && t.use === "mobile" && t.value
      );
      const work = practitioner.telecom.find(
        (t) => t.system === "phone" && t.use === "work" && t.value
      );
      const home = practitioner.telecom.find(
        (t) => t.system === "phone" && t.use === "home" && t.value
      );
      phoneNumber = mobile?.value || work?.value || home?.value;

      const emailContact = practitioner.telecom.find(
        (t) => t.system === "email" && t.value
      );
      email = emailContact?.value;
    }

    // Extract specialty/qualification
    let specialty = null;
    let title = null;
    if (practitioner.qualification && practitioner.qualification.length > 0) {
      const primaryQual = practitioner.qualification[0];
      if (primaryQual.code?.text) {
        specialty = primaryQual.code.text;
        title = primaryQual.code.text;
      }
    }

    // Map to our GraphQL Nurse type
    return {
      id: practitioner.id,
      name: name || "Unknown",
      title: title || "Healthcare Professional",
      specialty: specialty,
      phoneNumber: phoneNumber,
      email: email,
      location: null,
      appointments: null,
      availability: null,
    };
  }
}

module.exports = nurseAPI;
