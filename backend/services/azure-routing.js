// backend/services/azure-routing.js
// Azure Maps routing service - provides data for Leaflet frontend

const axios = require("axios");
const { db, appointments } = require("../db/config");
const { eq, and, like, isNotNull, inArray } = require("drizzle-orm");
const { sql } = require("drizzle-orm");
require("dotenv").config();

// ===================
// CONFIGURATION
// ===================

const CONFIG = {
  azureMapsKey: process.env.AZURE_MAPS_KEY,
  routeApiUrl: "https://atlas.microsoft.com/route/directions/json",
  matrixApiUrl: "https://atlas.microsoft.com/route/matrix/json",
  timeout: 30000,
  travelMode: "car",
  routeType: "fastest",
  fuelEfficiencyMpg: 25,
  gasPrice: 3.5,
};

// ===================
// DATA RETRIEVAL
// ===================

async function getNurseAppointmentsForDay(nurseIds, date) {
  console.log(
    `📅 Fetching appointments for ${nurseIds.length} nurses on ${date}...`
  );

  try {
    const nurseAppointments = await db
      .select({
        id: appointments.id,
        nurseId: appointments.nurseId,
        nurseName: appointments.nurseName,
        nurseLocationAddress: appointments.nurseLocationAddress,
        nurseLocationLatitude: appointments.nurseLocationLatitude,
        nurseLocationLongitude: appointments.nurseLocationLongitude,
        patientId: appointments.patientId,
        patientName: appointments.patientName,
        startDate: appointments.startDate,
        locationName: appointments.locationName,
        locationAddress: appointments.locationAddress,
        locationLatitude: appointments.locationLatitude,
        locationLongitude: appointments.locationLongitude,
        serviceType: appointments.serviceType,
        status: appointments.status,
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.nurseId, nurseIds),
          like(appointments.startDate, `${date}%`),
          // eq(appointments.status, "booked"), // FILTER FOR BOOKED APPOINTMENTS ONLY
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude),
          isNotNull(appointments.locationLatitude),
          isNotNull(appointments.locationLongitude)
        )
      )
      .orderBy(appointments.startDate);

    console.log(
      `📊 Raw query results: ${nurseAppointments.length} booked appointments found`
    );

    // Log appointment statuses for debugging
    const statusCounts = nurseAppointments.reduce((acc, apt) => {
      acc[apt.status] = (acc[apt.status] || 0) + 1;
      return acc;
    }, {});
    console.log(`📊 Status breakdown:`, statusCounts);

    // Group by nurse
    const appointmentsByNurse = nurseAppointments.reduce((acc, appointment) => {
      const nurseId = appointment.nurseId;
      if (!acc[nurseId]) {
        acc[nurseId] = {
          nurseInfo: {
            id: nurseId,
            name: appointment.nurseName,
            address: appointment.nurseLocationAddress,
            latitude: appointment.nurseLocationLatitude,
            longitude: appointment.nurseLocationLongitude,
          },
          appointments: [],
        };
      }
      acc[nurseId].appointments.push(appointment);
      return acc;
    }, {});

    console.log(
      `✅ Found booked appointments for ${
        Object.keys(appointmentsByNurse).length
      } nurses`
    );

    Object.entries(appointmentsByNurse).forEach(([nurseId, data]) => {
      console.log(
        `   👩‍⚕️ ${data.nurseInfo.name}: ${data.appointments.length} booked appointments`
      );
    });

    return appointmentsByNurse;
  } catch (error) {
    console.error("❌ Error fetching nurse appointments:", error);
    throw error;
  }
}

// ===================
// AZURE MAPS ROUTING
// ===================

