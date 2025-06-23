// viewDatabase.js
const db = require("./db");

// Option 1: Create a simple viewer script
function viewAppointments() {
  console.log("=== Viewing Database Contents ===\n");

  // If your db module has a query method
  try {
    // Try different possible methods your db module might have:

    // Method 1: If there's a getAll method (even though it errored before)
    if (typeof db.appointments.getAll === "function") {
      const appointments = db.appointments.getAll();
      console.log(`Found ${appointments.length} appointments:\n`);
      appointments.forEach((apt, index) => {
        console.log(`${index + 1}. Appointment ${apt.id}:`);
        console.log(`   Patient ID: ${apt.patientId}`);
        console.log(`   Nurse ID: ${apt.nurseId}`);
        console.log(`   Start: ${apt.startTime}`);
        console.log(`   Status: ${apt.status}`);
        console.log("---");
      });
    }

    // Method 2: If there's a query method
    else if (typeof db.appointments.query === "function") {
      const appointments = db.appointments.query();
      console.log(appointments);
    }

    // Method 3: If there's a find method
    else if (typeof db.appointments.find === "function") {
      const appointments = db.appointments.find({});
      console.log(appointments);
    }

    // Method 4: Direct SQL query (if db exposes raw query method)
    else if (typeof db.query === "function") {
      const appointments = db.query("SELECT * FROM appointments");
      console.log(appointments);
    } else {
      console.log("Could not find a method to retrieve appointments.");
      console.log("Available methods on db.appointments:");
      console.log(Object.getOwnPropertyNames(db.appointments));
    }
  } catch (error) {
    console.error("Error viewing appointments:", error);
  }
}

// Run the viewer
viewAppointments();

// === Alternative: Using SQLite CLI commands ===
/*
You can also use SQLite command line tools:

1. Find your SQLite database file (usually has .db or .sqlite extension)
   Look in your project directory for files like:
   - database.db
   - scheduler.db
   - appointments.sqlite
   
2. Open it with sqlite3:
   $ sqlite3 database.db

3. View all tables:
   sqlite> .tables

4. View appointments table schema:
   sqlite> .schema appointments

5. View all appointments:
   sqlite> SELECT * FROM appointments;

6. Pretty print:
   sqlite> .mode column
   sqlite> .headers on
   sqlite> SELECT * FROM appointments;

7. Export to CSV:
   sqlite> .mode csv
   sqlite> .output appointments.csv
   sqlite> SELECT * FROM appointments;
   sqlite> .output stdout
*/

// === Alternative: Using a GUI tool ===
/*
GUI Tools for viewing SQLite databases:
1. DB Browser for SQLite (https://sqlitebrowser.org/)
2. TablePlus
3. DBeaver
4. VSCode SQLite extension
*/
