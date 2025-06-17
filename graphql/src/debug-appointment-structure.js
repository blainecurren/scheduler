// graphql/src/debug-appointment-structure.js
// Script to examine raw appointment data from HCHB

require("dotenv").config();
const { getToken } = require("./datasources/fhir/service");
const axios = require("axios");

async function debugAppointmentStructure() {
  console.log("=== Debugging HCHB Appointment Structure ===\n");

  try {
    // Get authentication token
    console.log("1. Getting authentication token...");
    const token = await getToken();
    console.log("   ✓ Token obtained successfully\n");

    // Fetch a few appointments
    console.log("2. Fetching appointments from HCHB...");
    const apiUrl = process.env.API_BASE_URL || "https://api.hchb.com/fhir/r4";

    const response = await axios.get(`${apiUrl}/Appointment`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/fhir+json",
        "Content-Type": "application/fhir+json",
      },
      params: {
        _count: 3, // Just get 3 for debugging
        _sort: "-date",
      },
    });

    console.log("   ✓ Request successful\n");

    if (response.data.entry && response.data.entry.length > 0) {
      console.log(`3. Found ${response.data.entry.length} appointments\n`);

      response.data.entry.forEach((entry, index) => {
        const appointment = entry.resource;
        console.log(`=== Appointment ${index + 1} ===`);
        console.log("ID:", appointment.id);
        console.log("Status:", appointment.status);
        console.log("Resource keys:", Object.keys(appointment));

        // Check for standard date/time fields
        console.log("\nStandard FHIR date/time fields:");
        console.log("- start:", appointment.start);
        console.log("- end:", appointment.end);
        console.log("- created:", appointment.created);
        console.log("- period:", appointment.period);
        console.log("- requestedPeriod:", appointment.requestedPeriod);

        // Check for extensions
        if (appointment.extension) {
          console.log("\nExtensions found:", appointment.extension.length);
          appointment.extension.forEach((ext, i) => {
            console.log(`\nExtension ${i + 1}:`);
            console.log("- URL:", ext.url);
            if (ext.url.includes("appointment-date-time") && ext.extension) {
              console.log("  Date/Time extension details:");
              ext.extension.forEach((subExt) => {
                console.log(
                  `  - ${subExt.url}: ${
                    subExt.valueString || subExt.valueDateTime || "other type"
                  }`
                );
              });
            }
          });
        }

        // Check participants
        if (appointment.participant) {
          console.log("\nParticipants:", appointment.participant.length);
          appointment.participant.forEach((p, i) => {
            console.log(`- Participant ${i + 1}: ${p.actor?.reference}`);
          });
        }

        // Check subject
        if (appointment.subject) {
          console.log("\nSubject:", appointment.subject.reference);
        }

        console.log("\n" + "=".repeat(50) + "\n");
      });

      // Save first appointment for detailed analysis
      const fs = require("fs").promises;
      await fs.writeFile(
        "debug-appointment-sample.json",
        JSON.stringify(response.data.entry[0].resource, null, 2)
      );
      console.log("✓ First appointment saved to debug-appointment-sample.json");
    } else {
      console.log("No appointments found in response");
    }
  } catch (error) {
    console.error("\n✗ Error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

// Run the debug script
debugAppointmentStructure().catch(console.error);