async function optimizeRoute(nurseInfo, appointments) {
  console.log(
    `🗺️  Optimizing route for ${nurseInfo.name} with ${appointments.length} appointments...`
  );

  if (!CONFIG.azureMapsKey) {
    throw new Error("AZURE_MAPS_KEY environment variable is required");
  }

  if (appointments.length === 0) {
    return {
      success: false,
      error: "No appointments to route",
    };
  }

  try {
    // Calculate optimal order using distance matrix
    console.log(`   🧮 Calculating optimal visit order...`);
    const optimizedOrder = await calculateOptimalOrder(nurseInfo, appointments);

    console.log(`   🗺️  Getting route segments with distances and times...`);
    const routeSegments = await getRouteSegments(nurseInfo, optimizedOrder);

    const totalStats = calculateTotalStats(routeSegments);

    // Format for Leaflet frontend
    const leafletRoute = formatForLeaflet(
      nurseInfo,
      optimizedOrder,
      routeSegments
    );

    return {
      success: true,
      nurseInfo,
      totalAppointments: appointments.length,
      originalOrder: appointments,
      optimizedOrder: optimizedOrder,
      routeSegments: routeSegments,
      leafletData: leafletRoute, // Formatted specifically for Leaflet
      summary: {
        totalDistanceMiles: totalStats.totalDistanceMiles,
        totalTimeMinutes: totalStats.totalTimeMinutes,
        totalTimeFormatted: formatTime(totalStats.totalTimeMinutes),
        visits: appointments.length,
        estimatedFuelCost: calculateFuelCost(totalStats.totalDistanceMiles),
        averageDistancePerVisit:
          totalStats.totalDistanceMiles / appointments.length,
        averageTimePerVisit: totalStats.totalTimeMinutes / appointments.length,
      },
    };
  } catch (error) {
    console.error(
      `❌ Route optimization failed for ${nurseInfo.name}:`,
      error.message
    );
    return {
      success: false,
      error: error.message,
      nurseInfo,
    };
  }
}

async function calculateOptimalOrder(nurseInfo, appointments) {
  // Simple nearest-neighbor optimization for now
  // You could implement more sophisticated algorithms later

  const allLocations = [
    {
      name: `${nurseInfo.name} (Start)`,
      lat: nurseInfo.latitude,
      lng: nurseInfo.longitude,
      type: "start",
    },
    ...appointments.map((apt) => ({
      name: apt.patientName,
      lat: apt.locationLatitude,
      lng: apt.locationLongitude,
      appointment: apt,
      type: "visit",
    })),
  ];

  // For small numbers of appointments, use original order
  // For larger numbers, implement optimization
  if (appointments.length <= 3) {
    console.log(
      `   📊 Using original order for ${appointments.length} appointments`
    );
    return appointments;
  }

  // Simple optimization: sort by distance from nurse location
  const optimized = appointments.sort((a, b) => {
    const distA = calculateDistance(
      nurseInfo.latitude,
      nurseInfo.longitude,
      a.locationLatitude,
      a.locationLongitude
    );
    const distB = calculateDistance(
      nurseInfo.latitude,
      nurseInfo.longitude,
      b.locationLatitude,
      b.locationLongitude
    );
    return distA - distB;
  });

  console.log(
    `   ✅ Optimized order calculated for ${optimized.length} appointments`
  );
  return optimized;
}

async function getRouteSegments(nurseInfo, optimizedAppointments) {
  console.log(
    `   🗺️  Getting ${optimizedAppointments.length + 1} route segments...`
  );

  const segments = [];
  let currentLocation = {
    name: `${nurseInfo.name} (Start)`,
    latitude: nurseInfo.latitude,
    longitude: nurseInfo.longitude,
  };

  // Route from nurse to each appointment
  for (let i = 0; i < optimizedAppointments.length; i++) {
    const appointment = optimizedAppointments[i];
    const destination = {
      name: appointment.patientName,
      latitude: appointment.locationLatitude,
      longitude: appointment.locationLongitude,
    };

    console.log(
      `     🚗 Segment ${i + 1}: ${currentLocation.name} → ${destination.name}`
    );

    const segment = await getAzureMapsRoute(
      currentLocation,
      destination,
      appointment
    );
    segments.push(segment);

    currentLocation = destination;
  }

  // Route back to nurse location
  const returnDestination = {
    name: `${nurseInfo.name} (Home)`,
    latitude: nurseInfo.latitude,
    longitude: nurseInfo.longitude,
  };

  console.log(
    `     🏠 Return segment: ${currentLocation.name} → ${returnDestination.name}`
  );
  const returnSegment = await getAzureMapsRoute(
    currentLocation,
    returnDestination,
    null
  );
  segments.push(returnSegment);

  console.log(`   ✅ Generated ${segments.length} route segments`);
  return segments;
}

