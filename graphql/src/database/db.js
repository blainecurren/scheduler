const Database = require("better-sqlite3");
const path = require("path");

// Open existing DB
const dbPath = path.join(__dirname, "../../nurse-scheduler.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

const statements = {
  // Nurses
  insertNurse: db.prepare(`
        INSERT OR REPLACE INTO nurses 
    (id, name, title, specialty, phone_number, email, updated_at)
    VALUES (@id, @name, @title, @specialty, @phone_number, @email, CURRENT_TIMESTAMP)
        `),

  getNurse: db.prepare("SELECT * FROM nurses WHERE id = ?"),
  getAllNurses: db.prepare("SELECT * FROM nurses ORDER BY name"),
  getNursesBySpecialty: db.prepare(
    "SELECT * FROM nurses WHERE specialty = ? ORDER BY name"
  ),

  // Patients
  insertPatient: db.prepare(`INSERT OR REPLACE INTO patients
        (id, name, phone_number, email, care_needs, medical_notes, updated_at)
        VALUES (@id, @name, @phone_number, @email, @care_needs, @medical_notes, CURRENT_TIMESTAMP)`),

  getPatient: db.prepare("SELECT * FROM patients WHERE id = ?"),
  getAllPatients: db.prepare("SELECT * FROM patients ORDER BY name"),

  // Appointments
  insertAppointment: db.prepare(`
        INSERT OR REPLACE INTO appointments (id, patient_id, nurse_id, start_time, end_time, status, notes, care_services, updated_at) VALUES (@id, @patient_id, @nurse_id, @start_time, @end_time, @status, @notes, @care_services, CURRENT_TIMESTAMP)
        `),

  getAppointment: db.prepare("SELECT * FROM appointments WHERE id = ?"),
  getAppointmentsByDate: db.prepare(`
    SELECT * FROM appointments 
    WHERE date(start_time) = date(?) 
    ORDER BY start_time
  `),
  getAppointmentsByNurse: db.prepare(`
    SELECT * FROM appointments 
    WHERE nurse_id = ? 
    ORDER BY start_time
  `),
  getAppointmentsByPatient: db.prepare(`
    SELECT * FROM appointments 
    WHERE patient_id = ? 
    ORDER BY start_time
  `),
  getAppointmentsByDateAndNurse: db.prepare(`
    SELECT * FROM appointments 
    WHERE date(start_time) = date(?) AND nurse_id = ?
    ORDER BY start_time
  `),
};

// Transaction helpers
const transaction = {
  syncNurses: db.transaction((nurses) => {
    for (const nurse of nurses) {
      statements.insertNurse.run({
        id: nurse.id,
        name: nurse.name,
        title: nurse.title,
        specialty: nurse.specialty,
        phone_number: nurse.phoneNumber,
        email: nurse.email,
      });
    }

    return nurses.length;
  }),

  syncPatients: db.transaction((patients) => {
    for (const patient of patients) {
      statements.insertPatient.run({
        id: patient.id,
        name: patient.name,
        phone_number: patient.phoneNumber,
        email: patient.email,
        care_needs: JSON.stringify(patient.careNeeds || []),
        medical_notes: patient.medicalNotes,
      });
    }

    return patients.length;
  }),

  syncAppointments: db.transaction((appointments) => {
    let successCount = 0;
    let failedAppointments = [];

    // Get all valid patient and nurse IDs
    const validPatientIds = new Set(
      db
        .prepare("SELECT id FROM patients")
        .all()
        .map((p) => p.id)
    );
    const validNurseIds = new Set(
      db
        .prepare("SELECT id FROM nurses")
        .all()
        .map((n) => n.id)
    );

    for (const appointment of appointments) {
      // Check if patient and nurse exist
      if (!validPatientIds.has(appointment.patientId)) {
        failedAppointments.push({
          appointment,
          error: `Patient ID ${appointment.patientId} not found`,
        });
        console.error(
          `Skipping appointment ${appointment.id}: Patient ${appointment.patientId} not found`
        );
        continue;
      }

      if (!validNurseIds.has(appointment.nurseId)) {
        failedAppointments.push({
          appointment,
          error: `Nurse ID ${appointment.nurseId} not found`,
        });
        console.error(
          `Skipping appointment ${appointment.id}: Nurse ${appointment.nurseId} not found`
        );
        continue;
      }

      try {
        statements.insertAppointment.run({
          id: appointment.id,
          patient_id: appointment.patientId,
          nurse_id: appointment.nurseId,
          start_time: appointment.startTime,
          end_time: appointment.endTime,
          status: appointment.status,
          notes: appointment.notes,
          care_services: JSON.stringify(appointment.careServices || []),
        });
        successCount++;
      } catch (error) {
        failedAppointments.push({
          appointment,
          error: error.message,
        });
        console.error(
          `Failed to insert appointment ${appointment.id}:`,
          error.message
        );
      }
    }

    if (failedAppointments.length > 0) {
      console.log(`Successfully synced ${successCount} appointments`);
      console.log(`Failed to sync ${failedAppointments.length} appointments`);
      console.log("First failed appointments:", failedAppointments.slice(0, 5));
    }

    return successCount;
  }),
};

// Helper functions
function transformNurseFromDb(dbNurse) {
  if (!dbNurse) return null;

  return {
    id: dbNurse.id,
    name: dbNurse.name,
    title: dbNurse.title,
    specialty: dbNurse.specialty,
    phoneNumber: dbNurse.phone_number,
    email: dbNurse.email,
    location: null, // Will be resolved separately
    appointments: null, // Will be resolved by GraphQL
    availability: null,
  };
}

function transformPatientFromDb(dbPatient) {
  if (!dbPatient) return null;

  return {
    id: dbPatient.id,
    name: dbPatient.name,
    phoneNumber: dbPatient.phone_number,
    email: dbPatient.email,
    careNeeds: dbPatient.care_needs ? JSON.parse(dbPatient.care_needs) : [],
    medicalNotes: dbPatient.medical_notes,
    location: null, // Will be resolved separately
    appointments: null, // Will be resolved by GraphQL
  };
}

function transformAppointmentFromDb(dbAppointment) {
  if (!dbAppointment) return null;

  return {
    id: dbAppointment.id,
    patientId: dbAppointment.patient_id,
    nurseId: dbAppointment.nurse_id,
    startTime: dbAppointment.start_time,
    endTime: dbAppointment.end_time,
    status: dbAppointment.status,
    notes: dbAppointment.notes,
    careServices: dbAppointment.care_services
      ? JSON.parse(dbAppointment.care_services)
      : [],
    location: null,
    patient: null, // Will be resolved by GraphQL
    nurse: null, // Will be resolved by GraphQL
  };
}

// Export everything
module.exports = {
  db,
  statements,
  transaction,
  transformNurseFromDb,
  transformPatientFromDb,
  transformAppointmentFromDb,

  nurses: {
    get: (id) => transformNurseFromDb(statements.getNurse.get(id)),
    getAll: () => statements.getAllNurses.all().map(transformNurseFromDb),
    getBySpecialty: (specialty) =>
      statements.getNursesBySpecialty.all(specialty).map(transformNurseFromDb),
    sync: transaction.syncNurses,
  },

  patients: {
    get: (id) => transformPatientFromDb(statements.getPatient.get(id)),
    getAll: () => statements.getAllPatients.all().map(transformPatientFromDb),
    sync: transaction.syncPatients,
  },

  appointments: {
    get: (id) => transformAppointmentFromDb(statements.getAppointment.get(id)),
    getByDate: (date) =>
      statements.getAppointmentsByDate
        .all(date)
        .map(transformAppointmentFromDb),
    getByNurse: (nurseId) =>
      statements.getAppointmentsByNurse
        .all(nurseId)
        .map(transformAppointmentFromDb),
    getByPatient: (patientId) =>
      statements.getAppointmentsByPatient
        .all(patientId)
        .map(transformAppointmentFromDb),
    getByDateAndNurse: (date, nurseId) =>
      statements.getAppointmentsByDateAndNurse
        .all(date, nurseId)
        .map(transformAppointmentFromDb),
    sync: transaction.syncAppointments,
  },
};
