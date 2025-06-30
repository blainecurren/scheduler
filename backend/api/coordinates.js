// backend/api/coordinates.js
// API endpoints for nurse coordinate geocoding

const express = require('express');
const { geocodeAllNurseAddresses } = require('../services/azure-maps-service');
const { db, appointments } = require('../db/config');
const { isNotNull, isNull, and } = require('drizzle-orm');

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
    
    // Quick check of database state
    const needsGeocodingCount = await db
      .select({ count: db.$count() })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationAddress),
          appointments.nurseLocationAddress.ne(''),
          isNull(appointments.nurseLocationLatitude)
        )
      );
    
    const totalAppointments = await db
      .select({ count: db.$count() })
      .from(appointments);
      
    const geocodedCount = await db
      .select({ count: db.$count() })
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
          appointments.nurseLocationAddress.ne('')
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
    console.error('❌ Status check error:', error);
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
    
    // Total appointments
    const totalCount = await db
      .select({ count: db.$count() })
      .from(appointments);
    
    // Appointments with nurse coordinates
    const nursesWithCoords = await db
      .select({ count: db.$count() })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude)
        )
      );
    
    // Appointments with patient coordinates
    const patientsWithCoords = await db
      .select({ count: db.$count() })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.locationLatitude),
          isNotNull(appointments.locationLongitude)
        )
      );
    
    // Appointments with both coordinates
    const bothCoords = await db
      .select({ count: db.$count() })
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
      .selectDistinct({ nurseName: appointments.nurseName })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationAddress),
          appointments.nurseLocationAddress.ne('')
        )
      );
    
    // Unique nurses with coordinates
    const uniqueNursesWithCoords = await db
      .selectDistinct({ nurseName: appointments.nurseName })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude)
        )
      );
    
    const stats = {
      totalAppointments: totalCount[0]?.count || 0,
      appointmentsWithNurseCoords: nursesWithCoords[0]?.count || 0,
      appointmentsWithPatientCoords: patientsWithCoords[0]?.count || 0,
      appointmentsWithBothCoords: bothCoords[0]?.count || 0,
      uniqueNursesWithAddresses: uniqueNursesWithAddresses.length,
      uniqueNursesWithCoords: uniqueNursesWithCoords.length,
      geocodingProgress: uniqueNursesWithAddresses.length > 0 
        ? Math.round((uniqueNursesWithCoords.length / uniqueNursesWithAddresses.length) * 100)
        : 0,
      mappableAppointments: bothCoords[0]?.count || 0
    };
    
    console.log(`✅ Generated coordinate statistics: ${stats.mappableAppointments} mappable appointments`);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Statistics API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coordinate statistics'
    });
  }
});

// GET /api/coordinates/preview
// Preview addresses that will be geocoded (useful for debugging)
router.get('/preview', async (req, res) => {
  try {
    console.log('🔍 Fetching addresses that need geocoding...');
    
    const limit = parseInt(req.query.limit) || 10;
    
    const addressesNeedingGeocode = await db
      .selectDistinct({
        nurseName: appointments.nurseName,
        nurseLocationAddress: appointments.nurseLocationAddress
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationAddress),
          appointments.nurseLocationAddress.ne(''),
          isNull(appointments.nurseLocationLatitude)
        )
      )
      .groupBy(appointments.nurseName, appointments.nurseLocationAddress)
      .limit(limit);
    
    res.json({
      success: true,
      data: {
        count: addressesNeedingGeocode.length,
        addresses: addressesNeedingGeocode,
        note: `Showing first ${limit} addresses. Use ?limit=N to see more.`
      }
    });
    
  } catch (error) {
    console.error('❌ Preview API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch address preview'
    });
  }
});

module.exports = router;