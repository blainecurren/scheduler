// graphql/src/tests/integration/server.test.js
const { ApolloServer } = require("apollo-server");
const { createTestClient } = require("apollo-server-testing");
const { gql } = require("apollo-server");
const typeDefs = require("../../schema");
const resolvers = require("../../resolvers");

describe("Apollo Server Integration", () => {
  let server, query, mutate;

  // Mock data sources
  const mockNurseAPI = {
    getNurses: jest.fn(),
    getNurseById: jest.fn(),
    getNursesBySpecialty: jest.fn(),
  };

  const mockPatientAPI = {
    getPatients: jest.fn(),
    getPatientById: jest.fn(),
  };

  const mockAppointmentAPI = {
    getAppointments: jest.fn(),
    getAppointmentById: jest.fn(),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
  };

  beforeAll(() => {
    // Create an Apollo Server instance with our schema and resolvers
    server = new ApolloServer({
      typeDefs,
      resolvers,
      dataSources: () => ({
        nurseAPI: mockNurseAPI,
        patientAPI: mockPatientAPI,
        appointmentAPI: mockAppointmentAPI,
      }),
      context: ({ req }) => ({
        token: req?.headers?.authorization || "",
      }),
    });

    // Create test client
    const testClient = createTestClient(server);
    query = testClient.query;
    mutate = testClient.mutate;
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe("Queries", () => {
    test("nurses query should return a list of nurses", async () => {
      const mockNurses = [
        { id: "nurse1", name: "Jane Smith" },
        { id: "nurse2", name: "John Doe" },
      ];

      mockNurseAPI.getNurses.mockResolvedValueOnce(mockNurses);

      const NURSES_QUERY = gql`
        query GetNurses {
          nurses {
            id
            name
          }
        }
      `;

      const result = await query({ query: NURSES_QUERY });

      expect(result.errors).toBeUndefined();
      expect(result.data.nurses).toEqual(mockNurses);
      expect(mockNurseAPI.getNurses).toHaveBeenCalled();
    });

    test("nurse query should return a specific nurse", async () => {
      const mockNurse = { id: "nurse1", name: "Jane Smith" };

      mockNurseAPI.getNurseById.mockResolvedValueOnce(mockNurse);

      const NURSE_QUERY = gql`
        query GetNurse($id: ID!) {
          nurse(id: $id) {
            id
            name
          }
        }
      `;

      const result = await query({
        query: NURSE_QUERY,
        variables: { id: "nurse1" },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.nurse).toEqual(mockNurse);
      expect(mockNurseAPI.getNurseById).toHaveBeenCalledWith("nurse1");
    });

    test("patients query should return a list of patients", async () => {
      const mockPatients = [
        { id: "patient1", name: "Alice Johnson" },
        { id: "patient2", name: "Bob Wilson" },
      ];

      mockPatientAPI.getPatients.mockResolvedValueOnce(mockPatients);

      const PATIENTS_QUERY = gql`
        query GetPatients {
          patients {
            id
            name
          }
        }
      `;

      const result = await query({ query: PATIENTS_QUERY });

      expect(result.errors).toBeUndefined();
      expect(result.data.patients).toEqual(mockPatients);
      expect(mockPatientAPI.getPatients).toHaveBeenCalled();
    });

    test("appointments query should return a list of appointments with filters", async () => {
      const mockAppointments = [
        {
          id: "appt1",
          patientId: "patient1",
          nurseId: "nurse1",
          startTime: "2023-08-15T09:00:00Z",
          endTime: "2023-08-15T10:00:00Z",
          status: "SCHEDULED",
        },
      ];

      mockAppointmentAPI.getAppointments.mockResolvedValueOnce(
        mockAppointments
      );

      const APPOINTMENTS_QUERY = gql`
        query GetAppointments($date: String, $nurseId: ID) {
          appointments(date: $date, nurseId: $nurseId) {
            id
            startTime
            endTime
            status
          }
        }
      `;

      const variables = { date: "2023-08-15", nurseId: "nurse1" };
      const result = await query({
        query: APPOINTMENTS_QUERY,
        variables,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.appointments).toEqual(mockAppointments);
      expect(mockAppointmentAPI.getAppointments).toHaveBeenCalledWith(
        variables
      );
    });
  });

  describe("Mutations", () => {
    test("createAppointment mutation should create and return a new appointment", async () => {
      const input = {
        patientId: "patient1",
        nurseId: "nurse1",
        startTime: "2023-08-15T09:00:00Z",
        endTime: "2023-08-15T10:00:00Z",
        status: "SCHEDULED",
      };

      const createdAppointment = {
        id: "appt1",
        ...input,
      };

      mockAppointmentAPI.createAppointment.mockResolvedValueOnce(
        createdAppointment
      );

      const CREATE_APPOINTMENT_MUTATION = gql`
        mutation CreateAppointment($input: AppointmentInput!) {
          createAppointment(input: $input) {
            id
            startTime
            endTime
            status
          }
        }
      `;

      const result = await mutate({
        mutation: CREATE_APPOINTMENT_MUTATION,
        variables: { input },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.createAppointment).toEqual(createdAppointment);
      expect(mockAppointmentAPI.createAppointment).toHaveBeenCalledWith(input);
    });

    test("cancelAppointment mutation should cancel and return the updated appointment", async () => {
      const appointmentId = "appt1";
      const reason = "Patient requested cancellation";

      const cancelledAppointment = {
        id: appointmentId,
        patientId: "patient1",
        nurseId: "nurse1",
        startTime: "2023-08-15T09:00:00Z",
        endTime: "2023-08-15T10:00:00Z",
        status: "CANCELLED",
      };

      mockAppointmentAPI.cancelAppointment.mockResolvedValueOnce(
        cancelledAppointment
      );

      const CANCEL_APPOINTMENT_MUTATION = gql`
        mutation CancelAppointment($id: ID!, $reason: String) {
          cancelAppointment(id: $id, reason: $reason) {
            id
            status
          }
        }
      `;

      const result = await mutate({
        mutation: CANCEL_APPOINTMENT_MUTATION,
        variables: { id: appointmentId, reason },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.cancelAppointment).toEqual({
        id: appointmentId,
        status: "CANCELLED",
      });
      expect(mockAppointmentAPI.cancelAppointment).toHaveBeenCalledWith(
        appointmentId,
        reason
      );
    });
  });
});
