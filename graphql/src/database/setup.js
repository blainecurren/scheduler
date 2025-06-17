// graphql/src/database/setup.js
// Fixed version - statements created after tables

const Database = require("better-sqlite3");
const path = require("path");

// Create database file in the graphql directory
const dbPath = path.join(__dirname, "../../nurse-scheduler.db");
console.log("Database path:", dbPath);

// Create or open database
const db = new Database(dbPath, {
  verbose: console.log, // This will log all SQL queries - remove in production
});

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Create tables
function createTables() {
  console.log("Creating database tables...");

  try {
    // 1. Nurses table
    db.exec(`
      CREATE TABLE IF NOT EXISTS nurses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        specialty TEXT,
        phone_number TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Nurses table created");

    // 2. Patients table
    db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone_number TEXT,
        email TEXT,
        care_needs TEXT,
        medical_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Patients table created");

    // 3. Appointments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        nurse_id TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        status TEXT DEFAULT 'SCHEDULED',
        notes TEXT,
        care_services TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (nurse_id) REFERENCES nurses(id)
      )
    `);
    console.log("✓ Appointments table created");

    // 4. Create indexes for better performance
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(start_time)`
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_appointments_nurse ON appointments(nurse_id)`
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id)`
    );
    db.exec(`CREATE INDEX IF NOT EXISTS idx_nurses_name ON nurses(name)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name)`);
    console.log("✓ Indexes created");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
}

// Test the database with some sample operations
function testDatabase() {
  console.log("\nTesting database operations...");

  try {
    // Test insert
    const insertTest = db.prepare(
      "INSERT INTO nurses (id, name, title) VALUES (?, ?, ?)"
    );
    const result = insertTest.run("test-nurse-1", "Test Nurse", "RN");
    console.log("✓ Insert test passed:", result.changes, "row(s) affected");

    // Test select
    const selectTest = db.prepare("SELECT * FROM nurses WHERE id = ?");
    const nurse = selectTest.get("test-nurse-1");
    console.log("✓ Select test passed:", nurse);

    // Test update
    const updateTest = db.prepare(
      "UPDATE nurses SET specialty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    );
    updateTest.run("Pediatrics", "test-nurse-1");
    console.log("✓ Update test passed");

    // Test select again to see the update
    const updatedNurse = selectTest.get("test-nurse-1");
    console.log("✓ Updated nurse:", {
      id: updatedNurse.id,
      specialty: updatedNurse.specialty,
    });

    // Clean up test data
    const deleteTest = db.prepare("DELETE FROM nurses WHERE id = ?");
    deleteTest.run("test-nurse-1");
    console.log("✓ Delete test passed");

    console.log("\n✅ All database tests passed!");
  } catch (error) {
    console.error("❌ Database test failed:", error);
    throw error;
  }
}

// Check if tables exist
function checkTables() {
  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN ('nurses', 'patients', 'appointments')
  `
    )
    .all();

  console.log(
    "\nExisting tables:",
    tables.map((t) => t.name)
  );
  return tables.length === 3;
}

// Create prepared statements (call this AFTER tables are created)
function createPreparedStatements() {
  return {
    // Nurses
    insertNurse: db.prepare(`
      INSERT OR REPLACE INTO nurses 
      (id, name, title, specialty, phone_number, email, updated_at)
      VALUES (@id, @name, @title, @specialty, @phone_number, @email, CURRENT_TIMESTAMP)
    `),

    getNurse: db.prepare("SELECT * FROM nurses WHERE id = ?"),
    getAllNurses: db.prepare("SELECT * FROM nurses ORDER BY name"),

    // Patients
    insertPatient: db.prepare(`
      INSERT OR REPLACE INTO patients 
      (id, name, phone_number, email, care_needs, medical_notes, updated_at)
      VALUES (@id, @name, @phone_number, @email, @care_needs, @medical_notes, CURRENT_TIMESTAMP)
    `),

    getPatient: db.prepare("SELECT * FROM patients WHERE id = ?"),
    getAllPatients: db.prepare("SELECT * FROM patients ORDER BY name"),

    // Appointments
    insertAppointment: db.prepare(`
      INSERT OR REPLACE INTO appointments 
      (id, patient_id, nurse_id, start_time, end_time, status, notes, care_services, updated_at)
      VALUES (@id, @patient_id, @nurse_id, @start_time, @end_time, @status, @notes, @care_services, CURRENT_TIMESTAMP)
    `),

    getAppointment: db.prepare("SELECT * FROM appointments WHERE id = ?"),
    getAppointmentsByDate: db.prepare(`
      SELECT * FROM appointments 
      WHERE date(start_time) = date(?) 
      ORDER BY start_time
    `),
  };
}

// Main setup function
function setupDatabase() {
  console.log("=== Setting up SQLite Database ===\n");

  try {
    // Check if tables already exist
    const tablesExist = checkTables();

    if (!tablesExist) {
      createTables();
    } else {
      console.log("Tables already exist, skipping creation");
    }

    // Run tests
    testDatabase();

    // Show database info
    console.log("\n=== Database Info ===");
    console.log("Database file:", dbPath);
    const version = db.prepare("SELECT sqlite_version() as version").get();
    console.log("SQLite version:", version.version);

    // Show table counts
    if (checkTables()) {
      const nurseCount = db
        .prepare("SELECT COUNT(*) as count FROM nurses")
        .get();
      const patientCount = db
        .prepare("SELECT COUNT(*) as count FROM patients")
        .get();
      const appointmentCount = db
        .prepare("SELECT COUNT(*) as count FROM appointments")
        .get();

      console.log("\nTable counts:");
      console.log(`  - Nurses: ${nurseCount.count}`);
      console.log(`  - Patients: ${patientCount.count}`);
      console.log(`  - Appointments: ${appointmentCount.count}`);
    }

    // Create prepared statements after tables exist
    const statements = createPreparedStatements();
    console.log("\n✓ Prepared statements created");

    return { db, statements };
  } catch (error) {
    console.error("Database setup failed:", error);
    throw error;
  }
}

// Export for use in other modules
module.exports = {
  db,
  setupDatabase,
  createPreparedStatements,
};

// Run setup if this file is executed directly
if (require.main === module) {
  const result = setupDatabase();
  console.log(
    "\n✨ Database setup complete! You can now use the database in your application."
  );
  // Don't close the db here as we might want to export it
}
