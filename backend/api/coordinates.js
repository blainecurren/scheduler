// backend/api/coordinates.js
// FIXED: API endpoints for nurse coordinate geocoding with correct Drizzle count syntax

const express = require('express');
const { geocodeAllNurseAddresses } = require('../services/azure-maps-service');
const { db, appointments } = require('../db/config');
const { isNotNull, isNull, and, ne, sql } = require('drizzle-orm');

const router = express.Router();

// ===================
// GEOCODING ENDPOINTS
// ===================

// POST /api/coordinates/geocode
// Trigger geocoding of nurse addresses
router.post('/geocode', async (req, res) => {
  try {
    console.log('🔄 Starting nurse address geocoding via API...');
    
    // Check if Azure Maps is configured
    if (!process.env.AZURE_MAPS_KEY) {
      return res.status(400).json({
        success: false,
        error: 'Azure Maps API key not configured. Please set AZURE_MAPS_KEY environment variable.'
      });
    }
    
    const result = await geocodeAllNurseAddresses();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Geocoding completed successfully',
        data: {
          processed: result.processed || 0,
          successful: result.successful || 0,
          failed: result.failed || 0
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Geocoding failed'
      });
    }
    
  } catch (error) {
    console.error('❌ Geocoding API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during geocoding'
    });
  }
});

// GET /api/coordinates/status
// Check geocoding service status and requirements
router.get('/status', async (req, res) => {
  try {
    console.log('📊 Checking geocoding status...');
    
    const azureMapsConfigured = !!process.env.AZURE_MAPS_KEY;
    
    // FIXED: Use sql template literals instead of db.$count()
    
    // Quick check of database state
    const needsGeocodingCount = await db
      .select({ count: sql`count(*)` })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationAddress),
          ne(appointments.nurseLocationAddress, ''),
          isNull(appointments.nurseLocationLatitude)
        )
      );
    
    const totalAppointments = await db
      .select({ count: sql`count(*)` })
      .from(appointments);
      
    const geocodedCount = await db
      .select({ count: sql`count(*)` })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude)
        )
      );
    
    // Get unique nurses with addresses
    const uniqueNursesWithAddresses = await db
      .selectDistinct({ nurseName: appointments.nurseName })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationAddress),
          ne(appointments.nurseLocationAddress, '')
        )
      );
      
    // Get unique nurses with coordinates
    const uniqueNursesWithCoords = await db
      .selectDistinct({ nurseName: appointments.nurseName })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude)
        )
      );
    
    res.json({
      success: true,
      data: {
        azureMapsConfigured,
        totalAppointments: totalAppointments[0]?.count || 0,
        appointmentsWithCoordinates: geocodedCount[0]?.count || 0,
        addressesNeedingGeocode: needsGeocodingCount[0]?.count || 0,
        uniqueNursesWithAddresses: uniqueNursesWithAddresses.length,
        uniqueNursesWithCoordinates: uniqueNursesWithCoords.length,
        readyForGeocode: azureMapsConfigured && (needsGeocodingCount[0]?.count || 0) > 0,
        geocodingProgress: uniqueNursesWithAddresses.length > 0 
          ? Math.round((uniqueNursesWithCoords.length / uniqueNursesWithAddresses.length) * 100)
          : 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking geocoding status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check geocoding status'
    });
  }
});

// GET /api/coordinates/stats
// Get detailed coordinate statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching coordinate statistics...');
    
    // FIXED: Use sql template literals for count operations
    
    // Total appointments
    const totalAppointments = await db.select({ 
      count: sql`count(*)` 
    }).from(appointments);
    
    // Appointments with nurse coordinates
    const appointmentsWithNurseCoords = await db.select({ 
      count: sql`count(*)` 
    })
    .from(appointments)
    .where(
      and(
        isNotNull(appointments.nurseLocationLatitude),
        isNotNull(appointments.nurseLocationLongitude)
      )
    );
    
    // Appointments with patient coordinates
    const appointmentsWithPatientCoords = await db.select({ 
      count: sql`count(*)` 
    })
    .from(appointments)
    .where(
      and(
        isNotNull(appointments.locationLatitude),
        isNotNull(appointments.locationLongitude)
      )
    );
    
    // Appointments with both nurse and patient coordinates
    const appointmentsWithBothCoords = await db.select({ 
      count: sql`count(*)` 
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
    
    // Unique nurses with addresses
    const uniqueNursesWithAddresses = await db
      .selectDistinct({ 
        nurseName: appointments.nurseName,
        address: appointments.nurseLocationAddress 
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationAddress),
          ne(appointments.nurseLocationAddress, '')
        )
      );
      
    // Unique nurses with coordinates
    const uniqueNursesWithCoords = await db
      .selectDistinct({ 
        nurseName: appointments.nurseName 
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude)
        )
      );
    
    // Nurse breakdown with coordinate counts
    const nurseBreakdown = await db
      .select({
        nurseName: appointments.nurseName,
        totalAppointments: sql`count(*)`,
        withCoordinates: sql`sum(case when ${appointments.nurseLocationLatitude} is not null and ${appointments.nurseLocationLongitude} is not null then 1 else 0 end)`,
        address: appointments.nurseLocationAddress
      })
      .from(appointments)
      .where(isNotNull(appointments.nurseName))
      .groupBy(appointments.nurseName, appointments.nurseLocationAddress)
      .orderBy(sql`count(*) desc`);
    
    const stats = {
      overview: {
        totalAppointments: totalAppointments[0]?.count || 0,
        appointmentsWithNurseCoords: appointmentsWithNurseCoords[0]?.count || 0,
        appointmentsWithPatientCoords: appointmentsWithPatientCoords[0]?.count || 0,
        appointmentsWithBothCoords: appointmentsWithBothCoords[0]?.count || 0,
        uniqueNursesWithAddresses: uniqueNursesWithAddresses.length,
        uniqueNursesWithCoords: uniqueNursesWithCoords.length
      },
      nurseBreakdown: nurseBreakdown
    };
    
    console.log(`✅ Statistics: ${stats.overview.totalAppointments} total appointments, ${stats.overview.uniqueNursesWithCoords}/${stats.overview.uniqueNursesWithAddresses} nurses geocoded`);

    res.json(stats);

  } catch (error) {
    console.error('❌ Error fetching coordinate statistics:', error);
    res.status(500).json({ error: 'Failed to fetch coordinate statistics' });
  }
});

module.exports = router;