// graphql/src/datasources/sqlite/nurseSQLiteAPI.js
const { DataSource } = require("apollo-datasource");
const db = require("../../database/db");

class NurseSQLiteAPI extends DataSource {
  constructor() {
    super();
  }

  initialize(config) {
    this.context = config.context;
  }

  async getNurses() {
    try {
      console.log("[SQLite] Fetching all nurses from database...");
      const nurses = db.nurses.getAll();
      console.log(`[SQLite] Found ${nurses.length} nurses in database`);
      return nurses;
    } catch (error) {
      console.error("[SQLite] Error fetching nurses:", error);
      throw error;
    }
  }

  async getNurseById(id) {
    try {
      console.log(`[SQLite] Fetching nurse with ID: ${id}`);
      const nurse = db.nurses.get(id);

      if (!nurse) {
        console.log(`[SQLite] Nurse ${id} not found`);
        return null;
      }

      return nurse;
    } catch (error) {
      console.error(`[SQLite] Error fetching nurse ${id}:`, error);
      throw error;
    }
  }

  async getNursesBySpecialty(specialty) {
    try {
      console.log(`[SQLite] Fetching nurses with specialty: ${specialty}`);
      const nurses = db.nurses.getBySpecialty(specialty);
      console.log(
        `[SQLite] Found ${nurses.length} nurses with specialty ${specialty}`
      );
      return nurses;
    } catch (error) {
      console.error(`[SQLite] Error fetching nurses by specialty:`, error);
      throw error;
    }
  }
}

module.exports = NurseSQLiteAPI;
