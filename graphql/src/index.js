// graphql/src/index.js
const { ApolloServer } = require("apollo-server");
const typeDefs = require("./schema");
const resolvers = require("./resolvers");
const realDataSources = require("./datasources");
const mockDataSources = require("./datasources/mock");
require("dotenv").config();

// Determine if we should use mock data
const USE_MOCK_DATA =
  process.env.USE_MOCK_DATA === "true" ||
  process.env.NODE_ENV === "development";

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => {
    // Use mock data sources in development, real ones in production
    if (USE_MOCK_DATA) {
      console.log("Using mock data sources");
      return {
        nurseAPI: mockDataSources.mockNurseAPI,
        patientAPI: mockDataSources.mockPatientAPI,
        appointmentAPI: mockDataSources.mockAppointmentAPI,
        mapsAPI: mockDataSources.mockMapsAPI,
        routingAPI: mockDataSources.mockRoutingAPI,
      };
    }

    console.log("Using real data sources");
    return realDataSources;
  },
  context: ({ req }) => {
    return {
      token: req.headers.authorization || "",
    };
  },
  // Enable introspection and playground in development
  introspection: process.env.NODE_ENV !== "production",
  playground: process.env.NODE_ENV !== "production",
});

const port = process.env.PORT || 4000;

server.listen(port).then(({ url }) => {
  console.log(`🚀 GraphQL server ready at ${url}`);
});
