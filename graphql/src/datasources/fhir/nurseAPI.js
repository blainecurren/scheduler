// graphql/src/datasources/fhir/HCHBNurseAPI.js
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
      const token = await this.getAuthToken();

      console.log("[HCHBNurseAPI] Fetching all nurses...");

      const nurses = [];
      let nextUrl = `${this.baseURL}/Practitioner`;

      // HCHB might use specific tags or qualifications to identify nurses
      // We'll search for all practitioners and filter
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

        if (response.entry && response.entry.length > 0) {
          // Transform FHIR Practitioners to our Nurse format
          const batchNurses = response.entry
            .map((entry) => this.transformToNurse(entry.resource))
            .filter((nurse) => nurse !== null); // Filter out non-nurses if needed

          nurses.push(...batchNurses);
          console.log(
            `[HCHBNurseAPI] Fetched ${batchNurses.length} nurses (total: ${nurses.length})`
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
      const token = await this.getAuthToken();

      console.log(`[HCHBNurseAPI] Fetching nurse with ID: ${id}`);

      const response = await this.get(`Practitioner/${id}`, undefined, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return this.transformToNurse(response);
    } catch (error) {
      console.error(`[HCHBNurseAPI] Error fetching nurse ${id}:`, error);
      throw error;
    }
  }

  async getNursesBySpecialty(specialty) {
    try {
      const token = await this.getAuthToken();

      console.log(
        `[HCHBNurseAPI] Fetching nurses with specialty: ${specialty}`
      );

      const nurses = [];
      let nextUrl = `${this.baseURL}/Practitioner`;

      const params = {
        _count: 50,
        "qualification-code": specialty, // FHIR search parameter for qualification
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

        if (response.entry && response.entry.length > 0) {
          const batchNurses = response.entry
            .map((entry) => this.transformToNurse(entry.resource))
            .filter((nurse) => nurse !== null);

          nurses.push(...batchNurses);
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
      name: name,
      title: title || "Healthcare Professional",
      specialty: specialty,
      phoneNumber: phoneNumber,
      email: email,
      location: null, // Will need to be resolved separately if needed
      // These will be resolved by field resolvers
      appointments: null,
      availability: null,
    };
  }

  extractTitle(practitioner) {
    // Extract title from qualifications or default to "Registered Nurse"
    if (practitioner.qualification && practitioner.qualification.length > 0) {
      const primaryQual = practitioner.qualification[0];
      if (primaryQual.code?.coding?.[0]?.display) {
        return primaryQual.code.coding[0].display;
      }
      if (primaryQual.code?.text) {
        return primaryQual.code.text;
      }
    }
    return "Healthcare Professional";
  }

  extractLocation(practitioner) {
    // HCHB might store location in extensions or we might need to fetch from a related Location resource
    // For now, return null and handle in a separate resolver if needed
    return null;
  }
}

module.exports = nurseAPI;
