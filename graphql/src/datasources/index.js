// graphql/src/datasources/index.js
// Placeholder data sources
class PlaceholderNurseAPI {
  async getNurses() {
    return [];
  }
  async getNurseById() {
    return null;
  }
  async getNursesBySpecialty() {
    return [];
  }
}

class PlaceholderPatientAPI {
  async getPatients() {
    return [];
  }
  async getPatientById() {
    return null;
  }
}

class PlaceholderAppointmentAPI {
  async getAppointments() {
    return [];
  }
  async getAppointmentById() {
    return null;
  }
  async createAppointment() {
    return null;
  }
  async updateAppointment() {
    return null;
  }
  async cancelAppointment() {
    return null;
  }
}

class PlaceholderMapsAPI {
  async geocodeAddress() {
    return null;
  }
}

class PlaceholderRoutingAPI {
  async optimizeRoute() {
    return null;
  }
}

// Export placeholder data sources
// These will be replaced by the mock or real implementations in the server
module.exports = {
  nurseAPI: new PlaceholderNurseAPI(),
  patientAPI: new PlaceholderPatientAPI(),
  appointmentAPI: new PlaceholderAppointmentAPI(),
  mapsAPI: new PlaceholderMapsAPI(),
  routingAPI: new PlaceholderRoutingAPI(),
};
