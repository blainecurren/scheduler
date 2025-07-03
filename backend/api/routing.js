// backend/api/routing.js
// API endpoints for Azure Maps route optimization

const express = require("express");
const {
  generateOptimalRoutes,
  optimizeRoute,
  getNurseAppointmentsForDay,
} = require("../services/azure-routing");
const { db, appointments } = require("../db/config");
const { isNotNull, and } = require("drizzle-orm");
const { sql } = require("drizzle-orm");

const router = express.Router();

// ===================
// ROUTE OPTIMIZATION ENDPOINTS
// ===================

// POST /api/routing/optimize
// Generate optimal routes for specific nurses on a specific date
router.post("/optimize", async (req, res) => {
  try {
    const { nurseIds, date } = req.body;

    // Validation
    if (!nurseIds || !Array.isArray(nurseIds) || nurseIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "nurseIds is required and must be a non-empty array",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        error: "date is required (format: YYYY-MM-DD)",
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: "date must be in YYYY-MM-DD format",
      });
    }

    console.log(
      `🚀 API: Optimizing routes for ${nurseIds.length} nurses on ${date}...`
    );

    // Check if Azure Maps is configured
    if (!process.env.AZURE_MAPS_KEY) {
      return res.status(500).json({
        success: false,
        error:
          "Azure Maps API key not configured. Please set AZURE_MAPS_KEY environment variable.",
      });
    }

    const result = await generateOptimalRoutes(nurseIds, date);

    // Add this to your backend/api/routing.js in the POST /optimize endpoint
    // Replace the existing success response section with this:

    if (result.success) {
      // 🔍 DEBUG: API response before sending to frontend
      console.log(`\n🌐 API Response Debug:`);
      console.log(`   result.success: ${result.success}`);
      console.log(`   result.routes length: ${result.routes?.length || 0}`);

      if (result.routes && result.routes.length > 0) {
        result.routes.forEach((route, i) => {
          console.log(`   route[${i}]: ${route.nurseInfo?.name}`);
          console.log(`     leafletData present: ${!!route.leafletData}`);
          if (route.leafletData) {
            console.log(
              `     markers: ${route.leafletData.markers?.length || 0}`
            );
            console.log(
              `     polylines: ${route.leafletData.polylines?.length || 0}`
            );

            // Log first polyline details
            if (route.leafletData.polylines?.[0]) {
              const poly = route.leafletData.polylines[0];
              console.log(
                `     first polyline: id=${poly.id}, points=${
                  poly.points?.length || 0
                }, color=${poly.color}`
              );
              if (poly.points && poly.points.length > 0) {
                console.log(
                  `       first point: [${poly.points[0][0]}, ${poly.points[0][1]}]`
                );
              }
            }
          }
        });
      }

      const responseData = {
        success: true,
        message: "Route optimization completed successfully",
        data: {
          date: result.date,
          nursesProcessed: result.nursesProcessed,
          successfulRoutes: result.successfulRoutes,
          failedRoutes: result.failedRoutes,
          routes: result.routes,
          overallStats: result.overallStats,
        },
      };

      // 🔍 DEBUG: Final API response structure
      debugRouteData("API_RESPONSE", responseData, "Final Response");

      res.json(responseData);
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("❌ Route optimization API error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during route optimization",
    });
  }
});

// POST /api/routing/optimize-single
// Optimize route for a single nurse
router.post("/optimize-single", async (req, res) => {
  try {
    const { nurseId, date } = req.body;

    if (!nurseId || !date) {
      return res.status(400).json({
        success: false,
        error: "nurseId and date are required",
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: "date must be in YYYY-MM-DD format",
      });
    }

    console.log(`🗺️  API: Optimizing route for nurse ${nurseId} on ${date}...`);

    const result = await generateOptimalRoutes([nurseId], date);

    if (result.success && result.routes.length > 0) {
      // Return just the single route data
      const singleRoute = result.routes[0];
      res.json({
        success: true,
        message: "Single nurse route optimization completed",
        data: singleRoute,
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error || "No routes found for this nurse and date",
      });
    }
  } catch (error) {
    console.error("❌ Single route optimization API error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during single route optimization",
    });
  }
});

// GET /api/routing/appointments/:nurseId/:date
// Get appointments for a specific nurse on a specific date (for preview)
router.get("/appointments/:nurseId/:date", async (req, res) => {
  try {
    const { nurseId, date } = req.params;

    console.log(
      `📅 API: Fetching appointments for nurse ${nurseId} on ${date}...`
    );

    const appointmentsByNurse = await getNurseAppointmentsForDay(
      [nurseId],
      date
    );

    if (appointmentsByNurse[nurseId]) {
      res.json({
        success: true,
        data: {
          nurseInfo: appointmentsByNurse[nurseId].nurseInfo,
          appointments: appointmentsByNurse[nurseId].appointments,
          totalAppointments: appointmentsByNurse[nurseId].appointments.length,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error:
          "No appointments found for this nurse and date, or nurse coordinates missing",
      });
    }
  } catch (error) {
    console.error("❌ Appointments fetch API error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error fetching appointments",
    });
  }
});

