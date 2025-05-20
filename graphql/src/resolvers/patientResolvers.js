// graphql/src/resolvers/patientResolvers.js
module.exports = {
    Query: {
      patient: (_, { id }, { dataSources }) => {
        return dataSources.patientAPI.getPatientById(id);
      },
      patients: (_, __, { dataSources }) => {
        return dataSources.patientAPI.getPatients();
      },
    },
    Mutation: {
      createPatient: (_, { input }, { dataSources }) => {
        // To be implemented
        throw new Error('Not implemented');
      },
      updatePatient: (_, { id, input }, { dataSources }) => {
        // To be implemented
        throw new Error('Not implemented');
      },
      deletePatient: (_, { id }, { dataSources }) => {
        // To be implemented
        throw new Error('Not implemented');
      },
    },
    Patient: {
      location: async (patient, _, { dataSources }) => {
        // Get location from FHIR Location resource
        // This is a placeholder for now
        return null;
      },
      appointments: async (patient, _, { dataSources }) => {
        return dataSources.appointmentAPI.getAppointments({ patientId: patient.id });
      },
    },
  };