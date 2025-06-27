// backend/db/config.js
// Simple database setup with single appointments table

const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const { sqliteTable, text } = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');
const path = require('path');

// Database path - defaults to backend/db folder
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'nurse-scheduler.db');

// Create database connection
const sqlite = new Database(DB_PATH);

// Optimize SQLite settings
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL');

// ===================
// SCHEMA DEFINITION
// ===================

// Single appointments table with embedded data
const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey(), // FHIR Appointment ID
  nurseId: text('nurse_id'),
  nurseName: text('nurse_name'),
  patientId: text('patient_id'),
  patientName: text('patient_name'),
  startTime: text('start_time'), // ISO datetime
  endTime: text('end_time'), // ISO datetime
  status: text('status'),
  careServices: text('care_services'), // JSON string
  locationId: text('location_id'),
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
        id TEXT PRIMARY KEY,
        nurse_id TEXT,
        nurse_name TEXT,
        patient_id TEXT,
        patient_name TEXT,
        start_time TEXT,
        end_time TEXT,
        status TEXT,
        care_services TEXT,
        location_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(start_time);
      CREATE INDEX IF NOT EXISTS idx_appointments_nurse ON appointments(nurse_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
    `);

    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
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
  closeDatabase,
};