// ===================
// ROUTING STATUS & INFO
// ===================

// GET /api/routing/status
// Check routing service status and configuration
router.get("/status", async (req, res) => {
  try {
    console.log("📊 API: Checking routing service status...");

    const azureMapsConfigured = !!process.env.AZURE_MAPS_KEY;

    // Quick database checks
    const totalAppointments = await db
      .select({
        count: sql`count(*)`,
      })
      .from(appointments);

    const appointmentsWithBothCoords = await db
      .select({
        count: sql`count(*)`,
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude),
          isNotNull(appointments.locationLatitude),
          isNotNull(appointments.locationLongitude)
        )
      );

    const uniqueNursesWithCoords = await db
      .selectDistinct({
        nurseName: appointments.nurseName,
        nurseId: appointments.nurseId,
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude)
        )
      );

    const routableAppointments = appointmentsWithBothCoords[0]?.count || 0;
    const totalAppointmentsCount = totalAppointments[0]?.count || 0;
    const routablePercentage =
      totalAppointmentsCount > 0
        ? Math.round((routableAppointments / totalAppointmentsCount) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        azureMapsConfigured,
        serviceReady: azureMapsConfigured && routableAppointments > 0,
        statistics: {
          totalAppointments: totalAppointmentsCount,
          routableAppointments,
          routablePercentage,
          nursesWithCoordinates: uniqueNursesWithCoords.length,
        },
        configuration: {
          provider: "Azure Maps",
          mapRenderer: "Leaflet + OpenStreetMap",
          fuelEfficiency: "25 MPG",
          gasPrice: "$3.50/gallon",
        },
      },
    });
  } catch (error) {
    console.error("❌ Error checking routing status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check routing service status",
    });
  }
});

// GET /api/routing/nurses-with-routes/:date
// Get list of nurses who have appointments and coordinates for routing on a specific date
router.get("/nurses-with-routes/:date", async (req, res) => {
  try {
    const { date } = req.params;

    console.log(
      `👩‍⚕️ API: Finding nurses with routable appointments on ${date}...`
    );

    const nursesWithRoutes = await db
      .selectDistinct({
        nurseId: appointments.nurseId,
        nurseName: appointments.nurseName,
        nurseAddress: appointments.nurseLocationAddress,
        appointmentCount: sql`count(*)`,
      })
      .from(appointments)
      .where(
        and(
          sql`date(${appointments.startDate}) = ${date}`,
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude),
          isNotNull(appointments.locationLatitude),
          isNotNull(appointments.locationLongitude)
        )
      )
      .groupBy(
        appointments.nurseId,
        appointments.nurseName,
        appointments.nurseLocationAddress
      )
      .orderBy(appointments.nurseName);

    res.json({
      success: true,
      data: {
        date,
        nurses: nursesWithRoutes,
        totalNurses: nursesWithRoutes.length,
        totalAppointments: nursesWithRoutes.reduce(
          (sum, nurse) => sum + (nurse.appointmentCount || 0),
          0
        ),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching nurses with routes:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch nurses with routable appointments",
    });
  }
});

// ===================
// BULK OPERATIONS
// ===================

// POST /api/routing/optimize-all-today
// Optimize routes for all nurses with appointments today
router.post("/optimize-all-today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    console.log(`🚀 API: Optimizing routes for ALL nurses today (${today})...`);

    // Get all nurses with appointments today
    const nursesWithRoutes = await db
      .selectDistinct({
        nurseId: appointments.nurseId,
      })
      .from(appointments)
      .where(
        and(
          sql`date(${appointments.startDate}) = ${today}`,
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude),
          isNotNull(appointments.locationLatitude),
          isNotNull(appointments.locationLongitude)
        )
      );

    if (nursesWithRoutes.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No nurses with routable appointments found for today",
      });
    }

    const nurseIds = nursesWithRoutes.map((nurse) => nurse.nurseId);
    console.log(
      `   Found ${nurseIds.length} nurses with routable appointments`
    );

    const result = await generateOptimalRoutes(nurseIds, today);

    if (result.success) {
      res.json({
        success: true,
        message: `Optimized routes for all ${result.successfulRoutes} nurses today`,
        data: result,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("❌ Bulk route optimization API error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during bulk route optimization",
    });
  }
});

module.exports = router;
