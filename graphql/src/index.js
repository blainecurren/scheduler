// graphql/src/index.js
const { ApolloServer } = require("apollo-server");
const typeDefs = require("./schema");
const resolvers = require("./resolvers");
const dataSources = require("./datasources");
const mockDataSources = require("./datasources/mock");
require("dotenv").config();

// Force mock data in development
const USE_MOCK_DATA = true;

console.log("Environment:", process.env.NODE_ENV);
console.log("USE_MOCK_DATA flag:", USE_MOCK_DATA);

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => {
    // Use mock data sources in development, real ones in production
    if (USE_MOCK_DATA) {
      console.log("Using mock data sources");
      const sources = {
        nurseAPI: mockDataSources.mockNurseAPI,
        patientAPI: mockDataSources.mockPatientAPI,
        appointmentAPI: mockDataSources.mockAppointmentAPI,
        mapsAPI: mockDataSources.mockMapsAPI,
        routingAPI: mockDataSources.mockRoutingAPI,
      };
      console.log("Data sources set up:", Object.keys(sources));
      return sources;
    }

    console.log("Using real data sources");
    return dataSources;
  },
  context: ({ req }) => {
    return {
      token: req.headers.authorization || "",
    };
  },
  // Enable introspection and playground in development
  introspection: true,
  playground: true,
});

const port = process.env.PORT || 4000;

// Test the mock data source directly
console.log("Testing mock nurse lookup directly:");
try {
  const testNurse = mockDataSources.mockNurseAPI.getNurseById("nurse1");
  console.log("Test result:", testNurse);
} catch (error) {
  console.error("Test failed:", error);
}

server.listen(port).then(({ url }) => {
  console.log(`🚀 GraphQL server ready at ${url}`);
});
