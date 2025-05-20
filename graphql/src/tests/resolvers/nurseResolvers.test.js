const nurseResolvers = require('../../resolvers/nurseResolvers');

describe('Nurse Resolvers', () => {
  // Mock data sources
  const mockNurseAPI = {
    getNurseById: jest.fn(),
    getNurses: jest.fn(),
    getNursesBySpecialty: jest.fn()
  };

  const mockAppointmentAPI = {
    getAppointments: jest.fn()
  };

  const mockDataSources = {
    nurseAPI: mockNurseAPI,
    appointmentAPI: mockAppointmentAPI
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Query resolvers', () => {
    test('nurse resolver should call getNurseById with correct ID', async () => {
      const nurseId = 'nurse123';
      mockNurseAPI.getNurseById.mockResolvedValueOnce({ id: nurseId, name: 'Test Nurse' });

      const result = await nurseResolvers.Query.nurse(null, { id: nurseId }, { dataSources: mockDataSources });

      expect(mockNurseAPI.getNurseById).toHaveBeenCalledWith(nurseId);
      expect(result).toEqual({ id: nurseId, name: 'Test Nurse' });
    });

    test('nurses resolver should call getNurses', async () => {
      const mockNurses = [
        { id: 'nurse1', name: 'Nurse 1' },
        { id: 'nurse2', name: 'Nurse 2' }
      ];
      mockNurseAPI.getNurses.mockResolvedValueOnce(mockNurses);

      const result = await nurseResolvers.Query.nurses(null, {}, { dataSources: mockDataSources });

      expect(mockNurseAPI.getNurses).toHaveBeenCalled();
      expect(result).toEqual(mockNurses);
    });

    test('nursesBySpecialty resolver should call getNursesBySpecialty with correct specialty', async () => {
      const specialty = 'Cardiology';
      const mockNurses = [
        { id: 'nurse1', name: 'Nurse 1', specialty: 'Cardiology' }
      ];
      mockNurseAPI.getNursesBySpecialty.mockResolvedValueOnce(mockNurses);

      const result = await nurseResolvers.Query.nursesBySpecialty(
        null, 
        { specialty }, 
        { dataSources: mockDataSources }
      );

      expect(mockNurseAPI.getNursesBySpecialty).toHaveBeenCalledWith(specialty);
      expect(result).toEqual(mockNurses);
    });
  });

  describe('Nurse field resolvers', () => {
    test('appointments field resolver should call getAppointments with nurseId', async () => {
      const nurse = { id: 'nurse123', name: 'Test Nurse' };
      const mockAppointments = [
        { id: 'appt1', nurseId: nurse.id, patientId: 'patient1' }
      ];
      mockAppointmentAPI.getAppointments.mockResolvedValueOnce(mockAppointments);

      const result = await nurseResolvers.Nurse.appointments(
        nurse, 
        {}, 
        { dataSources: mockDataSources }
      );

      expect(mockAppointmentAPI.getAppointments).toHaveBeenCalledWith({ nurseId: nurse.id });
      expect(result).toEqual(mockAppointments);
    });
  });
});

// graphql/src/tests/resolvers/appointmentResolvers.test.js
const appointmentResolvers = require('../../resolvers/appointmentResolvers');

