// graphql/src/resolvers/nurseResolvers.js
module.exports = {
    Query: {
      nurse: (_, { id }, { dataSources }) => {
        return dataSources.nurseAPI.getNurseById(id);
      },
      nurses: (_, __, { dataSources }) => {
        return dataSources.nurseAPI.getNurses();
      },
      nursesBySpecialty: (_, { specialty }, { dataSources }) => {
        return dataSources.nurseAPI.getNursesBySpecialty(specialty);
      },
    },
    Mutation: {
      createNurse: (_, { input }, { dataSources }) => {
        // To be implemented
        throw new Error('Not implemented');
      },
      updateNurse: (_, { id, input }, { dataSources }) => {
        // To be implemented
        throw new Error('Not implemented');
      },
      deleteNurse: (_, { id }, { dataSources }) => {
        // To be implemented
        throw new Error('Not implemented');
      },
    },
    Nurse: {
      location: async (nurse, _, { dataSources }) => {
        // Get location from FHIR Location resource
        // This is a placeholder for now
        return null;
      },
      appointments: async (nurse, _, { dataSources }) => {
        return dataSources.appointmentAPI.getAppointments({ nurseId: nurse.id });
      },
      availability: async (nurse, _, { dataSources }) => {
        // To be implemented
        return [];
      },
    },
  };