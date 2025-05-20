const { gql } = require("apollo-server");

const typeDefs = gql`
  # Represents a geographical location
  type Location {
    lat: Float!
    lng: Float!
    address: String
  }

  # Represents a nurse
  type Nurse {
    id: ID!
    name: String!
    title: String
    location: Location
    appointments: [Appointment]
    phoneNumber: String
    email: String
    specialty: String
    availability: [Availability]
  }

  # Represents a patient
  type Patient {
    id: ID!
    name: String!
    location: Location
    phoneNumber: String
    email: String
    careNeeds: [String]
    appointments: [Appointment]
    medicalNotes: String
  }

  # Represents a scheduled appointment
  type Appointment {
    id: ID!
    patient: Patient!
    nurse: Nurse!
    startTime: String!
    endTime: String!
    status: AppointmentStatus!
    location: Location
    notes: String
    careServices: [String]
  }

  # Status of an appointment
  enum AppointmentStatus {
    SCHEDULED
    IN_PROGRESS
    COMPLETED
    CANCELLED
    MISSED
  }

  # Nurse availability time slots
  type Availability {
    id: ID!
    day: String!
    startTime: String!
    endTime: String!
    recurring: Boolean
  }

  # Route information
  type Route {
    id: ID!
    nurse: Nurse!
    date: String!
    appointments: [Appointment!]!
    routePoints: [RoutePoint!]!
    totalDistance: Float!
    totalTime: Float!
    status: RouteStatus!
  }

  # Individual point on a route
  type RoutePoint {
    location: Location!
    arrivalTime: String
    departureTime: String
    appointmentId: ID
    stopType: StopType!
    order: Int!
  }

  # Type of stop on a route
  enum StopType {
    START
    APPOINTMENT
    END
  }

  # Status of a route
  enum RouteStatus {
    PLANNED
    IN_PROGRESS
    COMPLETED
  }

  # Root Query type
  type Query {
    # Nurse queries
    nurse(id: ID!): Nurse
    nurses: [Nurse!]!
    nursesBySpecialty(specialty: String!): [Nurse!]!

    # Patient queries
    patient(id: ID!): Patient
    patients: [Patient!]!

    # Appointment queries
    appointment(id: ID!): Appointment
    appointments(date: String, nurseId: ID, patientId: ID): [Appointment!]!

    # Route queries
    route(id: ID!): Route
    routes(date: String, nurseId: ID): [Route!]!
    optimizeRoute(nurseId: ID!, date: String!, routeType: String): Route
  }

  # Root Mutation type
  type Mutation {
    # Nurse mutations
    createNurse(input: NurseInput!): Nurse!
    updateNurse(id: ID!, input: NurseInput!): Nurse!
    deleteNurse(id: ID!): Boolean!

    # Patient mutations
    createPatient(input: PatientInput!): Patient!
    updatePatient(id: ID!, input: PatientInput!): Patient!
    deletePatient(id: ID!): Boolean!

    # Appointment mutations
    createAppointment(input: AppointmentInput!): Appointment!
    updateAppointment(id: ID!, input: AppointmentInput!): Appointment!
    cancelAppointment(id: ID!, reason: String): Appointment!

    # Route mutations
    createRoute(input: RouteInput!): Route!
    updateRoute(id: ID!, input: RouteInput!): Route!
    startRoute(id: ID!): Route!
    completeRoute(id: ID!): Route!
  }

  # Input for creating/updating a nurse
  input NurseInput {
    name: String!
    title: String
    locationInput: LocationInput
    phoneNumber: String
    email: String
    specialty: String
    availabilityInput: [AvailabilityInput]
  }

  # Input for creating/updating a patient
  input PatientInput {
    name: String!
    locationInput: LocationInput
    phoneNumber: String
    email: String
    careNeeds: [String]
    medicalNotes: String
  }

  # Input for creating/updating an appointment
  input AppointmentInput {
    patientId: ID!
    nurseId: ID!
    startTime: String!
    endTime: String!
    status: AppointmentStatus
    locationInput: LocationInput
    notes: String
    careServices: [String]
  }

  # Input for location
  input LocationInput {
    lat: Float!
    lng: Float!
    address: String
  }

  # Input for availability
  input AvailabilityInput {
    day: String!
    startTime: String!
    endTime: String!
    recurring: Boolean
  }

  # Input for creating/updating a route
  input RouteInput {
    nurseId: ID!
    date: String!
    appointmentIds: [ID!]!
    routeType: String
  }
`;

module.exports = typeDefs;
