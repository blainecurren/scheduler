// graphql/src/test-hchb-data.js
// Direct test of HCHB data fetching without GraphQL

const {
  getToken,
  getAllPatients,
  getAllPractitioners,
  getAppointments,
} = require("./datasources/fhir/service");

async function testDirectFetch() {
  console.log("🧪 Testing Direct HCHB Data Fetch\n");

  try {
    // Get token
    console.log("🔐 Getting authentication token...");
    const token = await getToken();
    console.log("✅ Token obtained\n");

    // Test 1: Fetch a few practitioners
    console.log("👩‍⚕️ Fetching practitioners...");
    const practitioners = await getAllPractitioners(token, {
      maxPractitioners: 5,
    });
    console.log(`✅ Found ${practitioners.length} practitioners`);

    if (practitioners.length > 0) {
      console.log("\nSample Practitioner:");
      const sample = practitioners[0];
      console.log(`ID: ${sample.id}`);
      console.log(`Name: ${sample.name}`);
      console.log(`Title: ${sample.title}`);
      console.log(`Specialty: ${sample.specialty}`);
      console.log(`Email: ${sample.email}`);
      console.log(`Phone: ${sample.phoneNumber}`);
    }

    // Test 2: Fetch a few patients
    console.log("\n👥 Fetching patients...");
    const patients = await getAllPatients(token, { maxPatients: 5 });
    console.log(`✅ Found ${patients.length} patients`);

    if (patients.length > 0) {
      console.log("\nSample Patient:");
      const sample = patients[0];
      console.log(`ID: ${sample.id}`);
      console.log(`Name: ${sample.name}`);
      console.log(`Email: ${sample.email}`);
      console.log(`Phone: ${sample.phoneNumber}`);
      console.log(
        `Care Needs: ${sample.careNeeds.join(", ") || "None listed"}`
      );
    }

    // Test 3: Fetch today's appointments
    console.log("\n📅 Fetching today's appointments...");
    const appointments = await getAppointments(token, "today", {
      maxAppointments: 5,
    });
    console.log(`✅ Found ${appointments.length} appointments for today`);

    if (appointments.length > 0) {
      console.log("\nSample Appointment:");
      const sample = appointments[0];
      console.log(`ID: ${sample.id}`);
      console.log(`Date: ${sample.date}`);
      console.log(`Start: ${sample.start}`);
      console.log(`End: ${sample.end}`);
      console.log(`Status: ${sample.status}`);
      console.log(`Patient ID: ${sample.patientId}`);
      console.log(`Practitioner ID: ${sample.practitionerId}`);
      console.log(`Service: ${sample.serviceTypeDisplay}`);
    }

    console.log("\n✨ Direct fetch test complete!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
  }
}

// Run the test
if (require.main === module) {
  testDirectFetch()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { testDirectFetch };
