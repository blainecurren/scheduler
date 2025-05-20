const { RESTDataSource } = require("apollo-datasource-rest");

class AzureMapsAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = "https://atlas.microsoft.com/";
    this.apiKey = process.env.AZURE_MAPS_KEY || "";
  }

  willSendRequest(request) {
    request.params.set("subscription-key", this.apiKey);
    request.params.set("api-version", "1.0");
  }

  async geocodeAddress(address) {
    if (!address) return null;

    const response = await this.get("search/address/json", {
      query: address,
      limit: 1,
    });

    if (response.results && response.results.length > 0) {
      const result = response.results[0];
      return {
        lat: result.position.lat,
        lng: result.position.lon,
        address: result.address.freeformAddress,
      };
    }

    return null;
  }

  async getRouteInfo(origin, destination) {
    const response = await this.get("route/directions/json", {
      query: `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`,
      routeType: "fastest",
      traffic: "true",
    });

    if (response.routes && response.routes.length > 0) {
      const route = response.routes[0];
      return {
        distance: route.summary.lengthInMeters,
        time: route.summary.travelTimeInSeconds,
        points: route.legs[0].points.map((point) => ({
          lat: point.latitude,
          lng: point.longitude,
        })),
      };
    }

    return null;
  }
}

// graphql/src/datasources/routing/GraphHopperAPI.js
const { RESTDataSource } = require("apollo-datasource-rest");

class GraphHopperAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = process.env.GRAPHHOPPER_URL || "http://graphhopper:8080";
  }

  async getRoute(start, end) {
    const response = await this.get("/route", {
      point: [`${start.lat},${start.lng}`, `${end.lat},${end.lng}`],
      vehicle: "car",
      points_encoded: false,
      instructions: true,
    });

    return this.formatRouteResponse(response);
  }

  async getRouteWithWaypoints(points) {
    const pointParams = points.map((p) => `${p.lat},${p.lng}`);

    const response = await this.get("/route", {
      point: pointParams,
      vehicle: "car",
      points_encoded: false,
      instructions: true,
    });

    return this.formatRouteResponse(response);
  }

  async optimizeRoute(
    startLocation,
    waypoints,
    endLocation,
    routeType = "time"
  ) {
    // Convert to GraphHopper format
    const locations = [
      { id: "start", point: startLocation },
      ...waypoints.map((wp, index) => ({ id: `wp_${index}`, point: wp })),
      { id: "end", point: endLocation || startLocation },
    ];

    // Define vehicles (nurses) for the optimization
    const vehicles = [
      {
        vehicle_id: "nurse",
        start_address: { location_id: "start" },
        end_address: { location_id: "end" },
      },
    ];

    // Call GraphHopper optimization endpoint
    const requestData = {
      vehicles,
      services: locations.slice(1, -1).map((location) => ({
        id: location.id,
        address: {
          location_id: location.id,
          lon: location.point.lng,
          lat: location.point.lat,
        },
      })),
      algorithm: {
        problem_type: "min-max",
        objective:
          routeType === "distance" ? "transport_distance" : "transport_time",
      },
    };

    const response = await this.post("/optimize", requestData);

    return this.formatOptimizationResponse(response, locations);
  }

  // Helper to format route response
  formatRouteResponse(response) {
    if (!response.paths || !response.paths[0]) {
      return null;
    }

    const path = response.paths[0];

    // For points_encoded: false
    const points = path.points.coordinates.map((coord) => ({
      lat: coord[1],
      lng: coord[0],
    }));

    return {
      distance: path.distance,
      time: path.time,
      points: points,
      instructions: path.instructions,
    };
  }

  // Helper to format optimization response
  formatOptimizationResponse(response, originalLocations) {
    if (!response.solution) {
      return null;
    }

    // Extract the optimized route
    const route = response.solution.routes[0];

    // Map activity sequence to original locations
    const orderedPoints = route.activities.map((activity) => {
      const locationId = activity.location_id;
      const originalLocation = originalLocations.find(
        (loc) => loc.id === locationId
      );

      return {
        ...originalLocation.point,
        arrivalTime: activity.arr_time,
        departureTime: activity.end_time,
        stopType:
          locationId === "start" || locationId === "end"
            ? locationId === "start"
              ? "START"
              : "END"
            : "APPOINTMENT",
      };
    });

    return {
      distance: route.distance,
      time: route.transport_time,
      points: orderedPoints,
      waiting_time: route.waiting_time,
      completion_time: route.completion_time,
    };
  }
}

// Add to datasources/index.js
const AzureMapsAPI = require("./maps/AzureMapsAPI");
const GraphHopperAPI = require("./routing/GraphHopperAPI");

module.exports = {
  nurseAPI: new NurseAPI(),
  patientAPI: new PatientAPI(),
  appointmentAPI: new AppointmentAPI(),
  mapsAPI: new AzureMapsAPI(),
  routingAPI: new GraphHopperAPI(),
};
