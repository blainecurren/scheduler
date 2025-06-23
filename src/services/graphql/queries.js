// src/services/queries.js
import { gql } from "@apollo/client";

export const GET_ALL_NURSES = gql`
  query GetAllNurses {
    nurses {
      id
      name
      title
      email
      phoneNumber
      specialty
      location {
        lat
        lng
        address
      }
    }
  }
`;

export const GET_ALL_PATIENTS = gql`
  query GetAllPatients {
    patients {
      id
      name
      location {
        lat
        lng
        address
      }
      phoneNumber
      email
      careNeeds
      medicalNotes
    }
  }
`;

export const GET_APPOINTMENTS = gql`
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
`;

export const GET_NURSE_BY_ID = gql`
  query GetNurseById($id: ID!) {
    nurse(id: $id) {
      id
      name
      title
      email
      phoneNumber
      specialty
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
`;

export const GET_PATIENT_BY_ID = gql`
  query GetPatientById($id: ID!) {
    patient(id: $id) {
      id
      name
      location {
        lat
        lng
        address
      }
      phoneNumber
      email
      careNeeds
      medicalNotes
      appointments {
        id
        startTime
        endTime
        status
      }
    }
  }
`;

export const GET_WEEKLY_SCHEDULE = gql`
  query GetWeeklySchedule(
    $nurseId: ID
    $startDate: String!
    $endDate: String!
  ) {
    appointments(nurseId: $nurseId, date: $startDate) {
      id
      startTime
      endTime
      status
      notes
      careServices
      patient {
        name
        location {
          lat
          lng
          address
        }
      }
      nurse {
        name
      }
    }
  }
`;

// Mutations
export const CREATE_APPOINTMENT = gql`
  mutation CreateAppointment($input: AppointmentInput!) {
    createAppointment(input: $input) {
      id
      startTime
      endTime
      status
    }
  }
`;

export const UPDATE_APPOINTMENT_STATUS = gql`
  mutation CancelAppointment($id: ID!, $reason: String) {
    cancelAppointment(id: $id, reason: $reason) {
      id
      status
    }
  }
`;

export const CREATE_NURSE = gql`
  mutation CreateNurse($input: NurseInput!) {
    createNurse(input: $input) {
      id
      name
      title
    }
  }
`;

export const CREATE_PATIENT = gql`
  mutation CreatePatient($input: PatientInput!) {
    createPatient(input: $input) {
      id
      name
    }
  }
`;