async function getAzureMapsRoute(origin, destination, appointment) {
  try {
    const params = new URLSearchParams({
      "api-version": "1.0",
      "subscription-key": CONFIG.azureMapsKey,
      query: `${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}`,
      travelMode: CONFIG.travelMode,
      routeType: CONFIG.routeType,
    });

    const response = await axios.get(`${CONFIG.routeApiUrl}?${params}`, {
      timeout: CONFIG.timeout,
    });

    const route = response.data.routes?.[0];
    if (!route) {
      throw new Error("No route found");
    }

    const summary = route.summary;
    const distanceMeters = summary.lengthInMeters;
    const timeSeconds = summary.travelTimeInSeconds;

    // Extract route points for Leaflet polyline
    const routePoints = extractRoutePoints(route);

    return {
      from: origin.name,
      to: destination.name,
      appointment: appointment,
      distanceMiles: metersToMiles(distanceMeters),
      timeMinutes: secondsToMinutes(timeSeconds),
      routePoints: routePoints, // Array of [lat, lng] for Leaflet
      success: true,
    };
  } catch (error) {
    console.error(
      `❌ Azure routing failed: ${origin.name} → ${destination.name}:`,
      error.message
    );
    return {
      from: origin.name,
      to: destination.name,
      appointment: appointment,
      distanceMiles: 0,
      timeMinutes: 0,
      routePoints: [],
      success: false,
      error: error.message,
    };
  }
}

function extractRoutePoints(route) {
  // Extract coordinates from Azure Maps response and format for Leaflet
  const points = [];

  if (route.legs && route.legs.length > 0) {
    route.legs.forEach((leg) => {
      if (leg.points && leg.points.length > 0) {
        leg.points.forEach((point) => {
          points.push([point.latitude, point.longitude]);
        });
      }
    });
  }

  return points;
}

function formatForLeaflet(nurseInfo, optimizedOrder, routeSegments) {
  // Format data specifically for Leaflet consumption

  const markers = [
    // Nurse start/end marker
    {
      id: `nurse-${nurseInfo.id}`,
      type: "nurse",
      position: [nurseInfo.latitude, nurseInfo.longitude],
      popup: {
        title: nurseInfo.name,
        address: nurseInfo.address,
        type: "Start/End Location",
      },
      icon: "nurse",
    },
  ];

  // Patient visit markers
  optimizedOrder.forEach((appointment, index) => {
    markers.push({
      id: `patient-${appointment.id}`,
      type: "patient",
      visitOrder: index + 1,
      position: [appointment.locationLatitude, appointment.locationLongitude],
      popup: {
        title: appointment.patientName,
        address: appointment.locationAddress,
        scheduledTime: appointment.startDate,
        serviceType: appointment.serviceType,
        visitNumber: index + 1,
      },
      icon: "patient",
    });
  });

  // Route polylines
  const polylines = routeSegments
    .filter((segment) => segment.success && segment.routePoints.length > 0)
    .map((segment, index) => ({
      id: `route-segment-${index}`,
      points: segment.routePoints,
      color: segment.appointment ? "#0078d4" : "#888888", // Different color for return trip
      weight: 4,
      opacity: 0.7,
    }));

  return {
    markers,
    polylines,
    bounds: calculateBounds([
      ...markers.map((m) => m.position),
      ...polylines.flatMap((p) => p.points),
    ]),
  };
}

// ===================
// UTILITY FUNCTIONS
// ===================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

function calculateTotalStats(segments) {
  return segments.reduce(
    (acc, segment) => ({
      totalDistanceMiles: acc.totalDistanceMiles + segment.distanceMiles,
      totalTimeMinutes: acc.totalTimeMinutes + segment.timeMinutes,
    }),
    { totalDistanceMiles: 0, totalTimeMinutes: 0 }
  );
}

