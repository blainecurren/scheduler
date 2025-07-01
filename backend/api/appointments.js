// backend/api/appointments.js
// API endpoints for appointment filtering, querying, and sync using Drizzle ORM

const express = require("express");
const { db, appointments } = require("../db/config");
const {
  eq,
  inArray,
  and,
  or,
  like,
  between,
  ne,
  gte,
  lte,
  isNotNull,
} = require("drizzle-orm");
const { sql } = require("drizzle-orm");

const router = express.Router();

// ===================
// FILTER OPTIONS
// ===================

// GET /api/appointments/options
router.get("/options", async (req, res) => {
  try {
    console.log("📋 Fetching filter options...");

    // Get unique nurses
    const nurses = await db
      .selectDistinct({
        id: appointments.nurseId,
        name: appointments.nurseName,
      })
      .from(appointments)
      .where(
        and(isNotNull(appointments.nurseId), isNotNull(appointments.nurseName))
      )
      .orderBy(appointments.nurseName);

    // Get unique patients
    const patients = await db
      .selectDistinct({
        id: appointments.patientId,
        name: appointments.patientName,
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.patientId),
          isNotNull(appointments.patientName)
        )
      )
      .orderBy(appointments.patientName);

    // Get unique service types
    const serviceTypes = await db
      .selectDistinct({
        code: appointments.serviceCode,
        display: appointments.serviceType,
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.serviceCode),
          isNotNull(appointments.serviceType)
        )
      )
      .orderBy(appointments.serviceType);

    // Get unique statuses
    const statusResults = await db
      .selectDistinct({
        status: appointments.status,
      })
      .from(appointments)
      .where(isNotNull(appointments.status))
      .orderBy(appointments.status);

    // Get unique locations
    const locations = await db
      .selectDistinct({
        id: appointments.locationId,
        name: appointments.locationName,
        address: appointments.locationAddress,
        latitude: appointments.locationLatitude,
        longitude: appointments.locationLongitude,
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.locationId),
          isNotNull(appointments.locationName)
        )
      )
      .orderBy(appointments.locationName);

    const result = {
      nurses: nurses.filter((n) => n.id && n.name),
      patients: patients.filter((p) => p.id && p.name),
      serviceTypes: serviceTypes.filter((s) => s.code && s.display),
      statuses: statusResults.map((s) => s.status).filter(Boolean),
      locations: locations.filter((l) => l.id && l.name),
    };

    console.log(
      `✅ Found ${result.nurses.length} nurses, ${result.patients.length} patients, ${result.serviceTypes.length} service types`
    );
    res.json(result);
  } catch (error) {
    console.error("❌ Error fetching filter options:", error);
    res.status(500).json({ error: "Failed to fetch filter options" });
  }
});

// ===================
// APPOINTMENT FILTERING
// ===================

// GET /api/appointments/filter
router.get("/filter", async (req, res) => {
  try {
    const {
      nurses,
      patients,
      statuses,
      serviceTypes,
      locations,
      dateFrom,
      dateTo,
      hasCoordinates,
    } = req.query;

    console.log("🔍 Filtering appointments with:", {
      nurses,
      patients,
      statuses,
      dateFrom,
      dateTo,
    });

    const conditions = [];

    // Filter by nurses
    if (nurses) {
      const nurseIds = nurses.split(",").filter(Boolean);
      if (nurseIds.length > 0) {
        conditions.push(inArray(appointments.nurseId, nurseIds));
        console.log(`   👩‍⚕️ Filtering by ${nurseIds.length} nurses`);
      }
    }

    // Filter by patients
    if (patients) {
      const patientIds = patients.split(",").filter(Boolean);
      if (patientIds.length > 0) {
        conditions.push(inArray(appointments.patientId, patientIds));
        console.log(`   👤 Filtering by ${patientIds.length} patients`);
      }
    }

    // Filter by statuses
    if (statuses) {
      const statusList = statuses.split(",").filter(Boolean);
      if (statusList.length > 0) {
        conditions.push(inArray(appointments.status, statusList));
        console.log(`   📋 Filtering by statuses: ${statusList.join(", ")}`);
      }
    }

    // Filter by service types
    if (serviceTypes) {
      const serviceList = serviceTypes.split(",").filter(Boolean);
      if (serviceList.length > 0) {
        conditions.push(inArray(appointments.serviceCode, serviceList));
        console.log(`   🏥 Filtering by ${serviceList.length} service types`);
      }
    }

    // Filter by locations
    if (locations) {
      const locationIds = locations.split(",").filter(Boolean);
      if (locationIds.length > 0) {
        conditions.push(inArray(appointments.locationId, locationIds));
        console.log(`   📍 Filtering by ${locationIds.length} locations`);
      }
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      if (dateFrom && dateTo) {
        conditions.push(
          between(appointments.startDate, dateFrom, dateTo + " 23:59:59")
        );
        console.log(`   📅 Date range: ${dateFrom} to ${dateTo}`);
      } else if (dateFrom) {
        conditions.push(gte(appointments.startDate, dateFrom));
        console.log(`   📅 From date: ${dateFrom}`);
      } else if (dateTo) {
        conditions.push(lte(appointments.startDate, dateTo + " 23:59:59"));
        console.log(`   📅 To date: ${dateTo}`);
      }
    }

    // Filter by coordinates availability (for mapping)
    if (hasCoordinates === "true") {
      conditions.push(
        and(
          isNotNull(appointments.locationLatitude),
          isNotNull(appointments.locationLongitude)
        )
      );
      console.log(`   🗺️  Only appointments with coordinates`);
    }

    // Build and execute query
    let query = db.select().from(appointments);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(appointments.startDate);

    console.log(`✅ Found ${results.length} appointments matching filters`);

    res.json({
      count: results.length,
      appointments: results,
    });
  } catch (error) {
    console.error("❌ Error filtering appointments:", error);
    res.status(500).json({ error: "Failed to filter appointments" });
  }
});

