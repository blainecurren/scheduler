// backend/services/nurse-coordinates.js
// Separate service to geocode nurse addresses using Azure Maps

const axios = require('axios');
const { db, appointments } = require('../db/config');
const { eq, isNotNull, isNull, and } = require('drizzle-orm');
require('dotenv').config();

// ===================
// CONFIGURATION
// ===================

const CONFIG = {
  azureMapsKey: process.env.AZURE_MAPS_KEY,
  azureMapsBaseUrl: 'https://atlas.microsoft.com/search/address/json',
  timeout: 10000,
  batchSize: 10,        // Process 10 addresses at a time
  requestDelay: 100,    // 100ms between requests to avoid rate limiting
};

// ===================
// AZURE MAPS INTEGRATION
// ===================

async function geocodeAddress(address) {
  if (!address || address.trim() === '') {
    return { latitude: null, longitude: null, error: 'Empty address' };
  }
  
  try {
    const params = new URLSearchParams({
      'api-version': '1.0',
      'subscription-key': CONFIG.azureMapsKey,
      'query': address.trim(),
      'limit': 1,
      'countrySet': 'US'  // Assuming US addresses
    });
    
    const url = `${CONFIG.azureMapsBaseUrl}?${params}`;
    
    const response = await axios.get(url, {
      timeout: CONFIG.timeout,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.data?.results?.[0]?.position) {
      const position = response.data.results[0].position;
      return {
        latitude: position.lat,
        longitude: position.lon,
        confidence: response.data.results[0].score || 1.0,
        error: null
      };
    } else {
      return {
        latitude: null,
        longitude: null,
        error: 'No results found'
      };
    }
    
  } catch (error) {
    console.error(`❌ Geocoding failed for "${address}":`, error.response?.data || error.message);
    return {
      latitude: null,
      longitude: null,
      error: error.message
    };
  }
}

// ===================
// DATABASE OPERATIONS
// ===================

async function getNursesWithoutCoordinates() {
  console.log('🔍 Finding nurses with addresses but no coordinates...');
  
  try {
    // Get unique nurse addresses that need geocoding
    const nursesNeedingGeocode = await db
      .selectDistinct({
        nurseName: appointments.nurseName,
        nurseLocationAddress: appointments.nurseLocationAddress,
        count: db.$count()
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationAddress),    // Has address
          appointments.nurseLocationAddress.ne(''),        // Address not empty
          isNull(appointments.nurseLocationLatitude)       // No coordinates yet
        )
      )
      .groupBy(appointments.nurseName, appointments.nurseLocationAddress);
    
    console.log(`📊 Found ${nursesNeedingGeocode.length} unique nurse addresses to geocode`);
    
    // Show sample of what we found
    if (nursesNeedingGeocode.length > 0) {
      console.log('\n📝 Sample addresses to geocode:');
      nursesNeedingGeocode.slice(0, 5).forEach((nurse, i) => {
        console.log(`   ${i + 1}. ${nurse.nurseName}: "${nurse.nurseLocationAddress}"`);
      });
      
      if (nursesNeedingGeocode.length > 5) {
        console.log(`   ... and ${nursesNeedingGeocode.length - 5} more`);
      }
    }
    
    return nursesNeedingGeocode;
    
  } catch (error) {
    console.error('❌ Error querying nurses without coordinates:', error);
    return [];
  }
}

async function updateNurseCoordinates(nurseName, address, latitude, longitude) {
  try {
    // Update all appointments for this nurse with the coordinates
    const result = await db
      .update(appointments)
      .set({
        nurseLocationLatitude: latitude,
        nurseLocationLongitude: longitude,
        nurseLocationName: nurseName  // Also set the name for consistency
      })
      .where(
        and(
          eq(appointments.nurseName, nurseName),
          eq(appointments.nurseLocationAddress, address)
        )
      );
    
    return result;
    
  } catch (error) {
    console.error(`❌ Error updating coordinates for ${nurseName}:`, error);
    throw error;
  }
}

// ===================
// BATCH PROCESSING
// ===================