function calculateBounds(positions) {
  if (positions.length === 0) return null;

  let minLat = positions[0][0],
    maxLat = positions[0][0];
  let minLng = positions[0][1],
    maxLng = positions[0][1];

  positions.forEach((pos) => {
    minLat = Math.min(minLat, pos[0]);
    maxLat = Math.max(maxLat, pos[0]);
    minLng = Math.min(minLng, pos[1]);
    maxLng = Math.max(maxLng, pos[1]);
  });

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

function calculateFuelCost(miles) {
  return (miles / CONFIG.fuelEfficiencyMpg) * CONFIG.gasPrice;
}

function metersToMiles(meters) {
  return meters * 0.000621371;
}

function secondsToMinutes(seconds) {
  return seconds / 60;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// ===================
// MAIN FUNCTIONS
// ===================

async function generateOptimalRoutes(nurseIds, date) {
  console.log(
    `🚀 Starting Azure Maps route optimization for ${nurseIds.length} nurses on ${date}...`
  );

  if (!CONFIG.azureMapsKey) {
    throw new Error("AZURE_MAPS_KEY environment variable is required");
  }

  try {
    // Get appointments for all nurses
    const appointmentsByNurse = await getNurseAppointmentsForDay(
      nurseIds,
      date
    );

    if (Object.keys(appointmentsByNurse).length === 0) {
      return {
        success: false,
        error: "No booked appointments found for the specified nurses and date",
      };
    }

    // Generate optimized routes for each nurse
    const routePromises = Object.entries(appointmentsByNurse).map(
      ([nurseId, data]) => optimizeRoute(data.nurseInfo, data.appointments)
    );

    console.log(`⚡ Processing ${routePromises.length} nurses...`);
    const routes = await Promise.all(routePromises);

    // Separate successful and failed routes
    const successfulRoutes = routes.filter((route) => route.success);
    const failedRoutes = routes.filter((route) => !route.success);

    // Calculate overall statistics
    const overallStats = calculateOverallStats(successfulRoutes);

    console.log(`\n📊 Azure Maps Route Optimization Summary:`);
    console.log(
      `   Successful routes: ${successfulRoutes.length}/${routes.length}`
    );
    console.log(`   Failed routes: ${failedRoutes.length}/${routes.length}`);
    console.log(
      `   Total distance: ${overallStats.totalDistance.toFixed(1)} miles`
    );
    console.log(`   Total travel time: ${overallStats.totalTimeFormatted}`);
    console.log(
      `   Total estimated fuel cost: $${overallStats.totalFuelCost.toFixed(2)}`
    );

    return {
      success: true,
      date,
      nursesProcessed: routes.length,
      successfulRoutes: successfulRoutes.length,
      failedRoutes: failedRoutes.length,
      routes: successfulRoutes,
      failures: failedRoutes,
      overallStats,
    };
  } catch (error) {
    console.error("❌ Azure Maps route optimization failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function calculateOverallStats(routes) {
  const totalDistance = routes.reduce(
    (sum, route) => sum + (route.summary?.totalDistanceMiles || 0),
    0
  );
  const totalTime = routes.reduce(
    (sum, route) => sum + (route.summary?.totalTimeMinutes || 0),
    0
  );
  const totalFuelCost = routes.reduce(
    (sum, route) => sum + (route.summary?.estimatedFuelCost || 0),
    0
  );
  const totalVisits = routes.reduce(
    (sum, route) => sum + (route.summary?.visits || 0),
    0
  );

  return {
    totalDistance,
    totalTime,
    totalTimeFormatted: formatTime(totalTime),
    totalFuelCost,
    totalVisits,
    averageDistancePerNurse:
      routes.length > 0 ? totalDistance / routes.length : 0,
    averageTimePerNurse: routes.length > 0 ? totalTime / routes.length : 0,
  };
}

// ===================
// EXPORTS
// ===================

module.exports = {
  generateOptimalRoutes,
  optimizeRoute,
  getNurseAppointmentsForDay,
  calculateFuelCost,
  formatTime,
};

// ===================
// CLI TESTING
// ===================

if (require.main === module) {
  const { initializeDatabase } = require("../db/config");

  initializeDatabase();

  // Example usage - replace with actual nurse IDs from your database
  console.log("🧪 Testing Azure routing service...");
  console.log("Replace testNurseIds with actual nurse IDs from your database");

  // Uncomment and update these lines for testing:
  // const testNurseIds = ['your-actual-nurse-id'];
  // const testDate = '2025-07-01';
  //
  // generateOptimalRoutes(testNurseIds, testDate)
  //   .then(result => {
  //     console.log('\n🏁 Azure routing test completed!');
  //     if (result.success) {
  //       console.log(`Generated ${result.successfulRoutes} optimized routes`);
  //       console.log('Leaflet data ready for frontend rendering');
  //     } else {
  //       console.log(`Failed: ${result.error}`);
  //     }
  //     process.exit(result.success ? 0 : 1);
  //   });
}
