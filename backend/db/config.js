// backend/db/config.js
// Simple database setup with single appointments table

const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const { sqliteTable, text, integer, real } = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');
const path = require('path');

// Database path
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'nurse-scheduler.db');

// Create database connection
const sqlite = new Database(DB_PATH);

// Optimize SQLite settings
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('temp_store = MEMORY');

// ===================
// SCHEMA DEFINITION
// ===================

const appointments = sqliteTable('appointments', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  fhirId: text('fhir_id'), // Store HCHB's ID as reference
  patientId: text('patient_id'),
  patientName: text('patient_name'),
  nurseId: text('nurse_id'),
  nurseName: text('nurse_name'),
  startDate: text('start_date'),
  status: text('status'),
  serviceType: text('service_type'),
  serviceCode: text('service_code'),
  locationId: text('location_id'),
  locationName: text('location_name'),
  locationAddress: text('location_address'), // Full address string
  locationLatitude: real('location_latitude'), // Decimal coordinates
  locationLongitude: real('location_longitude'), // Decimal coordinates
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Create Drizzle instance
const db = drizzle(sqlite, { schema: { appointments } });

// ===================
// DATABASE FUNCTIONS
// ===================

function initializeDatabase() {
  console.log('🗄️  Initializing database...');
  
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fhir_id TEXT,
        patient_id TEXT,
        patient_name TEXT,
        nurse_id TEXT,
        nurse_name TEXT,
        start_date TEXT,
        status TEXT,
        service_type TEXT,
        service_code TEXT,
        location_id TEXT,
        location_name TEXT,
        location_address TEXT,
        location_latitude REAL,
        location_longitude REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_appointments_fhir_id ON appointments(fhir_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(start_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_nurse ON appointments(nurse_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_location ON appointments(location_id);
    `);
    
    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

function clearDatabase() {
  try {
    // Clear all appointment data but keep the ID counter growing
    const result = sqlite.prepare('DELETE FROM appointments').run();
    console.log(`🗑️  Cleared ${result.changes} appointments from database`);
    console.log(`📊 Next appointments will start at ID ${getNextId()}`);
    
    return result.changes;
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
    throw error;
  }
}

function getNextId() {
  try {
    const result = sqlite.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get('appointments');
    return result ? result.seq + 1 : 1;
  } catch (error) {
    return 1; // First run, no sequence table yet
  }
}

function closeDatabase() {
  sqlite.close();
}

module.exports = {
  db,
  sqlite,
  appointments,
  initializeDatabase,
  clearDatabase,
  getNextId,
  closeDatabase,
};