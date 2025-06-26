// db-status.js - Save this in the graphql directory
const db = require("./src/database/db");

console.log("=== Database Status ===\n");

try {
  const nurses = db.nurses.getAll();
  const patients = db.patients.getAll();
  const today = new Date().toISOString().split("T")[0];
  const todayAppointments = db.appointments.getByDate(today);

  console.log(`Nurses: ${nurses.length}`);
  console.log(`Patients: ${patients.length}`);
  console.log(`Appointments today (${today}): ${todayAppointments.length}`);

  if (nurses.length > 0) {
    console.log("\nSample nurse:", nurses[0]);
  }

  if (patients.length > 0) {
    console.log("\nSample patient:", patients[0]);
  }

  if (todayAppointments.length > 0) {
    console.log("\nSample appointment:", todayAppointments[0]);
  }

  console.log("\n✅ Database connection successful");
} catch (error) {
  console.error("❌ Database error:", error.message);
}
