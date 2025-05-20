// graphql/src/resolvers/appointmentResolvers.js
module.exports = {
  Query: {
    appointment: (_, { id }, { dataSources }) => {
      return dataSources.appointmentAPI.getAppointmentById(id);
    },
    appointments: (_, filters, { dataSources }) => {
      return dataSources.appointmentAPI.getAppointments(filters);
    },
  },
  Mutation: {
    createAppointment: (_, { input }, { dataSources }) => {
      return dataSources.appointmentAPI.createAppointment(input);
    },
    updateAppointment: (_, { id, input }, { dataSources }) => {
      return dataSources.appointmentAPI.updateAppointment(id, input);
    },
    cancelAppointment: (_, { id, reason }, { dataSources }) => {
      return dataSources.appointmentAPI.cancelAppointment(id, reason);
    },
  },
  Appointment: {
    patient: async (appointment, _, { dataSources }) => {
      if (!appointment.patientId) return null;
      return dataSources.patientAPI.getPatientById(appointment.patientId);
    },
    nurse: async (appointment, _, { dataSources }) => {
      if (!appointment.nurseId) return null;
      return dataSources.nurseAPI.getNurseById(appointment.nurseId);
    },
    location: async (appointment, _, { dataSources }) => {
      // Get location from FHIR Location resource
      // This is a placeholder for now
      return null;
    },
  },
};