// ===================
// MAPPABLE APPOINTMENTS
// ===================

// GET /api/appointments/mappable
router.get("/mappable", async (req, res) => {
  try {
    const {
      nurses,
      date = new Date().toISOString().split("T")[0],
      statuses = "fulfilled",
    } = req.query;

    console.log(`🗺️  Fetching mappable appointments for ${date}`);

    const conditions = [
      // Must have coordinates for mapping
      isNotNull(appointments.locationLatitude),
      isNotNull(appointments.locationLongitude),
      // Filter by date
      like(appointments.startDate, `${date}%`),
    ];

    // Optional nurse filter
    if (nurses) {
      const nurseIds = nurses.split(",").filter(Boolean);
      if (nurseIds.length > 0) {
        conditions.push(inArray(appointments.nurseId, nurseIds));
      }
    }

    // Optional status filter
    if (statuses) {
      const statusList = statuses.split(",").filter(Boolean);
      if (statusList.length > 0) {
        conditions.push(inArray(appointments.status, statusList));
      }
    }

    const results = await db
      .select({
        id: appointments.id,
        fhirId: appointments.fhirId,
        patientName: appointments.patientName,
        patientId: appointments.patientId,
        nurseName: appointments.nurseName,
        nurseId: appointments.nurseId,
        startDate: appointments.startDate,
        locationName: appointments.locationName,
        locationAddress: appointments.locationAddress,
        latitude: appointments.locationLatitude,
        longitude: appointments.locationLongitude,
        serviceType: appointments.serviceType,
        status: appointments.status,
      })
      .from(appointments)
      .where(and(...conditions))
      .orderBy(appointments.startDate);

    // Group by nurse for route optimization
    const appointmentsByNurse = results.reduce((acc, appointment) => {
      const nurseId = appointment.nurseId || "unassigned";
      if (!acc[nurseId]) {
        acc[nurseId] = {
          nurseName: appointment.nurseName || "Unassigned",
          appointments: [],
        };
      }
      acc[nurseId].appointments.push(appointment);
      return acc;
    }, {});

    console.log(
      `✅ Found ${results.length} mappable appointments for ${
        Object.keys(appointmentsByNurse).length
      } nurses`
    );

    res.json({
      totalAppointments: results.length,
      appointmentsByNurse,
      allAppointments: results,
    });
  } catch (error) {
    console.error("❌ Error fetching mappable appointments:", error);
    res.status(500).json({ error: "Failed to fetch mappable appointments" });
  }
});

// ===================
// CALENDAR VIEW
// ===================

