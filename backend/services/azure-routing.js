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
    `📅 Fetching BOOKED appointments for ${nurseIds.length} nurses on ${date}...`
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
          eq(appointments.status, "booked"), // ✅ FIXED: Filter for booked appointments only
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude),
          isNotNull(appointments.locationLatitude),
          isNotNull(appointments.locationLongitude)
        )
      )
      .orderBy(appointments.startDate);

    console.log(
      `📊 Query results: Found ${nurseAppointments.length} BOOKED appointments`
    );

    // Enhanced debugging - log appointment statuses
    const statusCounts = nurseAppointments.reduce((acc, apt) => {
      acc[apt.status] = (acc[apt.status] || 0) + 1;
      return acc;
    }, {});
    console.log(`📊 Status breakdown:`, statusCounts);

    // Additional validation - ensure all are booked
    const nonBookedCount = nurseAppointments.filter(
      (apt) => apt.status !== "booked"
    ).length;
    if (nonBookedCount > 0) {
      console.warn(
        `⚠️  WARNING: Found ${nonBookedCount} non-booked appointments in results!`
      );
    }

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

// backend/services/azure-routing.js
// Enhanced route optimization with proper validation

async function generateOptimalRoutes(nurseIds, date) {
  console.log(
    `🚀 Starting Azure Maps route optimization for ${nurseIds.length} nurses on ${date}...`
  );

  if (!CONFIG.azureMapsKey) {
    throw new Error("AZURE_MAPS_KEY environment variable is required");
  }

  try {
    // Step 1: Validate nurse IDs exist and have coordinates
    console.log(`🔍 Step 1: Validating nurses and their coordinates...`);
    const validNurses = await validateNurseCoordinates(nurseIds);

    if (validNurses.length === 0) {
      return {
        success: false,
        error: "No nurses found with valid coordinates for routing",
      };
    }

    if (validNurses.length < nurseIds.length) {
      const missingNurses = nurseIds.filter((id) => !validNurses.includes(id));
      console.warn(
        `⚠️  ${
          missingNurses.length
        } nurses missing coordinates: ${missingNurses.join(", ")}`
      );
    }

    // Step 2: Get appointments for validated nurses - WITH PROPER AWAIT
    console.log(
      `📅 Step 2: Fetching BOOKED appointments for validated nurses...`
    );
    const appointmentsByNurse = await getNurseAppointmentsForDay(
      validNurses,
      date
    );

    // Step 3: Validate appointment data before proceeding
    console.log(`✅ Step 3: Validating appointment data...`);
    const nursesWithAppointments = Object.keys(appointmentsByNurse);

    if (nursesWithAppointments.length === 0) {
      return {
        success: false,
        error: `No BOOKED appointments found for any nurses on ${date}. Check that appointments exist and have status='booked'.`,
      };
    }

    console.log(`📊 Validation results:`);
    console.log(`   👩‍⚕️ Nurses requested: ${nurseIds.length}`);
    console.log(`   ✅ Nurses with coordinates: ${validNurses.length}`);
    console.log(
      `   📅 Nurses with booked appointments: ${nursesWithAppointments.length}`
    );

    // Step 4: Wait for appointment data processing to complete
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay to ensure data is ready

    // Step 5: Generate optimized routes for each nurse
    console.log(
      `🗺️  Step 4: Starting Azure Maps optimization for ${nursesWithAppointments.length} nurses...`
    );

    const routePromises = Object.entries(appointmentsByNurse).map(
      async ([nurseId, data]) => {
        console.log(
          `   🚀 Starting optimization for ${data.nurseInfo.name}...`
        );
        const result = await optimizeRoute(data.nurseInfo, data.appointments);
        console.log(
          `   ${result.success ? "✅" : "❌"} Completed ${
            data.nurseInfo.name
          }: ${result.success ? "Success" : result.error}`
        );
        return result;
      }
    );

    console.log(
      `⏳ Processing ${routePromises.length} nurses with Azure Maps...`
    );
    const routes = await Promise.all(routePromises);

    // Step 6: Process results
    console.log(`📊 Step 5: Processing optimization results...`);
    const successfulRoutes = routes.filter((route) => route.success);
    const failedRoutes = routes.filter((route) => !route.success);

    // Log detailed results
    console.log(`📈 Optimization Results:`);
    console.log(
      `   ✅ Successful routes: ${successfulRoutes.length}/${routes.length}`
    );
    console.log(`   ❌ Failed routes: ${failedRoutes.length}/${routes.length}`);

    if (failedRoutes.length > 0) {
      console.log(`❌ Failed route details:`);
      failedRoutes.forEach((route) => {
        console.log(
          `   - ${route.nurseInfo?.name || "Unknown"}: ${route.error}`
        );
      });
    }

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

// New helper function to validate nurse coordinates
async function validateNurseCoordinates(nurseIds) {
  console.log(`🔍 Validating coordinates for ${nurseIds.length} nurses...`);

  try {
    const nursesWithCoords = await db
      .selectDistinct({
        nurseId: appointments.nurseId,
        nurseName: appointments.nurseName,
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.nurseId, nurseIds),
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude)
        )
      );

    const validNurseIds = nursesWithCoords.map((nurse) => nurse.nurseId);

    console.log(`✅ Found ${validNurseIds.length} nurses with coordinates:`);
    nursesWithCoords.forEach((nurse) => {
      console.log(`   👩‍⚕️ ${nurse.nurseName} (${nurse.nurseId})`);
    });

    return validNurseIds;
  } catch (error) {
    console.error("❌ Error validating nurse coordinates:", error);
    throw error;
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

// Add this debugging function to your backend/services/azure-routing.js
// Place it before the module.exports section

function debugRouteData(stage, data, label = "") {
  console.log(`\n🔍 DEBUG ${stage} ${label}:`);
  console.log(`📊 Type: ${typeof data}, IsArray: ${Array.isArray(data)}`);

  if (stage === "AZURE_RAW_RESPONSE") {
    console.log(`📡 Azure Maps Response Structure:`);
    console.log(`   routes array length: ${data.routes?.length || 0}`);
    if (data.routes?.[0]) {
      const route = data.routes[0];
      console.log(
        `   summary: lengthInMeters=${route.summary?.lengthInMeters}, travelTimeInSeconds=${route.summary?.travelTimeInSeconds}`
      );
      console.log(`   legs count: ${route.legs?.length || 0}`);
      if (route.legs?.[0]?.points) {
        console.log(
          `   first leg points count: ${route.legs[0].points.length}`
        );
        console.log(
          `   sample point: ${JSON.stringify(route.legs[0].points[0])}`
        );
      }
    }
  } else if (stage === "EXTRACTED_POINTS") {
    console.log(`📍 Extracted Route Points:`);
    console.log(`   points array length: ${data.length}`);
    if (data.length > 0) {
      console.log(`   first point: [${data[0][0]}, ${data[0][1]}]`);
      console.log(
        `   last point: [${data[data.length - 1][0]}, ${
          data[data.length - 1][1]
        }]`
      );
      console.log(`   sample points: ${JSON.stringify(data.slice(0, 3))}`);
    }
  } else if (stage === "ROUTE_SEGMENTS") {
    console.log(`🛣️  Route Segments Array:`);
    console.log(`   segments count: ${data.length}`);
    data.forEach((segment, i) => {
      console.log(`   segment ${i}: ${segment.from} → ${segment.to}`);
      console.log(
        `     success: ${segment.success}, points: ${
          segment.routePoints?.length || 0
        }`
      );
      if (segment.routePoints?.length > 0) {
        console.log(
          `     first point: [${segment.routePoints[0][0]}, ${segment.routePoints[0][1]}]`
        );
      }
    });
  } else if (stage === "LEAFLET_DATA") {
    console.log(`🍃 Leaflet Formatted Data:`);
    console.log(`   markers count: ${data.markers?.length || 0}`);
    console.log(`   polylines count: ${data.polylines?.length || 0}`);

    if (data.markers) {
      data.markers.forEach((marker, i) => {
        console.log(
          `   marker ${i}: ${marker.type} - ${marker.id} at [${marker.position[0]}, ${marker.position[1]}]`
        );
      });
    }

    if (data.polylines) {
      data.polylines.forEach((polyline, i) => {
        console.log(
          `   polyline ${i}: ${polyline.id}, points: ${
            polyline.points?.length || 0
          }, color: ${polyline.color}`
        );
        if (polyline.points?.length > 0) {
          console.log(
            `     first point: [${polyline.points[0][0]}, ${polyline.points[0][1]}]`
          );
        }
      });
    }
  } else if (stage === "FINAL_ROUTE_OBJECT") {
    console.log(`🎯 Final Route Object Structure:`);
    console.log(`   success: ${data.success}`);
    console.log(
      `   nurseInfo: ${data.nurseInfo?.name} (${data.nurseInfo?.id})`
    );
    console.log(`   totalAppointments: ${data.totalAppointments}`);
    console.log(
      `   optimizedOrder length: ${data.optimizedOrder?.length || 0}`
    );
    console.log(`   routeSegments length: ${data.routeSegments?.length || 0}`);
    console.log(`   leafletData present: ${!!data.leafletData}`);
    if (data.leafletData) {
      console.log(
        `     leafletData.markers: ${data.leafletData.markers?.length || 0}`
      );
      console.log(
        `     leafletData.polylines: ${data.leafletData.polylines?.length || 0}`
      );
    }
    console.log(
      `   summary: distance=${data.summary?.totalDistanceMiles}mi, time=${data.summary?.totalTimeMinutes}min`
    );
  } else if (stage === "API_RESPONSE") {
    console.log(`🌐 API Response to Frontend:`);
    console.log(`   success: ${data.success}`);
    console.log(`   data.routes length: ${data.data?.routes?.length || 0}`);
    if (data.data?.routes?.[0]) {
      const route = data.data.routes[0];
      console.log(`   route[0].leafletData present: ${!!route.leafletData}`);
      if (route.leafletData) {
        console.log(`     markers: ${route.leafletData.markers?.length || 0}`);
        console.log(
          `     polylines: ${route.leafletData.polylines?.length || 0}`
        );
      }
    }
  }

  console.log(`🔍 END DEBUG ${stage}\n`);
}

// Updated getAzureMapsRoute function with debugging
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

    // 🔍 DEBUG: Azure raw response
    debugRouteData(
      "AZURE_RAW_RESPONSE",
      response.data,
      `${origin.name} → ${destination.name}`
    );

    const route = response.data.routes?.[0];
    if (!route) {
      throw new Error("No route found");
    }

    const summary = route.summary;
    const distanceMeters = summary.lengthInMeters;
    const timeSeconds = summary.travelTimeInSeconds;

    // Extract route points for Leaflet polyline
    const routePoints = extractRoutePoints(route);

    // 🔍 DEBUG: Extracted points
    debugRouteData(
      "EXTRACTED_POINTS",
      routePoints,
      `${origin.name} → ${destination.name}`
    );

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

// Updated optimizeRoute function with debugging
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

    // 🔍 DEBUG: Route segments
    debugRouteData("ROUTE_SEGMENTS", routeSegments, nurseInfo.name);

    const totalStats = calculateTotalStats(routeSegments);

    // Format for Leaflet frontend
    console.log(`   🍃 Formatting data for Leaflet...`);
    const leafletRoute = formatForLeaflet(
      nurseInfo,
      optimizedOrder,
      routeSegments
    );

    // 🔍 DEBUG: Leaflet formatted data
    debugRouteData("LEAFLET_DATA", leafletRoute, nurseInfo.name);

    const finalRoute = {
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

    // 🔍 DEBUG: Final route object
    debugRouteData("FINAL_ROUTE_OBJECT", finalRoute, nurseInfo.name);

    return finalRoute;
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
