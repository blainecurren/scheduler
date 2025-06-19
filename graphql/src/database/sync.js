// graphql/src/database/sync.js
require("dotenv").config();
const db = require("./db");
const { getToken } = require("../datasources/fhir/service");
const axios = require("axios");

// Main sync function - fetches appointments first, then only related nurses/patients
async function syncFromHCHB() {
  console.log("=== Starting HCHB to SQLite Sync ===\n");

  try {
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

    // Show summary
    console.log("\n=== Database Summary ===");
    console.log(`Total Nurses: ${db.nurses.getAll().length}`);
    console.log(`Total Patients: ${db.patients.getAll().length}`);
    console.log(`Total Appointments: ${db.appointments.getAll().length}`);

    console.log("\n✅ Sync completed successfully!");
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

// Fetch appointments from HCHB
async function fetchAppointmentsFromHCHB() {
  console.log("Fetching appointments from HCHB...");

  const token = await getToken();
  const appointments = [];
  let nextUrl = `${process.env.API_BASE_URL}/Appointment`;

  // Get appointments for the current week
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const params = {
    _count: 50,
    _sort: "date",
    date: [
      `ge${startOfWeek.toISOString().split("T")[0]}`,
      `le${endOfWeek.toISOString().split("T")[0]}`,
    ],
  };

  while (nextUrl && appointments.length < 1000) {
    try {
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
          `  Fetched ${batch.length} appointments (total: ${appointments.length})`
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
  let startTime = fhir.start;
  let endTime = fhir.end;

  if (!startTime && fhir.requestedPeriod?.[0]) {
    startTime = fhir.requestedPeriod[0].start;
    endTime = fhir.requestedPeriod[0].end;
  }

  const patientRef =
    fhir.subject?.reference ||
    fhir.extension?.find((e) => e.url.includes("subject"))?.valueReference
      ?.reference;
  const patientId = patientRef?.replace("Patient/", "");

  const nurseParticipant = fhir.participant?.find((p) =>
    p.actor?.reference?.startsWith("Practitioner/")
  );
  const nurseId = nurseParticipant?.actor?.reference?.replace(
    "Practitioner/",
    ""
  );

  return {
    id: fhir.id,
    patientId: patientId,
    nurseId: nurseId,
    startTime: startTime || new Date().toISOString(),
    endTime: endTime || startTime,
    status: fhir.status?.toUpperCase() || "SCHEDULED",
    notes: fhir.comment || fhir.description,
    careServices:
      fhir.serviceType?.map((s) => s.coding?.[0]?.display || s.text) || [],
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
