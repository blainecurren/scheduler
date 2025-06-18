// graphql/src/database/sync.js
// Sync data from HCHB API to local SQLite database

require("dotenv").config();
const db = require("./db");
const { getToken } = require("../datasources/fhir/service");
const axios = require("axios");

async function fetchNursesFromHCHB() {
  console.log("Fetching nurses from HCHB...");

  const token = await getToken();
  const nurses = [];
  let nextUrl = `${process.env.API_BASE_URL}/Practitioner`;

  const params = {
    _count: 50,
    _sort: "family",
    active: "true",
  };

  while (nextUrl && nurses.length < 500) {
    // Safety limit
    try {
      const response = await axios.get(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/fhir+json",
        },
        params:
          nextUrl === `${process.env.API_BASE_URL}/Practitioner`
            ? params
            : undefined,
      });

      const data =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      if (data.entry && data.entry.length > 0) {
        const batch = data.entry.map((entry) =>
          transformPractitioner(entry.resource)
        );
        nurses.push(...batch);
        console.log(
          `  Fetched ${batch.length} nurses (total: ${nurses.length})`
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
      console.error("Error fetching nurses:", error.message);
      break;
    }
  }

  return nurses;
}

async function fetchPatientsFromHCHB() {
  console.log("Fetching patients from HCHB...");

  const token = await getToken();
  const patients = [];
  let nextUrl = `${process.env.API_BASE_URL}/Patient`;

  const params = {
    _count: 50,
    _sort: "family",
    active: "true",
  };

  while (nextUrl && patients.length < 500) {
    // Safety limit
    try {
      const response = await axios.get(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/fhir+json",
        },
        params:
          nextUrl === `${process.env.API_BASE_URL}/Patient`
            ? params
            : undefined,
      });

      const data =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      if (data.entry && data.entry.length > 0) {
        const batch = data.entry.map((entry) =>
          transformPatient(entry.resource)
        );
        patients.push(...batch);
        console.log(
          `  Fetched ${batch.length} patients (total: ${patients.length})`
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
      console.error("Error fetching patients:", error.message);
      break;
    }
  }

  return patients;
}

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
    // Safety limit
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

// Transform functions (simplified versions)
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
  // Try to get dates from multiple places
  let startTime = fhir.start;
  let endTime = fhir.end;

  if (!startTime && fhir.requestedPeriod?.[0]) {
    startTime = fhir.requestedPeriod[0].start;
    endTime = fhir.requestedPeriod[0].end;
  }

  // Get patient and nurse IDs
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

// Main sync function
async function syncFromHCHB() {
  console.log("=== Starting HCHB to SQLite Sync ===\n");

  try {
    // Fetch all data
    const [nurses, patients, appointments] = await Promise.all([
      fetchNursesFromHCHB(),
      fetchPatientsFromHCHB(),
      fetchAppointmentsFromHCHB(),
    ]);

    console.log("\n=== Syncing to SQLite ===");

    // Sync to database
    const nurseCount = db.nurses.sync(nurses);
    console.log(`✓ Synced ${nurseCount} nurses`);

    const patientCount = db.patients.sync(patients);
    console.log(`✓ Synced ${patientCount} patients`);

    const appointmentCount = db.appointments.sync(appointments);
    console.log(`✓ Synced ${appointmentCount} appointments`);

    // Show current counts
    console.log("\n=== Database Summary ===");
    console.log(`Total Nurses: ${db.nurses.getAll().length}`);
    console.log(`Total Patients: ${db.patients.getAll().length}`);
    console.log(
      `Total Appointments: ${
        db.appointments.getByDate(new Date().toISOString().split("T")[0]).length
      } today`
    );

    console.log("\n✅ Sync completed successfully!");
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
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
