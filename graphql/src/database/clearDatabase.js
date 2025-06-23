// clearDatabase.js
const db = require("./db");

function clearDatabase() {
  console.log("=== Clearing Database ===\n");

  try {
    if (db.db) {
      // Clear appointments
      console.log("Clearing appointments table...");
      const appointmentResult = db.db.prepare("DELETE FROM appointments").run();
      console.log(`✓ Deleted ${appointmentResult.changes} appointments`);

      // Clear nurses
      console.log("\nClearing nurses table...");
      const nurseResult = db.db.prepare("DELETE FROM nurses").run();
      console.log(`✓ Deleted ${nurseResult.changes} nurses`);

      // Clear patients
      console.log("\nClearing patients table...");
      const patientResult = db.db.prepare("DELETE FROM patients").run();
      console.log(`✓ Deleted ${patientResult.changes} patients`);

      console.log("\n✅ Database cleared successfully!");
    } else {
      console.error("❌ Could not access database directly.");
    }
  } catch (error) {
    console.error("❌ Error clearing database:", error.message);
    process.exit(1);
  }
}

// Run the clear function
clearDatabase();
