// src/hooks/useGraphQL.js
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

/**
 * Custom hook for making GraphQL queries to our API
 */
const useGraphQL = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // GraphQL endpoint from environment variables
  const endpoint = process.env.REACT_APP_GRAPHQL_URL || "http://localhost:4000";

  /**
   * Execute a GraphQL query
   * @param {string} query - GraphQL query string
   * @param {Object} variables - Query variables
   * @returns {Promise<Object>} Query result data
   */
  const executeQuery = useCallback(
    async (query, variables = {}) => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.post(
          endpoint,
          {
            query,
            variables,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.errors) {
          throw new Error(response.data.errors[0].message);
        }

        setLoading(false);
        return response.data.data;
      } catch (err) {
        setError(err.message || "Error executing GraphQL query");
        setLoading(false);
        throw err;
      }
    },
    [endpoint]
  );

  /**
   * Execute a GraphQL mutation
   * @param {string} mutation - GraphQL mutation string
   * @param {Object} variables - Mutation variables
   * @returns {Promise<Object>} Mutation result data
   */
  const executeMutation = useCallback(
    async (mutation, variables = {}) => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.post(
          endpoint,
          {
            query: mutation, // GraphQL accepts mutations as the 'query' field
            variables,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.errors) {
          throw new Error(response.data.errors[0].message);
        }

        setLoading(false);
        return response.data.data;
      } catch (err) {
        setError(err.message || "Error executing GraphQL mutation");
        setLoading(false);
        throw err;
      }
    },
    [endpoint]
  );

  // Pre-defined queries
  const queries = {
    // Nurse queries
    GET_NURSES: `
      query GetNurses {
        nurses {
          id
          name
          title
          specialty
          phoneNumber
          email
        }
      }
    `,

    GET_NURSE: `
      query GetNurse($id: ID!) {
        nurse(id: $id) {
          id
          name
          title
          specialty
          phoneNumber
          email
          location {
            lat
            lng
            address
          }
          appointments {
            id
            startTime
            endTime
            status
          }
        }
      }
    `,

    // Patient queries
    GET_PATIENTS: `
      query GetPatients {
        patients {
          id
          name
          phoneNumber
          email
          careNeeds
          medicalNotes
        }
      }
    `,

    GET_PATIENT: `
      query GetPatient($id: ID!) {
        patient(id: $id) {
          id
          name
          phoneNumber
          email
          careNeeds
          medicalNotes
          location {
            lat
            lng
            address
          }
          appointments {
            id
            startTime
            endTime
            status
          }
        }
      }
    `,

    // Appointment queries
    GET_APPOINTMENTS: `
      query GetAppointments($date: String, $nurseId: ID, $patientId: ID) {
        appointments(date: $date, nurseId: $nurseId, patientId: $patientId) {
          id
          startTime
          endTime
          status
          notes
          careServices
          patient {
            id
            name
          }
          nurse {
            id
            name
          }
        }
      }
    `,

    GET_APPOINTMENT: `
      query GetAppointment($id: ID!) {
        appointment(id: $id) {
          id
          startTime
          endTime
          status
          notes
          careServices
          patient {
            id
            name
            location {
              lat
              lng
              address
            }
          }
          nurse {
            id
            name
          }
          location {
            lat
            lng
            address
          }
        }
      }
    `,

    // Route queries
    GET_ROUTES: `
      query GetRoutes($date: String, $nurseId: ID) {
        routes(date: $date, nurseId: $nurseId) {
          id
          date
          status
          totalDistance
          totalTime
          nurse {
            id
            name
          }
        }
      }
    `,

    GET_ROUTE: `
      query GetRoute($id: ID!) {
        route(id: $id) {
          id
          date
          status
          totalDistance
          totalTime
          nurse {
            id
            name
          }
          routePoints {
            location {
              lat
              lng
              address
            }
            stopType
            order
            arrivalTime
            departureTime
            appointmentId
          }
          appointments {
            id
            startTime
            endTime
            patient {
              id
              name
            }
          }
        }
      }
    `,

    OPTIMIZE_ROUTE: `
      query OptimizeRoute($nurseId: ID!, $date: String!, $routeType: String) {
        optimizeRoute(nurseId: $nurseId, date: $date, routeType: $routeType) {
          id
          totalDistance
          totalTime
          status
          nurse {
            id
            name
          }
          routePoints {
            location {
              lat
              lng
              address
            }
            stopType
            order
            arrivalTime
            departureTime
            appointmentId
          }
          appointments {
            id
            startTime
            endTime
            patient {
              id
              name
              location {
                lat
                lng
              }
            }
          }
        }
      }
    `,
  };

  // Pre-defined mutations
  const mutations = {
    // Appointment mutations
    CREATE_APPOINTMENT: `
      mutation CreateAppointment($input: AppointmentInput!) {
        createAppointment(input: $input) {
          id
          startTime
          endTime
          status
          notes
          careServices
          patient {
            id
            name
          }
          nurse {
            id
            name
          }
        }
      }
    `,

    UPDATE_APPOINTMENT: `
      mutation UpdateAppointment($id: ID!, $input: AppointmentInput!) {
        updateAppointment(id: $id, input: $input) {
          id
          startTime
          endTime
          status
          notes
          careServices
        }
      }
    `,

    CANCEL_APPOINTMENT: `
      mutation CancelAppointment($id: ID!, $reason: String) {
        cancelAppointment(id: $id, reason: $reason) {
          id
          status
        }
      }
    `,

    // Route mutations
    CREATE_ROUTE: `
      mutation CreateRoute($input: RouteInput!) {
        createRoute(input: $input) {
          id
          date
          status
          nurse {
            id
            name
          }
        }
      }
    `,

    START_ROUTE: `
      mutation StartRoute($id: ID!) {
        startRoute(id: $id) {
          id
          status
        }
      }
    `,

    COMPLETE_ROUTE: `
      mutation CompleteRoute($id: ID!) {
        completeRoute(id: $id) {
          id
          status
        }
      }
    `,
  };

  /**
   * Helper method to execute a pre-defined query
   * @param {string} queryName - Name of the pre-defined query
   * @param {Object} variables - Query variables
   * @returns {Promise<Object>} Query result data
   */
  const query = useCallback(
    async (queryName, variables = {}) => {
      const queryText = queries[queryName];
      if (!queryText) {
        throw new Error(`Unknown query: ${queryName}`);
      }

      return executeQuery(queryText, variables);
    },
    [executeQuery, queries]
  );

  /**
   * Helper method to execute a pre-defined mutation
   * @param {string} mutationName - Name of the pre-defined mutation
   * @param {Object} variables - Mutation variables
   * @returns {Promise<Object>} Mutation result data
   */
  const mutate = useCallback(
    async (mutationName, variables = {}) => {
      const mutationText = mutations[mutationName];
      if (!mutationText) {
        throw new Error(`Unknown mutation: ${mutationName}`);
      }

      return executeMutation(mutationText, variables);
    },
    [executeMutation, mutations]
  );

  return {
    loading,
    error,
    executeQuery,
    executeMutation,
    query,
    mutate,
    queries,
    mutations,
  };
};

export default useGraphQL;
