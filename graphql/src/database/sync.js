// Updated graphql/src/database/sync.js
require("dotenv").config();
const db = require("./db");
const { getToken } = require("../datasources/fhir/service");
const axios = require("axios");

// Helper function to extract address - matches Python script logic
function extractAddress(addressObj) {
  if (!addressObj || !Array.isArray(addressObj) || addressObj.length === 0) {
    return "";
  }

  const address = addressObj[0];
  const street = address.line && address.line.length > 0 ? address.line[0] : "";
  const city = address.city || "";
  const state = address.state || "";
  const postalCode = address.postalCode || "";

  // Format as: "street, city, state zip" - same as Python script
  const parts = [street, city, state].filter(Boolean).join(", ");
  return postalCode ? `${parts} ${postalCode}` : parts;
}

// Helper function to extract coordinates from FHIR extensions
function extractCoordinates(fhirResource) {
  let lat = null;
  let lng = null;

  if (fhirResource.extension) {
    const geoExt = fhirResource.extension.find(
      (ext) => ext.url === "http://hl7.org/fhir/StructureDefinition/geolocation"
    );
    if (geoExt?.extension) {
      const latExt = geoExt.extension.find((e) => e.url === "latitude");
      const lngExt = geoExt.extension.find((e) => e.url === "longitude");
      lat = latExt?.valueDecimal || null;
      lng = lngExt?.valueDecimal || null;
    }
  }

  // Also check position field (for Location resources)
  if (fhirResource.position) {
    lat = fhirResource.position.latitude || lat;
    lng = fhirResource.position.longitude || lng;
  }

  return { lat, lng };
}

// Transform functions with address extraction
function transformNurse(fhir) {
  let name = "";
  if (fhir.name && fhir.name.length > 0) {
    const n = fhir.name[0];
    const parts = [];
    if (n.given) parts.push(...n.given);
    if (n.family) parts.push(n.family);
    name = parts.join(" ");
  }

  // Extract address
  const address = extractAddress(fhir.address);
  const { lat, lng } = extractCoordinates(fhir);

  return {
    id: fhir.id,
    name: name || "Unknown",
    title: fhir.qualification?.[0]?.code?.text || "Healthcare Professional",
    specialty: fhir.qualification?.[0]?.code?.text,
    phoneNumber: fhir.telecom?.find((t) => t.system === "phone")?.value,
    email: fhir.telecom?.find((t) => t.system === "email")?.value,
    address: address,
    lat: lat,
    lng: lng,
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

    const serviceCode = fhir.extension.find((e) => e.url === "serviceCode");
    if (serviceCode?.valueString)
      careNeeds.push(`Service: ${serviceCode.valueString}`);

    const diet = fhir.extension.find((e) => e.url === "diet");
    if (diet?.valueString) careNeeds.push(`Diet: ${diet.valueString}`);
  }

  // Extract address
  const address = extractAddress(fhir.address);
  const { lat, lng } = extractCoordinates(fhir);

  return {
    id: fhir.id,
    name: name || "Unknown",
    phoneNumber: fhir.telecom?.find((t) => t.system === "phone")?.value,
    email: fhir.telecom?.find((t) => t.system === "email")?.value,
    careNeeds: careNeeds,
    medicalNotes: fhir.extension?.find((e) => e.url === "information")
      ?.valueString,
    address: address,
    lat: lat,
    lng: lng,
  };
}

