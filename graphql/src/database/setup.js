const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "../../nurse-scheduler.db");
console.log("Database path: ", dbPath);

// Create or open DB
const db = new Database(dbPath, {
  verbose: console.log, // remove in production
});

db.pragma("foreign_keys = ON");

function createTables() {
  console.log("Creating database tables...");

  // Nurse Table
  db.exec(`
        CREATE TABLE IF NOT EXISTS nurses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        specialty TEXT,
        phone_number TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        `);
  console.log("Nurses table created");

  // Patients Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone_number TEXT,
      email TEXT,
      care_needs TEXT, -- Will store as JSON string
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
      care_services TEXT, -- Will store as JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (nurse_id) REFERENCES nurses(id)
    )
  `);
  console.log("✓ Appointments table created");

  // 4. Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(start_time);
    CREATE INDEX IF NOT EXISTS idx_appointments_nurse ON appointments(nurse_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_nurses_name ON nurses(name);
    CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
  `);
  console.log("✓ Indexes created");

  // 5. Create triggers to update the updated_at timestamp
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_nurses_timestamp 
    AFTER UPDATE ON nurses
    BEGIN
      UPDATE nurses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_patients_timestamp 
    AFTER UPDATE ON patients
    BEGIN
      UPDATE patients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_appointments_timestamp 
    AFTER UPDATE ON appointments
    BEGIN
      UPDATE appointments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
  console.log("✓ Triggers created");
}

function testDatabase() {
  console.log("\nTesting database operations");

  try {
    // Test Insert
    const insertTest = db.prepare(
      "INSERT INTO nurses (id, name, title) VALUES (?, ?, ?)"
    );
    const result = insertTest.run("test-nurse-1", "Test Nurse", "RN");
    console.log("Insert Test Passed:", result.changes, "row(s) affected");

    // Test select
    const selectTest = db.prepare("SELECT * FROM nurses WHERE id = ?");
    const nurse = selectTest.get("test-nurse-1");
    console.log("Select Test Passed:", nurse);

    //Test Update
    const updateTest = db.prepare(
      "UPDATE nurses SET specialty = ? WHERE id = ?"
    );
    updateTest.run("Pediatrics", "test-nurse-1");
    console.log("Update test passed");

    const deleteTest = db.prepare("DELETE FROM nurses WHERE id = ?");
    deleteTest.run("test-nurse-1");
    console.log("Delete Test passed");

    console.log("\n All database tests passed");
  } catch (error) {
    console.error("Database test failed:", error);
  }
}

// Check if table exists
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
    "\nExisting Tables:",
    tables.map((t) => t.name)
  );
  return tables.length === 3;
}

// Main setup
function setupDatabase() {
  console.log("=== Setting up SQLite Database ===\n");

  try {
    const tableExist = checkTables();

    if (!tablesExist) {
      createTables();
    } else {
      console.log("Tables already exist, skipping creation");
    }
    // Run Tests
    testDatabase();

    // Show DB info
    console.log("\n=== Database Info ===");
    console.log("Database file:", dbPath);
    console.log(
      "SQLite version:",
      db.prepare("SELECT sqlite_version()").get()["sqlite_version()"]
    );

    return db;
  } catch (error) {
    console.error("Database setup failed:", error);
    throw error;
  }
}

// Export
module.exports = {
  db,
  setupDatabase,
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
  console.log(
    "\nDatabase setup complete! You can now use the database in your application."
  );
  db.close();
}
