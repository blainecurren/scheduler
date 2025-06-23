// graphql/src/database/sync.js
require("dotenv").config();
const db = require("./db");
const { getToken } = require("../datasources/fhir/service");
const axios = require("axios");

// Main sync function - fetches appointments first, then only related nurses/patients
async function syncFromHCHB() {
  console.log("=== Starting HCHB to SQLite Sync ===\n");

  try {
    // Step 0: Clear existing data for fresh sync
    console.log("Step 0: Clearing existing data...");
    clearDatabase();
    console.log("✓ Database cleared\n");

    // Step 1: Fetch all appointments first
    console.log("Step 1: Fetching appointments from HCHB...");
    const appointments = await fetchAppointmentsFromHCHB();
    console.log(`✓ Fetched ${appointments.length} appointments`);

    // Step 2: Extract unique patient and nurse IDs from appointments
    const uniquePatientIds = [
      ...new Set(appointments.map((a) => a.patientId).filter(Boolean)),
    ];
    const uniqueNurseIds = [
      ...new Set(appointments.map((a) => a.nurseId).filter(Boolean)),
    ];

    console.log(
      `\nFound ${uniquePatientIds.length} unique patients in appointments`
    );
    console.log(`Found ${uniqueNurseIds.length} unique nurses in appointments`);

    // Step 3: Fetch ONLY those specific patients and nurses
    const patients = await fetchPatientsByIds(uniquePatientIds);
    const nurses = await fetchNursesByIds(uniqueNurseIds);

    console.log(`\n✓ Fetched ${patients.length} patients`);
    console.log(`✓ Fetched ${nurses.length} nurses`);

    // Step 4: Sync to database in the correct order
    console.log("\n=== Syncing to SQLite ===");

    // Sync nurses first
    const nurseCount = db.nurses.sync(nurses);
    console.log(`✓ Synced ${nurseCount} nurses`);

    // Sync patients second
    const patientCount = db.patients.sync(patients);
    console.log(`✓ Synced ${patientCount} patients`);

    // Finally sync appointments (all dependencies should now exist)
    const appointmentCount = db.appointments.sync(appointments);
    console.log(`✓ Synced ${appointmentCount} appointments`);

    console.log("\n✅ Sync completed successfully!");
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

// Clear database function
function clearDatabase() {
  try {
    if (db.db) {
      // Delete in reverse order of dependencies
      db.db.prepare("DELETE FROM appointments").run();
      db.db.prepare("DELETE FROM patients").run();
      db.db.prepare("DELETE FROM nurses").run();
    } else {
      console.warn(
        "Could not access db.db directly. Database may not be cleared."
      );
    }
  } catch (error) {
    console.error("Error clearing database:", error.message);
    // Continue anyway - maybe the sync will handle it
  }
}

// Fetch appointments from HCHB
async function fetchAppointmentsFromHCHB() {
  console.log("Fetching appointments from HCHB...");

  const token = await getToken();
  const appointments = [];
  let nextUrl = `${process.env.API_BASE_URL}/Appointment`;

  // Get appointments for the current week (Sunday to Saturday)
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Go to Sunday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Go to Saturday

  console.log(
    `  Week range: ${startOfWeek.toISOString().split("T")[0]} to ${
      endOfWeek.toISOString().split("T")[0]
    }`
  );

  const params = {
    _count: 50, // Fetch 50 per page
    _sort: "date",
    date: [
      `ge${startOfWeek.toISOString().split("T")[0]}`,
      `le${endOfWeek.toISOString().split("T")[0]}`,
    ],
  };

  let pageCount = 0;
  // Remove the 1000 limit to get ALL appointments for the week
  while (nextUrl) {
    try {
      pageCount++;
      const response = await axios.get(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/fhir+json",
        },
        params:
          nextUrl === `${process.env.API_BASE_URL}/Appointment`
            ? params
            : undefined,
      });

      const data =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      if (data.entry && data.entry.length > 0) {
        const batch = data.entry.map((entry) =>
          transformAppointment(entry.resource)
        );
        appointments.push(...batch);
        console.log(
          `  Page ${pageCount}: Fetched ${batch.length} appointments (total: ${appointments.length})`
        );
      }

      // Get next page
      nextUrl = null;
      if (data.link && Array.isArray(data.link)) {
        const nextLink = data.link.find((l) => l.relation === "next");
        if (nextLink && nextLink.url) {
          nextUrl = nextLink.url;
        }
      }
    } catch (error) {
      console.error("Error fetching appointments:", error.message);
      break;
    }
  }

  console.log(
    `  Total appointments fetched for the week: ${appointments.length}`
  );
  return appointments;
}