// GET /api/appointments/calendar
router.get("/calendar", async (req, res) => {
  try {
    const {
      dateFrom = new Date().toISOString().split("T")[0], // Default to today
      dateTo,
      nurses,
      statuses,
    } = req.query;

    console.log(
      `📅 Fetching calendar data from ${dateFrom} ${
        dateTo ? `to ${dateTo}` : ""
      }`
    );

    const conditions = [];

    // Date range
    if (dateTo) {
      conditions.push(
        between(appointments.startDate, dateFrom, dateTo + " 23:59:59")
      );
    } else {
      conditions.push(gte(appointments.startDate, dateFrom));
    }

    // Optional filters
    if (nurses) {
      const nurseIds = nurses.split(",").filter(Boolean);
      if (nurseIds.length > 0) {
        conditions.push(inArray(appointments.nurseId, nurseIds));
      }
    }

    if (statuses) {
      const statusList = statuses.split(",").filter(Boolean);
      if (statusList.length > 0) {
        conditions.push(inArray(appointments.status, statusList));
      }
    }

    const results = await db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(appointments.startDate);

    // Group by date
    const groupedByDate = results.reduce((acc, appointment) => {
      const date =
        appointment.startDate?.split(" ")[0] ||
        appointment.startDate?.split("T")[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(appointment);
      return acc;
    }, {});

    console.log(
      `✅ Found ${results.length} appointments across ${
        Object.keys(groupedByDate).length
      } dates`
    );

    res.json({
      dates: Object.keys(groupedByDate).sort(),
      appointmentsByDate: groupedByDate,
      totalAppointments: results.length,
    });
  } catch (error) {
    console.error("❌ Error fetching calendar data:", error);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
});

// ===================
// STATISTICS
// ===================

// GET /api/appointments/stats
router.get("/stats", async (req, res) => {
  try {
    console.log("📊 Fetching appointment statistics...");

    // Total appointments
    const totalCount = await db
      .select({ count: sql`count(*)` })
      .from(appointments);

    // By status
    const statusCounts = await db
      .select({
        status: appointments.status,
        count: sql`count(*)`,
      })
      .from(appointments)
      .groupBy(appointments.status)
      .orderBy(appointments.status);

    // By service type
    const serviceTypeCounts = await db
      .select({
        serviceType: appointments.serviceType,
        serviceCode: appointments.serviceCode,
        count: sql`count(*)`,
      })
      .from(appointments)
      .where(isNotNull(appointments.serviceType))
      .groupBy(appointments.serviceType, appointments.serviceCode)
      .orderBy(sql`count(*) desc`);

    // By nurse
    const nurseCounts = await db
      .select({
        nurseName: appointments.nurseName,
        nurseId: appointments.nurseId,
        count: sql`count(*)`,
      })
      .from(appointments)
      .where(isNotNull(appointments.nurseName))
      .groupBy(appointments.nurseName, appointments.nurseId)
      .orderBy(sql`count(*) desc`);

    const stats = {
      total: totalCount[0]?.count || 0,
      byStatus: statusCounts,
      byServiceType: serviceTypeCounts,
      byNurse: nurseCounts,
    };

    console.log(
      `✅ Statistics: ${stats.total} total appointments, ${stats.byNurse.length} nurses`
    );

    res.json(stats);
  } catch (error) {
    console.error("❌ Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// ===================
// SYNC ENDPOINTS
// ===================

// POST /api/appointments/sync
router.post("/sync", async (req, res) => {
  try {
    console.log("🔄 Starting HCHB sync via API request...");

    // Import the sync function
    const { fullSync } = require("../sync/hchb-sync");

    // Set a timeout to prevent hanging requests
    const timeoutMs = 10 * 60 * 1000; // 10 minutes
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Sync timeout after 10 minutes")),
        timeoutMs
      );
    });

    // Run sync with timeout
    const result = await Promise.race([fullSync(), timeoutPromise]);

    if (result.success) {
      console.log(
        `✅ Sync completed successfully: ${result.count} appointments`
      );
      res.json({
        success: true,
        message: "Sync completed successfully",
        appointmentCount: result.count,
        timeMs: result.timeMs,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error(`❌ Sync failed: ${result.error}`);
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("❌ Sync API error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/appointments/sync/status
router.get("/sync/status", async (req, res) => {
  try {
    // Get basic database stats to show sync status
    const totalCount = await db
      .select({ count: sql`count(*)` })
      .from(appointments);

    // Get date range of current data
    const dateRange = await db
      .select({
        oldest: sql`MIN(${appointments.startDate})`,
        newest: sql`MAX(${appointments.startDate})`,
      })
      .from(appointments);

    // Get last sync info (you could add a sync_log table later)
    const lastUpdated = await db
      .select({
        lastUpdate: sql`MAX(${appointments.id})`, // Approximate last update
      })
      .from(appointments);

    res.json({
      totalAppointments: totalCount[0]?.count || 0,
      dateRange: {
        oldest: dateRange[0]?.oldest,
        newest: dateRange[0]?.newest,
      },
      lastSyncApproximate: lastUpdated[0]?.lastUpdate
        ? "Recently synced"
        : "No data",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error fetching sync status:", error);
    res.status(500).json({ error: "Failed to fetch sync status" });
  }
});

module.exports = router;
