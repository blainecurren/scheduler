// testSync.js - Save in graphql/src/database/
require("dotenv").config();
const db = require("./db");
const { getToken } = require("../datasources/fhir/service");
const axios = require("axios");

async function testSync() {
  console.log("=== Testing Database Sync ===\n");

  try {
    // Step 1: Check database connection
    console.log("Step 1: Testing database connection...");
    if (db.db) {
      console.log("✓ Database connection available");

      // Check current counts
      const appointmentCount = db.db
        .prepare("SELECT COUNT(*) as count FROM appointments")
        .get();
      const nurseCount = db.db
        .prepare("SELECT COUNT(*) as count FROM nurses")
        .get();
      const patientCount = db.db
        .prepare("SELECT COUNT(*) as count FROM patients")
        .get();

      console.log(`Current database state:`);
      console.log(`  - Appointments: ${appointmentCount.count}`);
      console.log(`  - Nurses: ${nurseCount.count}`);
      console.log(`  - Patients: ${patientCount.count}`);
    } else {
      console.log("❌ No direct database access");
    }

    // Step 2: Test appointment fetching
    console.log("\nStep 2: Testing appointment fetch...");
    const token = await getToken();

    // Fetch just one page to test
    const response = await axios.get(
      `${process.env.API_BASE_URL}/Appointment`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/fhir+json",
        },
        params: {
          _count: 10,
          _sort: "date",
        },
      }
    );

    const data =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    console.log(`API Response:`);
    console.log(`  - Total appointments available: ${data.total || "unknown"}`);
    console.log(
      `  - Appointments in this response: ${data.entry ? data.entry.length : 0}`
    );

    if (data.entry && data.entry.length > 0) {
      // Transform first appointment
      const firstAppt = data.entry[0].resource;
      console.log(`\nFirst appointment raw data:`);
      console.log(JSON.stringify(firstAppt, null, 2));

      // Try to transform it
      const transformed = transformAppointment(firstAppt);
      console.log(`\nTransformed appointment:`);
      console.log(JSON.stringify(transformed, null, 2));

      // Test syncing just this one appointment
      console.log(`\nStep 3: Testing sync of single appointment...`);

      // Clear appointments first
      db.db.prepare("DELETE FROM appointments").run();

      // Try to sync
      try {
        const syncResult = db.appointments.sync([transformed]);
        console.log(`Sync result: ${syncResult}`);

        // Check if it was saved
        const savedCount = db.db
          .prepare("SELECT COUNT(*) as count FROM appointments")
          .get();
        console.log(`Appointments in DB after sync: ${savedCount.count}`);

        if (savedCount.count > 0) {
          const saved = db.db
            .prepare("SELECT * FROM appointments LIMIT 1")
            .get();
          console.log(`\nSaved appointment in DB:`);
          console.log(saved);
        }
      } catch (syncError) {
        console.error("Sync error:", syncError.message);
        console.error("This might indicate missing patient/nurse references");
      }
    }
  } catch (error) {
    console.error("Test failed:", error.message);
    if (error.response) {
      console.error(
        "API Response:",
        error.response.status,
        error.response.data
      );
    }
  }
}

function transformAppointment(fhir) {
  // Extract start and end times
  let startTime = fhir.start;
  let endTime = fhir.end;

  // Check appointment-date-time extension for more specific times
  const dateTimeExt = fhir.extension?.find(
    (ext) =>
      ext.url ===
      "https://api.hchb.com/fhir/r4/StructureDefinition/appointment-date-time"
  );

  if (dateTimeExt?.extension) {
    const startExt = dateTimeExt.extension.find(
      (e) => e.url === "AppointmentStartTime"
    );
    const endExt = dateTimeExt.extension.find(
      (e) => e.url === "AppointmentEndTime"
    );
    if (startExt?.valueString) {
      // Parse the datetime string properly
      startTime = new Date(startExt.valueString).toISOString();
    }
    if (endExt?.valueString) {
      endTime = new Date(endExt.valueString).toISOString();
    }
  }

  // Fallback to requestedPeriod if no start/end
  if (!startTime && fhir.requestedPeriod?.[0]) {
    startTime = fhir.requestedPeriod[0].start;
    endTime = fhir.requestedPeriod[0].end;
  }

  // Extract patient reference - check multiple locations
  let patientId = null;

  // 1. Check extension for subject (HCHB specific)
  const subjectExt = fhir.extension?.find(
    (ext) =>
      ext.url === "https://api.hchb.com/fhir/r4/StructureDefinition/subject"
  );

  if (subjectExt?.valueReference?.reference) {
    patientId = subjectExt.valueReference.reference.replace("Patient/", "");
  }

  // 2. Check supporting-information extension with nested PatientReference
  if (!patientId) {
    const supportingInfoExt = fhir.extension?.find(
      (ext) =>
        ext.url ===
        "http://api.hchb.com/fhir/r4/StructureDefinition/supporting-information"
    );

    if (supportingInfoExt?.extension) {
      const patientRefExt = supportingInfoExt.extension.find(
        (e) => e.url === "PatientReference"
      );
      if (patientRefExt?.valueReference?.reference) {
        patientId = patientRefExt.valueReference.reference.replace(
          "Patient/",
          ""
        );
      }
    }
  }

  // 3. Fallback to standard subject field
  if (!patientId && fhir.subject?.reference) {
    patientId = fhir.subject.reference.replace("Patient/", "");
  }

  // Get first practitioner from participants
  let nurseId = null;
  if (fhir.participant && fhir.participant.length > 0) {
    for (const participant of fhir.participant) {
      if (participant.actor?.reference?.startsWith("Practitioner/")) {
        nurseId = participant.actor.reference.replace("Practitioner/", "");
        break;
      }
    }
  }

  // Extract service type with display text
  const careServices = [];
  if (fhir.serviceType && fhir.serviceType.length > 0) {
    for (const service of fhir.serviceType) {
      if (service.coding && service.coding[0]) {
        careServices.push(
          service.coding[0].display || service.coding[0].code || service.text
        );
      } else if (service.text) {
        careServices.push(service.text);
      }
    }
  }

  console.log(`  Extracted - Patient: ${patientId}, Nurse: ${nurseId}`);

  return {
    id: fhir.id,
    patientId: patientId,
    nurseId: nurseId,
    startTime: startTime || new Date().toISOString(),
    endTime: endTime || startTime || new Date().toISOString(),
    status: fhir.status?.toUpperCase() || "SCHEDULED",
    notes: fhir.comment || fhir.description,
    careServices: careServices,
  };
}

// Run the test
testSync();