function transformLocation(fhir) {
  // Extract address
  const address = extractAddress(fhir.address ? [fhir.address] : []);
  const { lat, lng } = extractCoordinates(fhir);

  return {
    id: fhir.id,
    name: fhir.name || "Unknown Location",
    address: address,
    lat: lat,
    lng: lng,
    phoneNumber: fhir.telecom?.find((t) => t.system === "phone")?.value,
    type: fhir.type?.[0]?.coding?.[0]?.display || fhir.type?.[0]?.text || null,
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
      startTime = new Date(startExt.valueString).toISOString();
    }
    if (endExt?.valueString) {
      endTime = new Date(endExt.valueString).toISOString();
    }
  }

  // Extract patient ID
  let patientId = null;
  const subjectExt = fhir.extension?.find(
    (ext) =>
      ext.url === "https://api.hchb.com/fhir/r4/StructureDefinition/subject"
  );
  if (subjectExt?.valueReference?.reference) {
    patientId = subjectExt.valueReference.reference.replace("Patient/", "");
  }

  // Extract location ID
  let locationId = null;
  const locationExt = fhir.extension?.find(
    (ext) =>
      ext.url ===
      "https://api.hchb.com/fhir/r4/StructureDefinition/service-location"
  );
  if (locationExt?.valueReference?.reference) {
    locationId = locationExt.valueReference.reference.replace("Location/", "");
  }

  // Get nurse ID from participants
  let nurseId = null;
  if (fhir.participant && fhir.participant.length > 0) {
    for (const participant of fhir.participant) {
      if (participant.actor?.reference?.startsWith("Practitioner/")) {
        nurseId = participant.actor.reference.replace("Practitioner/", "");
        break;
      }
    }
  }

  // Extract service type
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
    locationId: locationId,
    startTime: startTime || new Date().toISOString(),
    endTime: endTime || startTime || new Date().toISOString(),
    status: fhir.status?.toUpperCase() || "SCHEDULED",
    notes: fhir.comment || fhir.description,
    careServices: careServices,
  };
}

