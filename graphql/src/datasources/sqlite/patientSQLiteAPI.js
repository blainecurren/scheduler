// graphql/src/datasources/sqlite/patientSQLiteAPI.js
const { DataSource } = require("apollo-datasource");
const db = require("../../database/db");

class PatientSQLiteAPI extends DataSource {
  constructor() {
    super();
  }

  initialize(config) {
    this.context = config.context;
  }

  async getPatients() {
    try {
      console.log("[SQLite] Fetching all patients from database...");
      const patients = db.patients.getAll();
      console.log(`[SQLite] Found ${patients.length} patients in database`);
      return patients;
    } catch (error) {
      console.error("[SQLite] Error fetching patients:", error);
      throw error;
    }
  }

  async getPatientById(id) {
    try {
      console.log(`[SQLite] Fetching patient with ID: ${id}`);
      const patient = db.patients.get(id);

      if (!patient) {
        console.log(`[SQLite] Patient ${id} not found`);
        return null;
      }

      return patient;
    } catch (error) {
      console.error(`[SQLite] Error fetching patient ${id}:`, error);
      throw error;
    }
  }
}

module.exports = PatientSQLiteAPI;
