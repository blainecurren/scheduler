// backend/services/azure-maps-service.js
// FIXED: Azure Maps geocoding service with correct Drizzle ORM count queries

const axios = require('axios');
const { db, appointments } = require('../db/config');
const { eq, isNotNull, isNull, and, ne, sql } = require('drizzle-orm');
require('dotenv').config();

// ===================
// CONFIGURATION
// ===================

const CONFIG = {
  azureMapsKey: process.env.AZURE_MAPS_KEY,
  azureMapsBaseUrl: 'https://atlas.microsoft.com/search/address/json',
  timeout: 15000,      // Increased timeout for concurrent requests
  batchSize: 10,       // Process 10 addresses per batch
  maxConcurrency: 5,   // 5 concurrent workers (like HCHB sync)
  requestDelay: 100,   // 100ms between individual requests
  batchDelay: 500,     // 500ms between batch groups
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
// FIXED DATABASE OPERATIONS
// ===================

async function getNursesWithoutCoordinates() {
  console.log('🔍 Finding nurses with addresses but no coordinates...');
  
  try {
    // FIXED: Use sql template literal for count instead of db.$count()
    const nursesNeedingGeocode = await db
      .selectDistinct({
        nurseName: appointments.nurseName,
        nurseLocationAddress: appointments.nurseLocationAddress,
        count: sql`count(*)`
      })
      .from(appointments)
      .where(
        and(
          isNotNull(appointments.nurseLocationAddress),    // Has address
          ne(appointments.nurseLocationAddress, ''),       // Address not empty
          isNull(appointments.nurseLocationLatitude)       // No coordinates yet
        )
      )
      .groupBy(appointments.nurseName, appointments.nurseLocationAddress);
    
    console.log(`📊 Found ${nursesNeedingGeocode.length} unique nurse addresses to geocode`);
    
    // Show sample of what we found
    if (nursesNeedingGeocode.length > 0) {
      console.log('\n📝 Sample addresses to geocode:');
      nursesNeedingGeocode.slice(0, 5).forEach((nurse, i) => {
        console.log(`   ${i + 1}. ${nurse.nurseName}: ${nurse.nurseLocationAddress} (${nurse.count} appointments)`);
      });
      
      if (nursesNeedingGeocode.length > 5) {
        console.log(`   ... and ${nursesNeedingGeocode.length - 5} more`);
      }
    }
    
    return nursesNeedingGeocode;
    
  } catch (error) {
    console.error('❌ Error querying nurses without coordinates:', error);
    throw error;
  }
}

async function updateNurseCoordinates(nurseName, address, latitude, longitude) {
  try {
    const result = await db
      .update(appointments)
      .set({
        nurseLocationLatitude: latitude,
        nurseLocationLongitude: longitude
      })
      .where(
        and(
          eq(appointments.nurseName, nurseName),
          eq(appointments.nurseLocationAddress, address)
        )
      );
    
    return { success: true };
  } catch (error) {
    console.error(`❌ Error updating coordinates for ${nurseName}:`, error);
    return { success: false, error: error.message };
  }
}

// ===================
// CONCURRENT BATCH PROCESSING (5 WORKERS)
// ===================

async function processNurseCoordinatesInBatches(nursesToGeocode) {
  const results = { success: 0, failed: 0 };
  const maxConcurrency = 5;  // 5 concurrent workers like HCHB sync
  const batchSize = 10;      // Process 10 addresses per batch
  
  console.log(`🔄 Processing ${nursesToGeocode.length} nurses with ${maxConcurrency} CONCURRENT WORKERS...`);
  
  // Create batches
  const batches = [];
  for (let i = 0; i < nursesToGeocode.length; i += batchSize) {
    batches.push({
      nurses: nursesToGeocode.slice(i, i + batchSize),
      batchNumber: Math.floor(i / batchSize) + 1
    });
  }
  
  console.log(`📦 Created ${batches.length} batches of up to ${batchSize} nurses each`);
  
  // Process batches with controlled concurrency
  const batchResults = await processBatchesConcurrently(batches, maxConcurrency);
  
  // Aggregate results
  batchResults.forEach(batchResult => {
    if (batchResult.status === 'fulfilled') {
      results.success += batchResult.value.success;
      results.failed += batchResult.value.failed;
    } else {
      results.failed += batchResult.reason.count || 1;
    }
  });
  
  const successCount = batchResults.filter(r => r.status === 'fulfilled').length;
  const errorCount = batchResults.filter(r => r.status === 'rejected').length;
  
  console.log(`\n📊 Concurrent Processing Summary:`);
  console.log(`   Successful batches: ${successCount}/${batches.length}`);
  console.log(`   Failed batches: ${errorCount}/${batches.length}`);
  console.log(`   Total successful geocodes: ${results.success}`);
  console.log(`   Total failed geocodes: ${results.failed}`);
  
  return results;
}

async function processBatchesConcurrently(batches, maxConcurrency) {
  const results = [];
  
  // Process batches in chunks to limit concurrency
  for (let i = 0; i < batches.length; i += maxConcurrency) {
    const concurrentBatches = batches.slice(i, i + maxConcurrency);
    
    console.log(`\n🚀 Processing batch group ${Math.floor(i/maxConcurrency) + 1}/${Math.ceil(batches.length/maxConcurrency)} (${concurrentBatches.length} concurrent workers)`);
    
    // Execute concurrent geocoding
    const batchPromises = concurrentBatches.map(batch => 
      processGeocodingBatch(batch.nurses, batch.batchNumber)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
    
    // Show batch group results
    const groupSuccess = batchResults.filter(r => r.status === 'fulfilled').length;
    const groupFailed = batchResults.filter(r => r.status === 'rejected').length;
    console.log(`   📊 Batch group complete: ${groupSuccess} successful, ${groupFailed} failed`);
    
    // Adaptive delay based on failure rate
    const failureRate = groupFailed / batchResults.length;
    const delay = failureRate > 0.3 ? 2000 : failureRate > 0.1 ? 1000 : 500;
    
    if (i + maxConcurrency < batches.length) {
      console.log(`   ⏱️  Waiting ${delay}ms before next batch group (failure rate: ${Math.round(failureRate * 100)}%)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
}

async function processGeocodingBatch(nurses, batchNumber) {
  const batchResults = { success: 0, failed: 0 };
  
  console.log(`   📍 Batch ${batchNumber}: Starting geocoding for ${nurses.length} nurses...`);
  
  for (const nurse of nurses) {
    try {
      console.log(`     🗺️  Geocoding: ${nurse.nurseName} at "${nurse.nurseLocationAddress}"`);
      
      const geoResult = await geocodeAddress(nurse.nurseLocationAddress);
      
      if (geoResult.latitude && geoResult.longitude) {
        const updateResult = await updateNurseCoordinates(
          nurse.nurseName,
          nurse.nurseLocationAddress,
          geoResult.latitude,
          geoResult.longitude
        );
        
        if (updateResult.success) {
          console.log(`     ✅ Success: ${nurse.nurseName} -> (${geoResult.latitude}, ${geoResult.longitude})`);
          batchResults.success++;
        } else {
          console.log(`     ❌ Database update failed: ${nurse.nurseName}`);
          batchResults.failed++;
        }
      } else {
        console.log(`     ⚠️  No coordinates found: ${nurse.nurseName} - ${geoResult.error || 'Unknown error'}`);
        batchResults.failed++;
      }
      
      // Small delay between individual requests within batch
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`     ❌ Error processing ${nurse.nurseName}:`, error.message);
      batchResults.failed++;
    }
  }
  
  console.log(`   ✅ Batch ${batchNumber} complete: ${batchResults.success} successful, ${batchResults.failed} failed`);
  return batchResults;
}

// ===================
// FIXED STATISTICS
// ===================

async function getCoordinateStatistics() {
  console.log('📊 Generating coordinate statistics...');
  
  try {
    // FIXED: Use sql template literals for all count operations
    
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
    
    const stats = {
      totalAppointments: totalAppointments[0]?.count || 0,
      appointmentsWithNurseCoords: appointmentsWithNurseCoords[0]?.count || 0,
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

async function geocodeAllNurseAddresses() {
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
      return { success: true, message: 'No geocoding needed', processed: 0, successful: 0, failed: 0 };
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
// EXPORTS & CLI
// ===================

module.exports = { 
  geocodeAllNurseAddresses, 
  getCoordinateStatistics,
  geocodeAddress,
  getNursesWithoutCoordinates
};

if (require.main === module) {
  const { initializeDatabase } = require('../db/config');
  
  initializeDatabase();
  geocodeAllNurseAddresses().then(result => {
    console.log('\n🏁 Geocoding process finished:', result.success ? 'SUCCESS' : 'FAILED');
    process.exit(result.success ? 0 : 1);
  });
}