// Main sync function - fetches appointments first, then only related nurses/patients
async function syncFromHCHB() {
  console.log("=== Starting HCHB to SQLite Sync with Address Support ===\n");

  try {
    // Step 0: Clear existing data for fresh sync
    console.log("Step 0: Clearing existing data...");
    clearDatabase();
    console.log("✓ Database cleared\n");

    // Step 1: Fetch all appointments first
    console.log("Step 1: Fetching appointments from HCHB...");
    const appointments = await fetchAppointmentsFromHCHB();
    console.log(`✓ Fetched ${appointments.length} appointments`);

    // Step 2: Extract unique patient, nurse, and location IDs from appointments
    const uniquePatientIds = [
      ...new Set(appointments.map((a) => a.patientId).filter(Boolean)),
    ];
    const uniqueNurseIds = [
      ...new Set(appointments.map((a) => a.nurseId).filter(Boolean)),
    ];
    const uniqueLocationIds = [
      ...new Set(appointments.map((a) => a.locationId).filter(Boolean)),
    ];

    console.log(
      `\nFound ${uniquePatientIds.length} unique patients in appointments`
    );
    console.log(`Found ${uniqueNurseIds.length} unique nurses in appointments`);
    console.log(
      `Found ${uniqueLocationIds.length} unique locations in appointments`
    );

    // Step 3: Fetch ONLY those specific resources referenced in appointments
    const patients = await fetchPatientsByIds(uniquePatientIds);
    const nurses = await fetchNursesByIds(uniqueNurseIds);
    const locations = await fetchLocationsByIds(uniqueLocationIds);

    console.log(`\n✓ Fetched ${patients.length} patients with addresses`);
    console.log(`✓ Fetched ${nurses.length} nurses with addresses`);
    console.log(`✓ Fetched ${locations.length} locations with addresses`);

    // Step 4: Sync to database in the correct order
    console.log("\n=== Syncing to SQLite ===");

    // Sync locations first (new dependency)
    const locationCount = syncLocations(locations);
    console.log(`✓ Synced ${locationCount} locations`);

    // Sync nurses
    const nurseCount = syncNurses(nurses);
    console.log(`✓ Synced ${nurseCount} nurses`);

    // Sync patients
    const patientCount = syncPatients(patients);
    console.log(`✓ Synced ${patientCount} patients`);

    // Finally sync appointments (all dependencies should now exist)
    const appointmentCount = syncAppointments(appointments);
    console.log(`✓ Synced ${appointmentCount} appointments`);

    console.log("\n✅ Sync completed successfully with address support!");
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

// First, run the database migration to add address fields if needed
async function ensureAddressFieldsExist() {
  console.log("Checking database schema for address fields...");

  try {
    // Check if nurses table has address fields
    const nurseColumns = db.db.prepare("PRAGMA table_info(nurses)").all();
    const hasNurseAddress = nurseColumns.some((col) => col.name === "address");

    if (!hasNurseAddress) {
      console.log("Adding address fields to nurses table...");
      try {
        db.db.exec(`ALTER TABLE nurses ADD COLUMN address TEXT`);
        db.db.exec(`ALTER TABLE nurses ADD COLUMN lat REAL`);
        db.db.exec(`ALTER TABLE nurses ADD COLUMN lng REAL`);
        console.log("✓ Added address fields to nurses table");
      } catch (e) {
        console.log("Note: Could not add nurse address fields:", e.message);
      }
    }

    // Check if patients table has address fields
    const patientColumns = db.db.prepare("PRAGMA table_info(patients)").all();
    const hasPatientAddress = patientColumns.some(
      (col) => col.name === "address"
    );

    if (!hasPatientAddress) {
      console.log("Adding address fields to patients table...");
      try {
        db.db.exec(`ALTER TABLE patients ADD COLUMN address TEXT`);
        db.db.exec(`ALTER TABLE patients ADD COLUMN lat REAL`);
        db.db.exec(`ALTER TABLE patients ADD COLUMN lng REAL`);
        console.log("✓ Added address fields to patients table");
      } catch (e) {
        console.log("Note: Could not add patient address fields:", e.message);
      }
    }

    // Check if locations table exists
    const tables = db.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='locations'"
      )
      .all();

    if (tables.length === 0) {
      console.log("Creating locations table...");
      db.db.exec(`
        CREATE TABLE locations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          address TEXT,
          lat REAL,
          lng REAL,
          phone_number TEXT,
          type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✓ Created locations table");
    }

    // Check if appointments table has location_id
    const appointmentColumns = db.db
      .prepare("PRAGMA table_info(appointments)")
      .all();
    const hasLocationId = appointmentColumns.some(
      (col) => col.name === "location_id"
    );

    if (!hasLocationId) {
      console.log("Adding location_id to appointments table...");
      try {
        db.db.exec(
          `ALTER TABLE appointments ADD COLUMN location_id TEXT REFERENCES locations(id)`
        );
        console.log("✓ Added location_id to appointments table");
      } catch (e) {
        console.log("Note: Could not add location_id field:", e.message);
      }
    }
  } catch (error) {
    console.error("Error checking/updating schema:", error.message);
  }
}

// Main sync function - now uses _include to get everything in one request
async function syncFromHCHB() {
  console.log("=== Starting HCHB to SQLite Sync with Address Support ===\n");

  try {
    // Ensure database has address fields
    await ensureAddressFieldsExist();

    // Step 0: Clear existing data for fresh sync
    console.log("\nStep 0: Clearing existing data...");
    clearDatabase();
    console.log("✓ Database cleared\n");

    // Step 1: Fetch appointments WITH included resources (patients, nurses, locations)
    console.log(
      "Step 1: Fetching appointments with included resources from HCHB..."
    );
    const resources = await fetchAppointmentsFromHCHB();

    const appointments = resources.appointments;
    const patients = Array.from(resources.patients.values());
    const nurses = Array.from(resources.nurses.values());
    const locations = Array.from(resources.locations.values());

    console.log(`\n✓ Retrieved from HCHB API:`);
    console.log(`  - ${appointments.length} appointments`);
    console.log(`  - ${patients.length} patients (with addresses)`);
    console.log(`  - ${nurses.length} nurses (with addresses)`);
    console.log(`  - ${locations.length} locations (with addresses)`);

    // Step 2: Check for any missing references
    const missingPatientIds = [];
    const missingNurseIds = [];
    const missingLocationIds = [];

    for (const appt of appointments) {
      if (appt.patientId && !resources.patients.has(appt.patientId)) {
        missingPatientIds.push(appt.patientId);
      }
      if (appt.nurseId && !resources.nurses.has(appt.nurseId)) {
        missingNurseIds.push(appt.nurseId);
      }
      if (appt.locationId && !resources.locations.has(appt.locationId)) {
        missingLocationIds.push(appt.locationId);
      }
    }

    // Step 3: Fetch any missing resources (should be rare with _include)
    if (missingPatientIds.length > 0) {
      console.log(`\nFetching ${missingPatientIds.length} missing patients...`);
      const missingPatients = await fetchPatientsByIds(missingPatientIds);
      patients.push(...missingPatients);
    }

    if (missingNurseIds.length > 0) {
      console.log(`Fetching ${missingNurseIds.length} missing nurses...`);
      const missingNurses = await fetchNursesByIds(missingNurseIds);
      nurses.push(...missingNurses);
    }

    if (missingLocationIds.length > 0) {
      console.log(`Fetching ${missingLocationIds.length} missing locations...`);
      const missingLocations = await fetchLocationsByIds(missingLocationIds);
      locations.push(...missingLocations);
    }

    // Step 4: Sync to database in the correct order
    console.log("\n=== Syncing to SQLite ===");

    // Sync locations first (new dependency)
    const locationCount = syncLocations(locations);
    console.log(`✓ Synced ${locationCount} locations`);

    // Sync nurses - using custom sync to include addresses
    const nurseCount = syncNursesWithAddresses(nurses);
    console.log(`✓ Synced ${nurseCount} nurses`);

    // Sync patients - using custom sync to include addresses
    const patientCount = syncPatientsWithAddresses(patients);
    console.log(`✓ Synced ${patientCount} patients`);

    // Finally sync appointments - using custom sync to include location_id
    const appointmentCount = syncAppointmentsWithLocations(appointments);
    console.log(`✓ Synced ${appointmentCount} appointments`);

    console.log("\n✅ Sync completed successfully with full address support!");
    console.log(
      "   All addresses were fetched in the initial API call using _include!"
    );
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

// Custom sync functions that handle addresses
function syncLocations(locations) {
  try {
    const insertLocation = db.db.prepare(`
      INSERT OR REPLACE INTO locations
      (id, name, address, lat, lng, phone_number, type, updated_at)
      VALUES (@id, @name, @address, @lat, @lng, @phone_number, @type, CURRENT_TIMESTAMP)
    `);

    let count = 0;
    for (const location of locations) {
      try {
        insertLocation.run({
          id: location.id,
          name: location.name,
          address: location.address,
          lat: location.lat,
          lng: location.lng,
          phone_number: location.phoneNumber,
          type: location.type,
        });
        count++;
      } catch (error) {
        console.error(`Error syncing location ${location.id}:`, error.message);
      }
    }
    return count;
  } catch (error) {
    console.error("Error in location sync:", error.message);
    return 0;
  }
}

function syncNursesWithAddresses(nurses) {
  try {
    // Check if address columns exist
    const columns = db.db.prepare("PRAGMA table_info(nurses)").all();
    const hasAddress = columns.some((col) => col.name === "address");

    let insertStmt;
    if (hasAddress) {
      // Use statement with address fields
      insertStmt = db.db.prepare(`
        INSERT OR REPLACE INTO nurses 
        (id, name, title, specialty, phone_number, email, address, lat, lng, updated_at)
        VALUES (@id, @name, @title, @specialty, @phone_number, @email, @address, @lat, @lng, CURRENT_TIMESTAMP)
      `);
    } else {
      // Fall back to original statement without address
      insertStmt = db.statements.insertNurse;
    }

    let count = 0;
    for (const nurse of nurses) {
      try {
        if (hasAddress) {
          insertStmt.run({
            id: nurse.id,
            name: nurse.name,
            title: nurse.title,
            specialty: nurse.specialty,
            phone_number: nurse.phoneNumber,
            email: nurse.email,
            address: nurse.address,
            lat: nurse.lat,
            lng: nurse.lng,
          });
        } else {
          insertStmt.run({
            id: nurse.id,
            name: nurse.name,
            title: nurse.title,
            specialty: nurse.specialty,
            phone_number: nurse.phoneNumber,
            email: nurse.email,
          });
        }
        count++;
      } catch (error) {
        console.error(`Error syncing nurse ${nurse.id}:`, error.message);
      }
    }
    return count;
  } catch (error) {
    // Fall back to existing sync method
    console.log("Using fallback nurse sync without addresses");
    return db.nurses.sync(nurses);
  }
}

function syncPatientsWithAddresses(patients) {
  try {
    // Check if address columns exist
    const columns = db.db.prepare("PRAGMA table_info(patients)").all();
    const hasAddress = columns.some((col) => col.name === "address");

    let insertStmt;
    if (hasAddress) {
      // Use statement with address fields
      insertStmt = db.db.prepare(`
        INSERT OR REPLACE INTO patients 
        (id, name, phone_number, email, care_needs, medical_notes, address, lat, lng, updated_at)
        VALUES (@id, @name, @phone_number, @email, @care_needs, @medical_notes, @address, @lat, @lng, CURRENT_TIMESTAMP)
      `);
    } else {
      // Fall back to original statement without address
      insertStmt = db.statements.insertPatient;
    }

    let count = 0;
    for (const patient of patients) {
      try {
        if (hasAddress) {
          insertStmt.run({
            id: patient.id,
            name: patient.name,
            phone_number: patient.phoneNumber,
            email: patient.email,
            care_needs: JSON.stringify(patient.careNeeds || []),
            medical_notes: patient.medicalNotes,
            address: patient.address,
            lat: patient.lat,
            lng: patient.lng,
          });
        } else {
          insertStmt.run({
            id: patient.id,
            name: patient.name,
            phone_number: patient.phoneNumber,
            email: patient.email,
            care_needs: JSON.stringify(patient.careNeeds || []),
            medical_notes: patient.medicalNotes,
          });
        }
        count++;
      } catch (error) {
        console.error(`Error syncing patient ${patient.id}:`, error.message);
      }
    }
    return count;
  } catch (error) {
    // Fall back to existing sync method
    console.log("Using fallback patient sync without addresses");
    return db.patients.sync(patients);
  }
}

function syncAppointmentsWithLocations(appointments) {
  try {
    // Check if location_id column exists
    const columns = db.db.prepare("PRAGMA table_info(appointments)").all();
    const hasLocationId = columns.some((col) => col.name === "location_id");

    let insertStmt;
    if (hasLocationId) {
      // Use statement with location_id
      insertStmt = db.db.prepare(`
        INSERT OR REPLACE INTO appointments 
        (id, patient_id, nurse_id, location_id, start_time, end_time, status, notes, care_services, updated_at)
        VALUES (@id, @patient_id, @nurse_id, @location_id, @start_time, @end_time, @status, @notes, @care_services, CURRENT_TIMESTAMP)
      `);
    } else {
      // Fall back to original statement without location_id
      insertStmt = db.statements.insertAppointment;
    }

    let count = 0;
    for (const appointment of appointments) {
      try {
        if (hasLocationId) {
          insertStmt.run({
            id: appointment.id,
            patient_id: appointment.patientId,
            nurse_id: appointment.nurseId,
            location_id: appointment.locationId,
            start_time: appointment.startTime,
            end_time: appointment.endTime,
            status: appointment.status,
            notes: appointment.notes,
            care_services: JSON.stringify(appointment.careServices || []),
          });
        } else {
          insertStmt.run({
            id: appointment.id,
            patient_id: appointment.patientId,
            nurse_id: appointment.nurseId,
            start_time: appointment.startTime,
            end_time: appointment.endTime,
            status: appointment.status,
            notes: appointment.notes,
            care_services: JSON.stringify(appointment.careServices || []),
          });
        }
        count++;
      } catch (error) {
        console.error(
          `Error syncing appointment ${appointment.id}:`,
          error.message
        );
      }
    }
    return count;
  } catch (error) {
    // Fall back to existing sync method
    console.log("Using fallback appointment sync without locations");
    return db.appointments.sync(appointments);
  }
}

// Clear database function
function clearDatabase() {
  try {
    // Delete in reverse order of dependencies
    db.db.prepare("DELETE FROM appointments").run();
    db.db.prepare("DELETE FROM locations").run();
    db.db.prepare("DELETE FROM patients").run();
    db.db.prepare("DELETE FROM nurses").run();
  } catch (error) {
    console.error("Error clearing database:", error.message);
  }
}

// Fetch appointments from HCHB WITH included resources (like Python script)
async function fetchAppointmentsFromHCHB() {
  console.log("Fetching appointments with included resources from HCHB...");

  const token = await getToken();
  const allResources = {
    appointments: [],
    patients: new Map(),
    nurses: new Map(),
    locations: new Map(),
  };

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

  // Build parameters WITH _include like Python script
  const params = {
    _count: 50, // Fetch 50 per page
    _sort: "date",
    date: [
      `ge${startOfWeek.toISOString().split("T")[0]}`,
      `le${endOfWeek.toISOString().split("T")[0]}`,
    ],
    // Include related resources in the same request!
    _include: [
      "Appointment:patient",
      "Appointment:practitioner",
      "Appointment:location",
    ],
  };

  let pageCount = 0;
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

      // Process the bundle - it contains appointments AND included resources
      if (data.entry && data.entry.length > 0) {
        let appointmentCount = 0;
        let patientCount = 0;
        let nurseCount = 0;
        let locationCount = 0;

        for (const entry of data.entry) {
          const resource = entry.resource;
          const resourceType = resource.resourceType;

          switch (resourceType) {
            case "Appointment":
              allResources.appointments.push(transformAppointment(resource));
              appointmentCount++;
              break;

            case "Patient":
              if (!allResources.patients.has(resource.id)) {
                allResources.patients.set(
                  resource.id,
                  transformPatient(resource)
                );
                patientCount++;
              }
              break;

            case "Practitioner":
              if (!allResources.nurses.has(resource.id)) {
                allResources.nurses.set(resource.id, transformNurse(resource));
                nurseCount++;
              }
              break;

            case "Location":
              if (!allResources.locations.has(resource.id)) {
                allResources.locations.set(
                  resource.id,
                  transformLocation(resource)
                );
                locationCount++;
              }
              break;
          }
        }

        console.log(
          `  Page ${pageCount}: ${appointmentCount} appointments, ` +
            `${patientCount} patients, ${nurseCount} nurses, ${locationCount} locations`
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
    `\n  Total fetched: ${allResources.appointments.length} appointments, ` +
      `${allResources.patients.size} patients, ${allResources.nurses.size} nurses, ` +
      `${allResources.locations.size} locations`
  );

  return allResources;
}

// Fetch specific patients by IDs (with address extraction)
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
        const transformedPatients = data.entry.map((entry) =>
          transformPatient(entry.resource)
        );
        patients.push(...transformedPatients);
      }
    } catch (error) {
      console.error(`Error fetching patient batch:`, error.message);
    }
  }

  console.log(`  Successfully fetched ${patients.length} patients`);
  return patients;
}

// Fetch specific nurses by IDs (with address extraction)
async function fetchNursesByIds(nurseIds) {
  if (nurseIds.length === 0) return [];

  console.log(`\nFetching ${nurseIds.length} specific nurses from HCHB...`);
  const token = await getToken();
  const nurses = [];

  // Batch requests
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
        const transformedNurses = data.entry.map((entry) =>
          transformNurse(entry.resource)
        );
        nurses.push(...transformedNurses);
      }
    } catch (error) {
      console.error(`Error fetching nurse batch:`, error.message);
    }
  }

  console.log(`  Successfully fetched ${nurses.length} nurses`);
  return nurses;
}

// Fetch specific locations by IDs (new function for address support)
async function fetchLocationsByIds(locationIds) {
  if (locationIds.length === 0) return [];

  console.log(
    `\nFetching ${locationIds.length} specific locations from HCHB...`
  );
  const token = await getToken();
  const locations = [];

  // Batch requests
  const batchSize = 50;

  for (let i = 0; i < locationIds.length; i += batchSize) {
    const batch = locationIds.slice(i, i + batchSize);
    const idString = batch.join(",");

    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/Location`, {
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
        const transformedLocations = data.entry.map((entry) =>
          transformLocation(entry.resource)
        );
        locations.push(...transformedLocations);
      }
    } catch (error) {
      console.error(`Error fetching location batch:`, error.message);
    }
  }

  console.log(`  Successfully fetched ${locations.length} locations`);
  return locations;
}

// Export functions
module.exports = {
  syncFromHCHB,
  extractAddress,
  extractCoordinates,
};

// Run if called directly
if (require.main === module) {
  syncFromHCHB()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
