// graphql/src/resolvers/routeResolvers.js
const { v4: uuidv4 } = require('uuid');

// In-memory store for routes (to be replaced with database)
const routes = new Map();

module.exports = {
  Query: {
    route: (_, { id }, { dataSources }) => {
      return routes.get(id) || null;
    },
    routes: (_, { date, nurseId }, { dataSources }) => {
      let result = Array.from(routes.values());
      
      if (date) {
        result = result.filter(route => route.date === date);
      }
      
      if (nurseId) {
        result = result.filter(route => route.nurse.id === nurseId);
      }
      
      return result;
    },
    optimizeRoute: async (_, { nurseId, date, routeType }, { dataSources }) => {
      try {
        // Get the nurse and their appointments for the date
        const nurse = await dataSources.nurseAPI.getNurseById(nurseId);
        if (!nurse) {
          throw new Error(`Nurse with ID ${nurseId} not found`);
        }
        
        const appointments = await dataSources.appointmentAPI.getAppointments({
          nurseId,
          date
        });
        
        if (!appointments || appointments.length === 0) {
          throw new Error(`No appointments found for nurse ${nurseId} on ${date}`);
        }
        
        // Determine start location (nurse's location)
        let nurseLocation = nurse.location;
        
        // If no location available, use the first appointment's location as fallback
        if (!nurseLocation) {
          const firstAppointment = appointments[0];
          const patient = await dataSources.patientAPI.getPatientById(firstAppointment.patientId);
          nurseLocation = patient.location;
        }
        
        // If still no location, create a default one
        if (!nurseLocation) {
          nurseLocation = { lat: 30.2672, lng: -97.7431 }; // Default to Austin, TX
        }
        
        // Get patient locations for appointments
        const patientLocationsPromises = appointments.map(async appointment => {
          const patient = await dataSources.patientAPI.getPatientById(appointment.patientId);
          return {
            ...patient.location,
            appointmentId: appointment.id
          };
        });
        
        const patientLocations = await Promise.all(patientLocationsPromises);
        const validPatientLocations = patientLocations.filter(loc => loc.lat && loc.lng);
        
        // Optimize route
        const optimizedRoute = await dataSources.routingAPI.optimizeRoute(
          nurseLocation,
          validPatientLocations,
          nurseLocation, // End at nurse location
          routeType || 'time'
        );
        
        if (!optimizedRoute) {
          throw new Error('Failed to optimize route');
        }
        
        // Create route object
        const route = {
          id: uuidv4(),
          nurse,
          date,
          appointments,
          routePoints: optimizedRoute.points.map((point, index) => ({
            location: {
              lat: point.lat,
              lng: point.lng,
              address: point.address
            },
            arrivalTime: point.arrivalTime,
            departureTime: point.departureTime,
            appointmentId: point.appointmentId,
            stopType: index === 0 ? 'START' : (index === optimizedRoute.points.length - 1 ? 'END' : 'APPOINTMENT'),
            order: index
          })),
          totalDistance: optimizedRoute.distance,
          totalTime: optimizedRoute.time,
          status: 'PLANNED'
        };
        
        // Store the route
        routes.set(route.id, route);
        
        return route;
      } catch (error) {
        console.error('Error optimizing route:', error);
        throw error;
      }
    }
  },
  Mutation: {
    createRoute: async (_, { input }, { dataSources }) => {
      const { nurseId, date, appointmentIds, routeType } = input;
      
      try {
        // Get the nurse
        const nurse = await dataSources.nurseAPI.getNurseById(nurseId);
        if (!nurse) {
          throw new Error(`Nurse with ID ${nurseId} not found`);
        }
        
        // Get the appointments
        const appointmentsPromises = appointmentIds.map(id => 
          dataSources.appointmentAPI.getAppointmentById(id)
        );
        const appointments = await Promise.all(appointmentsPromises);
        
        // Create a new route
        const route = {
          id: uuidv4(),
          nurse,
          date,
          appointments,
          routePoints: [], // To be filled after optimization
          totalDistance: 0,
          totalTime: 0,
          status: 'PLANNED'
        };
        
        // Store the route
        routes.set(route.id, route);
        
        // Return the route
        return route;
      } catch (error) {
        console.error('Error creating route:', error);
        throw error;
      }
    },
    updateRoute: (_, { id, input }, { dataSources }) => {
      try {
        const route = routes.get(id);
        if (!route) {
          throw new Error(`Route with ID ${id} not found`);
        }
        
        // Update route properties
        const updatedRoute = {
          ...route,
          ...input
        };
        
        // Store the updated route
        routes.set(id, updatedRoute);
        
        return updatedRoute;
      } catch (error) {
        console.error('Error updating route:', error);
        throw error;
      }
    },
    startRoute: (_, { id }, { dataSources }) => {
      try {
        const route = routes.get(id);
        if (!route) {
          throw new Error(`Route with ID ${id} not found`);
        }
        
        // Update status
        const updatedRoute = {
          ...route,
          status: 'IN_PROGRESS'
        };
        
        // Store the updated route
        routes.set(id, updatedRoute);
        
        return updatedRoute;
      } catch (error) {
        console.error('Error starting route:', error);
        throw error;
      }
    },
    completeRoute: (_, { id }, { dataSources }) => {
      try {
        const route = routes.get(id);
        if (!route) {
          throw new Error(`Route with ID ${id} not found`);
        }
        
        // Update status
        const updatedRoute = {
          ...route,
          status: 'COMPLETED'
        };
        
        // Store the updated route
        routes.set(id, updatedRoute);
        
        return updatedRoute;
      } catch (error) {
        console.error('Error completing route:', error);
        throw error;
      }
    }
  },
  Route: {
    // Resolvers for Route fields if needed
  }
};