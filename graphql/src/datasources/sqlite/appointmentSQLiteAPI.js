// graphql/src/datasources/sqlite/appointmentSQLiteAPI.js
const { DataSource } = require("apollo-datasource");
const db = require("../../database/db");

class AppointmentSQLiteAPI extends DataSource {
  constructor() {
    super();
  }

  initialize(config) {
    this.context = config.context;
  }

  async getAppointments({ date, nurseId, patientId }) {
    try {
      console.log("[SQLite] Fetching appointments with filters:", {
        date,
        nurseId,
        patientId,
      });

      let appointments;

      if (date && nurseId) {
        appointments = db.appointments.getByDateAndNurse(date, nurseId);
      } else if (date) {
        appointments = db.appointments.getByDate(date);
      } else if (nurseId) {
        appointments = db.appointments.getByNurse(nurseId);
      } else if (patientId) {
        appointments = db.appointments.getByPatient(patientId);
      } else {
        // Get all appointments for today if no filters
        const today = new Date().toISOString().split("T")[0];
        appointments = db.appointments.getByDate(today);
      }

      console.log(`[SQLite] Found ${appointments.length} appointments`);
      return appointments;
    } catch (error) {
      console.error("[SQLite] Error fetching appointments:", error);
      throw error;
    }
  }

  async getAppointmentById(id) {
    try {
      console.log(`[SQLite] Fetching appointment with ID: ${id}`);
      const appointment = db.appointments.get(id);

      if (!appointment) {
        console.log(`[SQLite] Appointment ${id} not found`);
        return null;
      }

      return appointment;
    } catch (error) {
      console.error(`[SQLite] Error fetching appointment ${id}:`, error);
      throw error;
    }
  }

  async createAppointment(input) {
    // To be implemented
    throw new Error("Not implemented");
  }

  async updateAppointment(id, input) {
    // To be implemented
    throw new Error("Not implemented");
  }

  async cancelAppointment(id, reason) {
    // To be implemented
    throw new Error("Not implemented");
  }
}

module.exports = AppointmentSQLiteAPI;
