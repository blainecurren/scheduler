// graphql/src/resolvers/index.js
const nurseResolvers = require("./nurseResolvers");
const patientResolvers = require("./patientResolvers");
const appointmentResolvers = require("./appointmentResolvers");
const routeResolvers = require("./routeResolvers");

// Combine all resolvers
const resolvers = {
  Query: {
    ...nurseResolvers.Query,
    ...patientResolvers.Query,
    ...appointmentResolvers.Query,
    ...routeResolvers.Query,
  },
  Mutation: {
    ...nurseResolvers.Mutation,
    ...patientResolvers.Mutation,
    ...appointmentResolvers.Mutation,
    ...routeResolvers.Mutation,
  },
  Nurse: nurseResolvers.Nurse,
  Patient: patientResolvers.Patient,
  Appointment: appointmentResolvers.Appointment,
  Route: routeResolvers.Route,
};

module.exports = resolvers;
