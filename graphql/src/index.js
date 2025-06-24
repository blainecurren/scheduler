// graphql/src/index.js - Using SQLite as default datasource
const { ApolloServer } = require("apollo-server");
const typeDefs = require("./schema");
const resolvers = require("./resolvers");

// SQLite datasources (DEFAULT)
const NurseSQLiteAPI = require("./datasources/sqlite/nurseSQLiteAPI");
const PatientSQLiteAPI = require("./datasources/sqlite/patientSQLiteAPI");
const AppointmentSQLiteAPI = require("./datasources/sqlite/appointmentSQLiteAPI");

// FHIR API datasources (optional)
const NurseFHIRAPI = require("./datasources/fhir/nurseAPI");
const PatientFHIRAPI = require("./datasources/fhir/patientAPI");
const AppointmentFHIRAPI = require("./datasources/fhir/appointmentAPI");

// Mock datasources
const mockDataSources = require("./datasources/mock");

require("dotenv").config();

// Environment configuration
const DATA_SOURCE = process.env.DATA_SOURCE || "sqlite"; // Default to SQLite

console.log("=== GraphQL Server Configuration ===");
console.log("DATA_SOURCE:", DATA_SOURCE);
console.log("API_BASE_URL:", process.env.API_BASE_URL);
console.log("===================================\n");

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => {
    let dataSources;

    switch (DATA_SOURCE.toLowerCase()) {
      case "mock":
        console.log("🎭 Using MOCK data sources");
        dataSources = {
          nurseAPI: mockDataSources.mockNurseAPI,
          patientAPI: mockDataSources.mockPatientAPI,
          appointmentAPI: mockDataSources.mockAppointmentAPI,
          mapsAPI: mockDataSources.mockMapsAPI,
          routingAPI: mockDataSources.mockRoutingAPI,
        };
        break;

      case "fhir":
      case "hchb":
        console.log("🏥 Using HCHB FHIR data sources (real-time API)");
        dataSources = {
          nurseAPI: new NurseFHIRAPI(),
          patientAPI: new PatientFHIRAPI(),
          appointmentAPI: new AppointmentFHIRAPI(),
          mapsAPI: mockDataSources.mockMapsAPI,
          routingAPI: mockDataSources.mockRoutingAPI,
        };
        break;

      case "sqlite":
      default:
        console.log("🗄️  Using SQLite database (local data)");
        try {
          dataSources = {
            nurseAPI: new NurseSQLiteAPI(),
            patientAPI: new PatientSQLiteAPI(),
            appointmentAPI: new AppointmentSQLiteAPI(),
            mapsAPI: mockDataSources.mockMapsAPI,
            routingAPI: mockDataSources.mockRoutingAPI,
          };
          console.log("✅ SQLite datasources initialized successfully");
        } catch (error) {
          console.error("❌ Failed to initialize SQLite datasources:", error);
          throw error;
        }
        break;
    }

    return dataSources;
  },
  context: ({ req }) => {
    return {
      token: req.headers.authorization || "",
    };
  },
  introspection: true,
  playground: true,
  formatError: (error) => {
    console.error("GraphQL Error:", error);
    return error;
  },
});

const port = process.env.PORT || 4000;

server.listen(port).then(({ url }) => {
  console.log(`\n🚀 GraphQL server ready at ${url}`);
  console.log(`📊 GraphQL Playground available at ${url}graphql`);

  switch (DATA_SOURCE.toLowerCase()) {
    case "sqlite":
      console.log(`\n🗄️  Using SQLite database`);
      console.log(`   - Data is stored locally in nurse-scheduler.db`);
      console.log(`   - Run 'npm run db:sync' to update data from HCHB`);
      console.log(`   - Run 'npm run db:status' to check database status`);
      break;
    case "fhir":
    case "hchb":
      console.log(`\n🏥 Using real-time HCHB FHIR API`);
      console.log(`   - Data is fetched live from ${process.env.API_BASE_URL}`);
      break;
    case "mock":
      console.log(`\n🎭 Using mock data`);
      break;
  }

  console.log(`\n💡 To switch data sources:`);
  console.log(`   - SQLite (default): npm start`);
  console.log(`   - SQLite:          DATA_SOURCE=sqlite npm start`);
  console.log(`   - HCHB API:        DATA_SOURCE=fhir npm start`);
  console.log(`   - Mock data:       DATA_SOURCE=mock npm start`);
});