async function processNurseCoordinatesInBatches(nursesToGeocode) {
  if (nursesToGeocode.length === 0) {
    console.log('✅ No nurses need geocoding');
    return { success: 0, failed: 0, skipped: 0 };
  }
  
  console.log(`🚀 Starting geocoding of ${nursesToGeocode.length} nurse addresses...`);
  
  const results = {
    success: 0,
    failed: 0,
    skipped: 0
  };
  
  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < nursesToGeocode.length; i += CONFIG.batchSize) {
    const batch = nursesToGeocode.slice(i, i + CONFIG.batchSize);
    const batchNumber = Math.floor(i / CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(nursesToGeocode.length / CONFIG.batchSize);
    
    console.log(`\n📦 Batch ${batchNumber}/${totalBatches}: Processing ${batch.length} addresses...`);
    
    for (const nurse of batch) {
      console.log(`   🔄 Geocoding: ${nurse.nurseName} - "${nurse.nurseLocationAddress}"`);
      
      try {
        const result = await geocodeAddress(nurse.nurseLocationAddress);
        
        if (result.latitude && result.longitude) {
          // Update database with coordinates
          await updateNurseCoordinates(
            nurse.nurseName,
            nurse.nurseLocationAddress,
            result.latitude,
            result.longitude
          );
          
          results.success++;
          console.log(`     ✅ Success: ${result.latitude}, ${result.longitude} (confidence: ${result.confidence})`);
          
        } else {
          results.failed++;
          console.log(`     ❌ Failed: ${result.error || 'No coordinates returned'}`);
        }
        
      } catch (error) {
        results.failed++;
        console.error(`     ❌ Error: ${error.message}`);
      }
      
      // Delay between requests to avoid rate limiting
      if (CONFIG.requestDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.requestDelay));
      }
    }
    
    console.log(`   📊 Batch ${batchNumber} complete: ${results.success} success, ${results.failed} failed so far`);
    
    // Longer delay between batches
    if (i + CONFIG.batchSize < nursesToGeocode.length) {
      console.log(`   ⏱️  Waiting before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// ===================
// STATISTICS AND REPORTING
// ===================

async function getCoordinateStatistics() {
  console.log('📊 Generating coordinate statistics...');
  
  try {
    // Total appointments
    const totalCount = await db
      .select({ count: db.$count() })
      .from(appointments);
    
    // Nurses with coordinates
    const nursesWithCoords = await db
      .select({ count: db.$count() })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationLatitude),
          isNotNull(appointments.nurseLocationLongitude)
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
      uniqueNursesWithAddresses: uniqueNursesWithAddresses.length,
      uniqueNursesWithCoords: uniqueNursesWithCoords.length
    };
    
    console.log(`\n📈 Coordinate Statistics:`);
    console.log(`   Total appointments: ${stats.totalAppointments}`);
    console.log(`   Appointments with nurse coordinates: ${stats.appointmentsWithNurseCoords}/${stats.totalAppointments} (${Math.round((stats.appointmentsWithNurseCoords / stats.totalAppointments) * 100)}%)`);
    console.log(`   Unique nurses with addresses: ${stats.uniqueNursesWithAddresses}`);
    console.log(`   Unique nurses with coordinates: ${stats.uniqueNursesWithCoords}/${stats.uniqueNursesWithAddresses} (${Math.round((stats.uniqueNursesWithCoords / stats.uniqueNursesWithAddresses) * 100)}%)`);
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error generating statistics:', error);
    return null;
  }
}

// ===================
// MAIN FUNCTION
// ===================

async function geocodeNurseAddresses() {
  console.log('🗺️  Starting nurse address geocoding service...');
  
  // Validate Azure Maps configuration
  if (!CONFIG.azureMapsKey) {
    console.error('❌ AZURE_MAPS_KEY environment variable is required');
    return { success: false, error: 'Missing Azure Maps API key' };
  }
  
  try {
    const startTime = Date.now();
    
    // Get nurses that need geocoding
    const nursesToGeocode = await getNursesWithoutCoordinates();
    
    if (nursesToGeocode.length === 0) {
      console.log('✅ All nurse addresses already have coordinates!');
      await getCoordinateStatistics();
      return { success: true, message: 'No geocoding needed' };
    }
    
    // Process geocoding in batches
    const results = await processNurseCoordinatesInBatches(nursesToGeocode);
    
    const totalTime = Date.now() - startTime;
    
    console.log(`\n📊 Geocoding Summary:`);
    console.log(`   Addresses processed: ${nursesToGeocode.length}`);
    console.log(`   Successful geocodes: ${results.success}`);
    console.log(`   Failed geocodes: ${results.failed}`);
    console.log(`   Success rate: ${Math.round((results.success / nursesToGeocode.length) * 100)}%`);
    console.log(`   Total time: ${Math.round(totalTime / 1000)}s`);
    
    // Show updated statistics
    await getCoordinateStatistics();
    
    console.log('\n✅ Nurse coordinate geocoding completed!');
    
    return {
      success: true,
      processed: nursesToGeocode.length,
      successful: results.success,
      failed: results.failed,
      timeMs: totalTime
    };
    
  } catch (error) {
    console.error('❌ Geocoding service failed:', error);
    return { success: false, error: error.message };
  }
}

// ===================
// API ENDPOINT FOR TRIGGERING GEOCODING
// ===================

async function geocodeEndpoint(req, res) {
  try {
    console.log('🔄 Geocoding triggered via API...');
    const result = await geocodeNurseAddresses();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Geocoding completed successfully',
        data: result
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
      error: 'Internal server error'
    });
  }
}

// ===================
// EXPORTS & CLI
// ===================

module.exports = { 
  geocodeNurseAddresses, 
  geocodeEndpoint,
  getCoordinateStatistics 
};

if (require.main === module) {
  const { initializeDatabase } = require('../db/config');
  
  initializeDatabase();
  geocodeNurseAddresses().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}