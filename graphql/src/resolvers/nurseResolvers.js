// graphql/src/resolvers/nurseResolvers.js
module.exports = {
  Query: {
    nurse: (_, { id }, { dataSources }) => {
      console.log(`Nurse resolver called with id: ${id}`);
      try {
        const result = dataSources.nurseAPI.getNurseById(id);
        console.log(`Nurse result:`, result);
        return result;
      } catch (error) {
        console.error(`Error fetching nurse with id ${id}:`, error);
        return null;
      }
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
      throw new Error("Not implemented");
    },
    updateNurse: (_, { id, input }, { dataSources }) => {
      // To be implemented
      throw new Error("Not implemented");
    },
    deleteNurse: (_, { id }, { dataSources }) => {
      // To be implemented
      throw new Error("Not implemented");
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