describe('Appointment Resolvers', () => {
  // Mock data sources
  const mockAppointmentAPI = {
    getAppointmentById: jest.fn(),
    getAppointments: jest.fn(),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    cancelAppointment: jest.fn()
  };

  const mockNurseAPI = {
    getNurseById: jest.fn()
  };

  const mockPatientAPI = {
    getPatientById: jest.fn()
  };

  const mockDataSources = {
    appointmentAPI: mockAppointmentAPI,
    nurseAPI: mockNurseAPI,
    patientAPI: mockPatientAPI
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Query resolvers', () => {
    test('appointment resolver should call getAppointmentById with correct ID', async () => {
      const appointmentId = 'appt123';
      mockAppointmentAPI.getAppointmentById.mockResolvedValueOnce({
        id: appointmentId,
        nurseId: 'nurse1',
        patientId: 'patient1'
      });

      const result = await appointmentResolvers.Query.appointment(
        null,
        { id: appointmentId },
        { dataSources: mockDataSources }
      );

      expect(mockAppointmentAPI.getAppointmentById).toHaveBeenCalledWith(appointmentId);
      expect(result).toEqual({
        id: appointmentId,
        nurseId: 'nurse1',
        patientId: 'patient1'
      });
    });

    test('appointments resolver should call getAppointments with filters', async () => {
      const filters = { date: '2023-08-15', nurseId: 'nurse1' };
      const mockAppointments = [
        { id: 'appt1', nurseId: 'nurse1', patientId: 'patient1' }
      ];
      mockAppointmentAPI.getAppointments.mockResolvedValueOnce(mockAppointments);

      const result = await appointmentResolvers.Query.appointments(
        null,
        filters,
        { dataSources: mockDataSources }
      );

      expect(mockAppointmentAPI.getAppointments).toHaveBeenCalledWith(filters);
      expect(result).toEqual(mockAppointments);
    });
  });

  describe('Mutation resolvers', () => {
    test('createAppointment resolver should call createAppointment with input', async () => {
      const input = {
        patientId: 'patient1',
        nurseId: 'nurse1',
        startTime: '2023-08-15T09:00:00Z',
        endTime: '2023-08-15T10:00:00Z'
      };
      
      const createdAppointment = {
        id: 'appt1',
        ...input
      };
      
      mockAppointmentAPI.createAppointment.mockResolvedValueOnce(createdAppointment);

      const result = await appointmentResolvers.Mutation.createAppointment(
        null,
        { input },
        { dataSources: mockDataSources }
      );

      expect(mockAppointmentAPI.createAppointment).toHaveBeenCalledWith(input);
      expect(result).toEqual(createdAppointment);
    });

    test('updateAppointment resolver should call updateAppointment with id and input', async () => {
      const appointmentId = 'appt1';
      const input = {
        startTime: '2023-08-15T10:00:00Z',
        endTime: '2023-08-15T11:00:00Z'
      };
      
      const updatedAppointment = {
        id: appointmentId,
        patientId: 'patient1',
        nurseId: 'nurse1',
        ...input
      };
      
      mockAppointmentAPI.updateAppointment.mockResolvedValueOnce(updatedAppointment);

      const result = await appointmentResolvers.Mutation.updateAppointment(
        null,
        { id: appointmentId, input },
        { dataSources: mockDataSources }
      );

      expect(mockAppointmentAPI.updateAppointment).toHaveBeenCalledWith(appointmentId, input);
      expect(result).toEqual(updatedAppointment);
    });

    test('cancelAppointment resolver should call cancelAppointment with id and reason', async () => {
      const appointmentId = 'appt1';
      const reason = 'Patient requested cancellation';
      
      const cancelledAppointment = {
        id: appointmentId,
        patientId: 'patient1',
        nurseId: 'nurse1',
        status: 'CANCELLED',
        notes: reason
      };
      
      mockAppointmentAPI.cancelAppointment.mockResolvedValueOnce(cancelledAppointment);

      const result = await appointmentResolvers.Mutation.cancelAppointment(
        null,
        { id: appointmentId, reason },
        { dataSources: mockDataSources }
      );

      expect(mockAppointmentAPI.cancelAppointment).toHaveBeenCalledWith(appointmentId, reason);
      expect(result).toEqual(cancelledAppointment);
    });
  });

  describe('Appointment field resolvers', () => {
    test('patient field resolver should call getPatientById with patientId', async () => {
      const appointment = { id: 'appt1', patientId: 'patient1', nurseId: 'nurse1' };
      const patient = { id: 'patient1', name: 'Test Patient' };
      
      mockPatientAPI.getPatientById.mockResolvedValueOnce(patient);

      const result = await appointmentResolvers.Appointment.patient(
        appointment,
        {},
        { dataSources: mockDataSources }
      );

      expect(mockPatientAPI.getPatientById).toHaveBeenCalledWith(appointment.patientId);
      expect(result).toEqual(patient);
    });

    test('nurse field resolver should call getNurseById with nurseId', async () => {
      const appointment = { id: 'appt1', patientId: 'patient1', nurseId: 'nurse1' };
      const nurse = { id: 'nurse1', name: 'Test Nurse' };
      
      mockNurseAPI.getNurseById.mockResolvedValueOnce(nurse);

      const result = await appointmentResolvers.Appointment.nurse(
        appointment,
        {},
        { dataSources: mockDataSources }
      );

      expect(mockNurseAPI.getNurseById).toHaveBeenCalledWith(appointment.nurseId);
      expect(result).toEqual(nurse);
    });
  });
});