// Fetch specific patients by their IDs
async function fetchPatientsByIds(patientIds) {
  if (patientIds.length === 0) return [];

  console.log(`\nFetching ${patientIds.length} specific patients from HCHB...`);
  const token = await getToken();
  const patients = [];

  // Batch requests to avoid URL length limits
  const batchSize = 50;

  for (let i = 0; i < patientIds.length; i += batchSize) {
    const batch = patientIds.slice(i, i + batchSize);
    const idString = batch.join(",");

    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/Patient`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/fhir+json",
        },
        params: {
          _id: idString,
          _count: batchSize,
        },
      });

      const data =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      if (data.entry && data.entry.length > 0) {
        const batchPatients = data.entry.map((entry) =>
          transformPatient(entry.resource)
        );
        patients.push(...batchPatients);
        console.log(
          `  Fetched batch ${Math.floor(i / batchSize) + 1}: ${
            batchPatients.length
          } patients`
        );
      }
    } catch (error) {
      console.error(`Error fetching patient batch:`, error.message);
    }
  }

  return patients;
}

// Fetch specific nurses by their IDs
async function fetchNursesByIds(nurseIds) {
  if (nurseIds.length === 0) return [];

  console.log(`\nFetching ${nurseIds.length} specific nurses from HCHB...`);
  const token = await getToken();
  const nurses = [];

  const batchSize = 50;

  for (let i = 0; i < nurseIds.length; i += batchSize) {
    const batch = nurseIds.slice(i, i + batchSize);
    const idString = batch.join(",");

    try {
      const response = await axios.get(
        `${process.env.API_BASE_URL}/Practitioner`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/fhir+json",
          },
          params: {
            _id: idString,
            _count: batchSize,
          },
        }
      );

      const data =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      if (data.entry && data.entry.length > 0) {
        const batchNurses = data.entry.map((entry) =>
          transformPractitioner(entry.resource)
        );
        nurses.push(...batchNurses);
        console.log(
          `  Fetched batch ${Math.floor(i / batchSize) + 1}: ${
            batchNurses.length
          } nurses`
        );
      }
    } catch (error) {
      console.error(`Error fetching nurse batch:`, error.message);
    }
  }

  return nurses;
}

// Transform functions
function transformPractitioner(fhir) {
  let name = "";
  if (fhir.name && fhir.name.length > 0) {
    const n = fhir.name[0];
    const parts = [];
    if (n.given) parts.push(...n.given);
    if (n.family) parts.push(n.family);
    name = parts.join(" ");
  }

  return {
    id: fhir.id,
    name: name || "Unknown",
    title: fhir.qualification?.[0]?.code?.text || "Healthcare Professional",
    specialty: fhir.qualification?.[0]?.code?.text,
    phoneNumber: fhir.telecom?.find((t) => t.system === "phone")?.value,
    email: fhir.telecom?.find((t) => t.system === "email")?.value,
  };
}

function transformPatient(fhir) {
  let name = "";
  if (fhir.name && fhir.name.length > 0) {
    const n = fhir.name[0];
    const parts = [];
    if (n.given) parts.push(...n.given);
    if (n.family) parts.push(n.family);
    name = parts.join(" ");
  }

  const careNeeds = [];
  if (fhir.extension) {
    const diagnosis = fhir.extension.find((e) => e.url === "diagnosis");
    if (diagnosis?.valueString) careNeeds.push(diagnosis.valueString);
  }

  return {
    id: fhir.id,
    name: name || "Unknown",
    phoneNumber: fhir.telecom?.find((t) => t.system === "phone")?.value,
    email: fhir.telecom?.find((t) => t.system === "email")?.value,
    careNeeds: careNeeds,
    medicalNotes: fhir.extension?.find((e) => e.url === "information")
      ?.valueString,
  };
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

// Run if called directly
if (require.main === module) {
  syncFromHCHB()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { syncFromHCHB };
