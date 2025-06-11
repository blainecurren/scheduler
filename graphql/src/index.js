// graphql/src/index.js - Updated with better environment handling
const { ApolloServer } = require("apollo-server");
const typeDefs = require("./schema");
const resolvers = require("./resolvers");
const nurseAPI = require("./datasources/fhir/nurseAPI");
const patientAPI = require("./datasources/fhir/patientAPI");
const appointmentAPI = require("./datasources/fhir/appointmentAPI");
const mockDataSources = require("./datasources/mock");
require("dotenv").config();

// Debug environment variables
console.log("=== Environment Debug ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("USE_MOCK_DATA from env:", process.env.USE_MOCK_DATA);
console.log("Type of USE_MOCK_DATA:", typeof process.env.USE_MOCK_DATA);

// Parse USE_MOCK_DATA more carefully
// Default to false (use real data) unless explicitly set to 'true'
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === "true";

console.log("USE_MOCK_DATA parsed value:", USE_MOCK_DATA);
console.log("API_BASE_URL:", process.env.API_BASE_URL);
console.log("========================\n");

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => {
    if (USE_MOCK_DATA) {
      console.log("🔵 Using MOCK data sources");
      return {
        nurseAPI: mockDataSources.mockNurseAPI,
        patientAPI: mockDataSources.mockPatientAPI,
        appointmentAPI: mockDataSources.mockAppointmentAPI,
        mapsAPI: mockDataSources.mockMapsAPI,
        routingAPI: mockDataSources.mockRoutingAPI,
      };
    }

    console.log("🟢 Using HCHB FHIR data sources");
    console.log("Creating HCHB data sources...");

    const dataSources = {
      nurseAPI: new nurseAPI(),
      patientAPI: new patientAPI(),
      appointmentAPI: new appointmentAPI(),
      // Keep mock for maps and routing for now
      mapsAPI: mockDataSources.mockMapsAPI,
      routingAPI: mockDataSources.mockRoutingAPI,
    };

    console.log("HCHB data sources created successfully");
    return dataSources;
  },
  context: ({ req }) => {
    return {
      token: req.headers.authorization || "",
    };
  },
  // Enable introspection and playground
  introspection: true,
  playground: true,
  // Add error formatting for better debugging
  formatError: (error) => {
    console.error("GraphQL Error:", error);
    return error;
  },
});

const port = process.env.PORT || 4000;

server.listen(port).then(({ url }) => {
  console.log(`\n🚀 GraphQL server ready at ${url}`);
  console.log(`📊 GraphQL Playground available at ${url}graphql`);

  if (!USE_MOCK_DATA) {
    console.log(`🏥 Connected to HCHB FHIR API at ${process.env.API_BASE_URL}`);
    console.log(`✅ Using REAL HCHB data`);
  } else {
    console.log(`🎭 Using MOCK data (not connected to HCHB)`);
  }

  console.log(`\n💡 To switch data sources:`);
  console.log(`   - For HCHB data: USE_MOCK_DATA=false npm start`);
  console.log(`   - For mock data: USE_MOCK_DATA=true npm start`);
});
