// graphql/src/datasources/mock/index.js

// Simple mock data for development
const mockNurses = [
  {
    id: "nurse-1",
    name: "Jane Smith",
    title: "Registered Nurse",
    specialty: "Cardiology",
    phoneNumber: "512-555-1234",
    email: "jane.smith@example.com",
  },
  {
    id: "nurse-2",
    name: "John Doe",
    title: "Registered Nurse",
    specialty: "Geriatrics",
    phoneNumber: "512-555-5678",
    email: "john.doe@example.com",
  },
  {
    id: "nurse-3",
    name: "Sarah Johnson",
    title: "Registered Nurse",
    specialty: "Pediatrics",
    phoneNumber: "512-555-9012",
    email: "sarah.johnson@example.com",
  },
];

const mockPatients = [
  {
    id: "patient-1",
    name: "Robert Johnson",
    phoneNumber: "512-555-1111",
    email: "robert.johnson@example.com",
    careNeeds: ["Medication Management", "Blood Pressure Monitoring"],
    medicalNotes:
      "Patient has history of hypertension and requires regular BP monitoring.",
  },
  {
    id: "patient-2",
    name: "Sarah Miller",
    phoneNumber: "512-555-2222",
    email: "sarah.miller@example.com",
    careNeeds: ["Wound Care", "Physical Therapy"],
    medicalNotes:
      "Patient recovering from hip replacement surgery. Needs assistance with wound care and physical therapy.",
  },
  {
    id: "patient-3",
    name: "David Wilson",
    phoneNumber: "512-555-3333",
    email: "david.wilson@example.com",
    careNeeds: ["Diabetes Management", "Insulin Administration"],
    medicalNotes:
      "Patient has Type 1 diabetes and requires insulin administration. Also needs help with glucose monitoring.",
  },
];

const mockAppointments = [
  {
    id: "appointment-1",
    patientId: "patient-1",
    nurseId: "nurse-1",
    startTime: "2023-08-15T09:00:00-05:00",
    endTime: "2023-08-15T09:30:00-05:00",
    status: "SCHEDULED",
    notes: "Regular blood pressure check and medication review",
    careServices: ["Medication Administration"],
  },
  {
    id: "appointment-2",
    patientId: "patient-2",
    nurseId: "nurse-1",
    startTime: "2023-08-15T10:30:00-05:00",
    endTime: "2023-08-15T11:15:00-05:00",
    status: "SCHEDULED",
    notes: "Post-surgical wound dressing change and assessment",
    careServices: ["Wound Care"],
  },
  {
    id: "appointment-3",
    patientId: "patient-3",
    nurseId: "nurse-1",
    startTime: "2023-08-15T13:00:00-05:00",
    endTime: "2023-08-15T13:45:00-05:00",
    status: "SCHEDULED",
    notes: "Insulin administration and blood glucose monitoring",
    careServices: ["Diabetes Management"],
  },
];

// Mock implementations for data sources
class MockNurseAPI {
  async getNurses() {
    return [...mockNurses];
  }

  async getNurseById(id) {
    const nurse = mockNurses.find((n) => n.id === id);
    if (!nurse) {
      throw new Error(`Nurse with ID ${id} not found`);
    }
    return { ...nurse };
  }

  async getNursesBySpecialty(specialty) {
    return mockNurses.filter((n) => n.specialty === specialty);
  }
}

class MockPatientAPI {
  async getPatients() {
    return [...mockPatients];
  }

  async getPatientById(id) {
    const patient = mockPatients.find((p) => p.id === id);
    if (!patient) {
      throw new Error(`Patient with ID ${id} not found`);
    }
    return { ...patient };
  }
}

class MockAppointmentAPI {
  async getAppointments(filters = {}) {
    let result = [...mockAppointments];

    if (filters.date) {
      const date = filters.date;
      result = result.filter((a) => a.startTime.startsWith(date));
    }

    if (filters.nurseId) {
      result = result.filter((a) => a.nurseId === filters.nurseId);
    }

    if (filters.patientId) {
      result = result.filter((a) => a.patientId === filters.patientId);
    }

    return result;
  }

  async getAppointmentById(id) {
    const appointment = mockAppointments.find((a) => a.id === id);
    if (!appointment) {
      throw new Error(`Appointment with ID ${id} not found`);
    }
    return { ...appointment };
  }

  async createAppointment(input) {
    const newId = `appointment-${mockAppointments.length + 1}`;
    const newAppointment = {
      id: newId,
      ...input,
      status: input.status || "SCHEDULED",
    };

    mockAppointments.push(newAppointment);
    return newAppointment;
  }

  async updateAppointment(id, input) {
    const index = mockAppointments.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`Appointment with ID ${id} not found`);
    }

    const updatedAppointment = {
      ...mockAppointments[index],
      ...input,
    };

    mockAppointments[index] = updatedAppointment;
    return updatedAppointment;
  }

  async cancelAppointment(id, reason) {
    const index = mockAppointments.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`Appointment with ID ${id} not found`);
    }

    const cancelledAppointment = {
      ...mockAppointments[index],
      status: "CANCELLED",
      notes: reason || mockAppointments[index].notes,
    };

    mockAppointments[index] = cancelledAppointment;
    return cancelledAppointment;
  }
}

class MockMapsAPI {
  async geocodeAddress(address) {
    // Return mock coordinates for Austin, TX with some randomization
    return {
      lat: 30.25 + Math.random() * 0.1,
      lng: -97.75 - Math.random() * 0.1,
      address: address || "Mock Address",
    };
  }
}

class MockRoutingAPI {
  async optimizeRoute(
    startLocation,
    waypoints,
    endLocation,
    routeType = "time"
  ) {
    // Create a simple mock route
    const allPoints = [
      { ...startLocation, stopType: "START" },
      ...waypoints.map((wp, index) => ({
        ...wp,
        stopType: "APPOINTMENT",
        arrivalTime: new Date(Date.now() + (index + 1) * 3600000).toISOString(),
        departureTime: new Date(
          Date.now() + (index + 1) * 3600000 + 1800000
        ).toISOString(),
      })),
      { ...endLocation, stopType: "END" },
    ];

    // Calculate mock distance and time
    const distance = 1000 * waypoints.length; // 1km per waypoint
    const time = 600000 * waypoints.length; // 10 minutes per waypoint

    return {
      points: allPoints,
      distance,
      time,
    };
  }
}

// Export mock data sources
module.exports = {
  mockNurseAPI: new MockNurseAPI(),
  mockPatientAPI: new MockPatientAPI(),
  mockAppointmentAPI: new MockAppointmentAPI(),
  mockMapsAPI: new MockMapsAPI(),
  mockRoutingAPI: new MockRoutingAPI(),
};
