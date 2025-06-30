// backend/db/config.js
// Updated database schema for address/coordinate separation

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
  
  // Patient info
  patientId: text('patient_id'),
  patientName: text('patient_name'),
  
  // Nurse info
  nurseId: text('nurse_id'),
  nurseName: text('nurse_name'),
  
  // Nurse location info (populated by coordinate service)
  nurseLocationName: text('nurse_location_name'),           // Nurse name (for display)
  nurseLocationAddress: text('nurse_location_address'),     // Full address string (for geocoding)
  nurseLocationLatitude: real('nurse_location_latitude'),   // Populated by Azure Maps
  nurseLocationLongitude: real('nurse_location_longitude'), // Populated by Azure Maps
  
  // Appointment details
  startDate: text('start_date'),
  status: text('status'),
  serviceType: text('service_type'),
  serviceCode: text('service_code'),
  
  // Patient service location (from HCHB, already has coordinates)
  locationId: text('location_id'),
  locationName: text('location_name'),
  locationAddress: text('location_address'),
  locationLatitude: real('location_latitude'),
  locationLongitude: real('location_longitude'),
  
  // Timestamps
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
        
        -- Patient info
        patient_id TEXT,
        patient_name TEXT,
        
        -- Nurse info
        nurse_id TEXT,
        nurse_name TEXT,
        
        -- Nurse location (address stored for geocoding, coordinates populated separately)
        nurse_location_name TEXT,
        nurse_location_address TEXT,
        nurse_location_latitude REAL,
        nurse_location_longitude REAL,
        
        -- Appointment details
        start_date TEXT,
        status TEXT,
        service_type TEXT,
        service_code TEXT,
        
        -- Patient service location (from HCHB)
        location_id TEXT,
        location_name TEXT,
        location_address TEXT,
        location_latitude REAL,
        location_longitude REAL,
        
        -- Timestamps
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for better performance
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_appointments_nurse_id ON appointments(nurse_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_nurse_name ON appointments(nurse_name);
      CREATE INDEX IF NOT EXISTS idx_appointments_start_date ON appointments(start_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
      CREATE INDEX IF NOT EXISTS idx_appointments_nurse_address ON appointments(nurse_location_address);
      CREATE INDEX IF NOT EXISTS idx_appointments_nurse_coords ON appointments(nurse_location_latitude, nurse_location_longitude);
    `);
    
    console.log('✅ Database initialized successfully');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

function clearDatabase() {
  try {
    const result = sqlite.exec('DELETE FROM appointments');
    const deletedCount = sqlite.prepare('SELECT changes()').get();
    console.log(`🗑️  Cleared ${deletedCount.changes || 0} existing appointments`);
    return deletedCount.changes || 0;
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    return 0;
  }
}

// ===================
// UTILITY FUNCTIONS
// ===================

function getDbStats() {
  try {
    const stats = sqlite.prepare(`
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN nurse_location_address IS NOT NULL AND nurse_location_address != '' THEN 1 END) as with_nurse_address,
        COUNT(CASE WHEN nurse_location_latitude IS NOT NULL AND nurse_location_longitude IS NOT NULL THEN 1 END) as with_nurse_coords,
        COUNT(CASE WHEN location_latitude IS NOT NULL AND location_longitude IS NOT NULL THEN 1 END) as with_patient_coords,
        COUNT(DISTINCT nurse_name) as unique_nurses
      FROM appointments
    `).get();
    
    return stats;
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    return null;
  }
}

// ===================
// EXPORTS
// ===================

module.exports = {
  db,
  appointments,
  sqlite,
  initializeDatabase,
  clearDatabase,
  getDbStats
};