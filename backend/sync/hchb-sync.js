// backend/sync/hchb-sync.js
// FIXED: Properly extracts nurse addresses AND patient coordinates

const axios = require('axios');
const { db, appointments, clearDatabase } = require('../db/config');
require('dotenv').config();

// ===================
// DATABASE UTILITIES (unchanged)
// ===================

async function insertAppointmentsInBatches(appointmentData) {
  const batchSize = 500;
  const totalBatches = Math.ceil(appointmentData.length / batchSize);
  
  console.log(`💾 Inserting ${appointmentData.length} appointments in ${totalBatches} batches of ${batchSize}...`);
  
  for (let i = 0; i < appointmentData.length; i += batchSize) {
    const batch = appointmentData.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    try {
      console.log(`   📦 Batch ${batchNumber}/${totalBatches}: Inserting ${batch.length} appointments...`);
      await db.insert(appointments).values(batch);
      console.log(`   ✅ Batch ${batchNumber}/${totalBatches}: Successfully inserted ${batch.length} appointments`);
    } catch (error) {
      console.error(`   ❌ Batch ${batchNumber}/${totalBatches}: Failed to insert appointments:`, error.message);
      throw error;
    }
    
    if (i + batchSize < appointmentData.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`💾 Successfully inserted all ${appointmentData.length} appointments to database`);
}

// ===================
// CONFIGURATION & AUTH (unchanged)
// ===================

const CONFIG = {
  clientId: process.env.HCHB_CLIENT_ID,
  resourceSecurityId: process.env.HCHB_RESOURCE_SECURITY_ID,
  agencySecret: process.env.HCHB_AGENCY_SECRET,
  tokenUrl: process.env.HCHB_TOKEN_URL,
  apiBaseUrl: process.env.HCHB_API_BASE_URL,
  timeout: 600000,
};

let tokenCache = null;

async function getAuthToken() {
  if (tokenCache && tokenCache.expiresAt > new Date()) {
    return tokenCache.token;
  }

  const response = await axios.post(
    CONFIG.tokenUrl,
    new URLSearchParams({
      grant_type: 'agency_auth',
      client_id: CONFIG.clientId,
      scope: 'openid HCHB.api.scope agency.identity hchb.identity',
      resource_security_id: CONFIG.resourceSecurityId,
      agency_secret: CONFIG.agencySecret,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: CONFIG.timeout,
    }
  );

  const { access_token, expires_in } = response.data;
  tokenCache = {
    token: access_token,
    expiresAt: new Date(Date.now() + (expires_in * 1000) - 60000),
  };

  return access_token;
}

// ===================
// DATE UTILITIES (unchanged)
// ===================

function getCurrentWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() - daysSinceMonday);
  mondayDate.setHours(0, 0, 0, 0);
  
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(mondayDate);
    day.setDate(mondayDate.getDate() + i);
    weekDays.push({
      date: day.toISOString().split('T')[0],
      dayName: day.toLocaleDateString('en-US', { weekday: 'long' }),
      isToday: day.toISOString().split('T')[0] === now.toISOString().split('T')[0]
    });
  }
  
  return {
    startDate: weekDays[0].date,
    endDate: weekDays[6].date,
    weekDays: weekDays
  };
}

// ===================
// DATA FETCHING (unchanged)
// ===================

async function fetchAppointmentsForDay(date, token) {
  console.log(`📅 Fetching ALL SN11 appointments for ${date.dayName} (${date.date})${date.isToday ? ' - TODAY' : ''}...`);
  
  let allEntries = [];
  let url = `${CONFIG.apiBaseUrl}/Appointment?service-type=SN11&date=${date.date}&_count=100`;
  let pageCount = 0;
  
  try {
    while (url && pageCount < 50) {
      pageCount++;
      console.log(`     📄 Page ${pageCount}: Fetching up to 100 appointments...`);
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/fhir+json',
        },
        timeout: CONFIG.timeout,
      });

      const bundle = response.data;
      const pageEntries = bundle.entry || [];
      const pageAppointments = pageEntries.filter(entry => entry.resource.resourceType === 'Appointment');
      
      allEntries.push(...pageEntries);
      console.log(`     ✅ Page ${pageCount}: ${pageAppointments.length} appointments found`);
      
      url = null;
      if (bundle.link) {
        const nextLink = bundle.link.find(link => link.relation === 'next');
        if (nextLink && nextLink.url) {
          url = nextLink.url;
          console.log(`     🔗 Found next page link...`);
        }
      }
      
      if (url) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const totalAppointments = allEntries.filter(entry => entry.resource.resourceType === 'Appointment').length;
    console.log(`   ✅ ${date.dayName}: ${totalAppointments} SN11 appointments found across ${pageCount} pages`);
    
    if (pageCount >= 50) {
      console.log(`   ⚠️  Warning: Hit page limit (50) for ${date.dayName} - there may be more appointments`);
    }
    
    return allEntries;
    
  } catch (error) {
    console.error(`   ❌ Error fetching ${date.dayName}:`, error.response?.data || error.message);
    return [];
  }
}

async function fetchAllAppointments() {
  console.log('📅 Fetching ALL SN11 appointments for current week (Monday to Sunday) with FULL PAGINATION...');
  
  const token = await getAuthToken();
  const weekInfo = getCurrentWeekDates();
  
  console.log(`📊 Week Overview:`);
  console.log(`   Period: ${weekInfo.startDate} to ${weekInfo.endDate}`);
  console.log(`   Days: ${weekInfo.weekDays.map(d => d.dayName).join(', ')}`);
  console.log('');
  
  const allEntries = [];
  let totalAppointments = 0;
  
  for (const day of weekInfo.weekDays) {
    const dayEntries = await fetchAppointmentsForDay(day, token);
    allEntries.push(...dayEntries);
    
    const dayAppointments = dayEntries.filter(entry => entry.resource.resourceType === 'Appointment').length;
    totalAppointments += dayAppointments;
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('');
  console.log(`📊 Week Summary with FULL PAGINATION:`);
  console.log(`   Total SN11 appointments: ${totalAppointments}`);
  console.log(`   Total resources: ${allEntries.length}`);
  console.log(`   Average per day: ${Math.round(totalAppointments / 7)} appointments`);
  console.log('');
  
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: totalAppointments,
    entry: allEntries
  };
}

// ===================
// OPTIMIZED BATCH RESOURCE FETCHING (unchanged)
// ===================

async function fetchPatientAndPractitionerData(appointmentEntries) {
  console.log('👥 Fetching patient, practitioner, and location data with 5 CONCURRENT WORKERS...');
  
  const token = await getAuthToken();
  const resourceMap = new Map();
  
  const patientIds = new Set();
  const practitionerIds = new Set();
  const locationIds = new Set();
  
  appointmentEntries.forEach(entry => {
    const apt = entry.resource;
    
    const subjectExt = apt.extension?.find(ext => 
      ext.url?.includes('StructureDefinition/subject')
    );
    if (subjectExt?.valueReference?.reference) {
      const patientId = subjectExt.valueReference.reference.replace('Patient/', '');
      patientIds.add(patientId);
    }
    
    const nurseParticipant = apt.participant?.find(p => 
      p.actor?.reference?.startsWith('Practitioner/')
    );
    if (nurseParticipant?.actor?.reference) {
      const practitionerId = nurseParticipant.actor.reference.replace('Practitioner/', '');
      practitionerIds.add(practitionerId);
    }
    
    const locationExt = apt.extension?.find(ext => 
      ext.url?.includes('service-location')
    );
    if (locationExt?.valueReference?.reference) {
      const locationId = locationExt.valueReference.reference.replace('Location/', '');
      locationIds.add(locationId);
    }
  });
  
  console.log(`📊 Found ${patientIds.size} unique patients, ${practitionerIds.size} unique practitioners, ${locationIds.size} unique locations`);
  
  await batchFetchResourcesConcurrent('Practitioner', practitionerIds, token, resourceMap);
  await batchFetchResourcesConcurrent('Patient', patientIds, token, resourceMap);
  await batchFetchResourcesConcurrent('Location', locationIds, token, resourceMap);
  
  console.log(`✅ Successfully fetched ${resourceMap.size} additional resources`);
  return resourceMap;
}

async function batchFetchResourcesConcurrent(resourceType, ids, token, resourceMap) {
  if (ids.size === 0) return;
  
  const idsArray = Array.from(ids);
  const batchSize = 10;
  const maxConcurrency = 5;
  
  console.log(`🔄 Fetching ${idsArray.length} ${resourceType} resources with ${maxConcurrency} concurrent workers (batch size: ${batchSize})...`);
  
  const batches = [];
  for (let i = 0; i < idsArray.length; i += batchSize) {
    batches.push({
      ids: idsArray.slice(i, i + batchSize),
      batchNumber: Math.floor(i / batchSize) + 1
    });
  }
  
  console.log(`   📦 Created ${batches.length} batches of up to ${batchSize} resources each`);
  
  const results = await processBatchesConcurrently(
    batches, 
    resourceType, 
    token, 
    resourceMap, 
    maxConcurrency
  );
  
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const errorCount = results.filter(r => r.status === 'rejected').length;
  
  console.log(`   ✅ Completed: ${successCount} successful, ${errorCount} failed batches`);
  
  if (errorCount > 0) {
    console.log(`   ⚠️  Some batches failed - this is normal with concurrent processing`);
  }
}

async function processBatchesConcurrently(batches, resourceType, token, resourceMap, maxConcurrency) {
  const results = [];
  
  for (let i = 0; i < batches.length; i += maxConcurrency) {
    const concurrentBatches = batches.slice(i, i + maxConcurrency);
    
    console.log(`   🚀 Processing batch group ${Math.floor(i/maxConcurrency) + 1}/${Math.ceil(batches.length/maxConcurrency)} (${concurrentBatches.length} concurrent requests)`);
    
    const batchPromises = concurrentBatches.map(batch => 
      fetchResourceBatchWithRetry(resourceType, batch.ids, token, resourceMap, batch.batchNumber)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
    
    const failureRate = batchResults.filter(r => r.status === 'rejected').length / batchResults.length;
    const delay = failureRate > 0.3 ? 800 : failureRate > 0.1 ? 400 : 200;
    
    if (i + maxConcurrency < batches.length) {
      console.log(`   ⏱️  Waiting ${delay}ms before next batch group (failure rate: ${Math.round(failureRate * 100)}%)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
}

async function fetchResourceBatchWithRetry(resourceType, ids, token, resourceMap, batchNumber, retryCount = 0) {
  const maxRetries = 2;
  
  try {
    const idFilter = ids.join(',');
    const url = `${CONFIG.apiBaseUrl}/${resourceType}?_id=${idFilter}&_count=50`;
    
    console.log(`     📡 Batch ${batchNumber}: Requesting ${ids.length} ${resourceType} resources...`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/fhir+json',
      },
      timeout: CONFIG.timeout,
    });
    
    if (response.data.entry) {
      let addedCount = 0;
      response.data.entry.forEach(entry => {
        const resource = entry.resource;
        resourceMap.set(`${resourceType}/${resource.id}`, resource);
        addedCount++;
        
        if (resourceType === 'Practitioner') {
          const name = extractName(resource);
          console.log(`       👩‍⚕️ ${resource.id}: ${name}`);
        } else if (resourceType === 'Patient') {
          const name = extractName(resource);
          console.log(`       👤 ${resource.id}: ${name}`);
        } else if (resourceType === 'Location') {
          const locationInfo = extractLocationInfo(resource);
          console.log(`       📍 ${resource.id}: ${locationInfo.name} (${locationInfo.address})`);
        }
      });
      console.log(`     ✅ Batch ${batchNumber}: Added ${addedCount} ${resourceType} resources`);
    } else {
      console.log(`     ⚠️  Batch ${batchNumber}: No entries returned`);
    }
    
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.issue?.[0]?.diagnostics || error.message;
    
    if ((status === 429 || status >= 500) && retryCount < maxRetries) {
      const retryDelay = Math.pow(2, retryCount) * 1000;
      console.log(`     🔄 Batch ${batchNumber}: Retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return fetchResourceBatchWithRetry(resourceType, ids, token, resourceMap, batchNumber, retryCount + 1);
    }
    
    console.log(`     ❌ Batch ${batchNumber}: Failed after ${retryCount + 1} attempts - ${status} ${message}`);
    throw error;
  }
}

// ===================
// FIXED DATA PROCESSING
// ===================

function extractName(resource) {
  if (!resource?.name?.[0]) return 'Unknown';
  const name = resource.name[0];
  return `${name.given?.[0] || ''} ${name.family || ''}`.trim();
}

function extractLocationInfo(resource) {
  if (!resource) return { name: 'Unknown Location', address: '', latitude: null, longitude: null };
  
  const name = resource.name || 'Unknown Location';
  
  let address = '';
  if (resource.address) {
    const addr = resource.address;
    const parts = [];
    if (addr.line && addr.line[0]) parts.push(addr.line[0]);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.postalCode) parts.push(addr.postalCode);
    address = parts.join(', ');
  }
  
  let latitude = null;
  let longitude = null;
  if (resource.position) {
    latitude = resource.position.latitude || null;
    longitude = resource.position.longitude || null;
  }
  
  return {
    name,
    address,
    latitude,
    longitude
  };
}

// FIXED: Extract nurse address from Practitioner resource
function extractNurseAddressInfo(resource) {
  if (!resource) return { name: 'Unknown Nurse', address: '' };
  
  const name = extractName(resource);
  
  // Extract nurse home/work address for geocoding
  let address = '';
  if (resource.address && resource.address.length > 0) {
    // Use first address (could be home or work address)
    const addr = resource.address[0];
    const parts = [];
    if (addr.line && addr.line[0]) parts.push(addr.line[0]);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.postalCode) parts.push(addr.postalCode);
    address = parts.join(', ');
  }
  
  return {
    name,
    address
  };
}

function processBundle(bundle, resourceMap = new Map()) {
  if (!bundle.entry) return [];
  
  if (resourceMap.size === 0) {
    bundle.entry.forEach(entry => {
      const resource = entry.resource;
      resourceMap.set(`${resource.resourceType}/${resource.id}`, resource);
    });
  }
  
  const appointments = bundle.entry
    .filter(entry => entry.resource.resourceType === 'Appointment')
    .map(entry => {
      const apt = entry.resource;
      
      // PATIENT INFO - Extract from extensions
      let patientRef = null;
      let patientId = null;
      
      const subjectExt = apt.extension?.find(ext => 
        ext.url?.includes('StructureDefinition/subject')
      );
      if (subjectExt?.valueReference?.reference) {
        patientRef = subjectExt.valueReference.reference;
        patientId = patientRef.replace('Patient/', '');
      }
      
      if (!patientRef) {
        const supportingExt = apt.extension?.find(ext => 
          ext.url?.includes('StructureDefinition/supporting-information')
        );
        const patientRefExt = supportingExt?.extension?.find(ext => 
          ext.url === 'PatientReference'
        );
        if (patientRefExt?.valueReference?.reference) {
          patientRef = patientRefExt.valueReference.reference;
          patientId = patientRef.replace('Patient/', '');
        }
      }
      
      if (!patientRef && apt.subject?.reference) {
        patientRef = apt.subject.reference;
        patientId = patientRef.replace('Patient/', '');
      }
      
      const patient = resourceMap.get(patientRef);
      const patientName = patient ? extractName(patient) : 'Unknown Patient';
      
      // NURSE INFO - Extract from participants
      const nurseParticipant = apt.participant?.find(p => 
        p.type?.[0]?.coding?.[0]?.code === 'PRF' || 
        p.actor?.reference?.startsWith('Practitioner/')
      );
      const nurseRef = nurseParticipant?.actor?.reference;
      const nurseId = nurseRef?.replace('Practitioner/', '');
      const nurse = resourceMap.get(nurseRef);
      
      // FIXED: Extract nurse name and address separately
      const nurseName = nurse ? extractName(nurse) : 'Unknown Nurse';
      const nurseAddressInfo = nurse ? extractNurseAddressInfo(nurse) : { name: 'Unknown Nurse', address: '' };
      
      // PATIENT LOCATION INFO - Extract from extensions (with coordinates)
      const locationExt = apt.extension?.find(ext => 
        ext.url?.includes('service-location')
      );
      const locationRef = locationExt?.valueReference?.reference;
      const locationId = locationRef?.replace('Location/', '');
      const location = resourceMap.get(locationRef);
      
      // FIXED: Patient location with coordinates (from Location resource)
      const locationInfo = location ? extractLocationInfo(location) : { 
        name: 'Unknown Location', 
        address: '', 
        latitude: null, 
        longitude: null 
      };
      
      // SERVICE INFO
      const serviceType = apt.serviceType?.[0]?.coding?.[0]?.display || 
                         apt.serviceType?.[0]?.text || '';
      const serviceCode = apt.serviceType?.[0]?.coding?.[0]?.code || '';
      
      // START DATE
      let startDate = apt.start;
      
      const dateTimeExt = apt.extension?.find(ext => 
        ext.url?.includes('appointment-date-time')
      );
      if (dateTimeExt?.extension) {
        const startTimeExt = dateTimeExt.extension.find(ext => ext.url === 'AppointmentStartTime');
        if (startTimeExt?.valueString) {
          startDate = startTimeExt.valueString;
        }
      }
      
      return {
        fhirId: apt.id,
        
        // Patient info
        patientId,
        patientName,
        
        // Nurse info  
        nurseId,
        nurseName,
        
        // FIXED: Nurse location info (for geocoding)
        nurseLocationName: nurseName,                    // Nurse name for display
        nurseLocationAddress: nurseAddressInfo.address,  // Nurse address for geocoding
        nurseLocationLatitude: null,                     // Will be populated by geocoding service
        nurseLocationLongitude: null,                    // Will be populated by geocoding service
        
        // Appointment details
        startDate,
        status: apt.status,
        serviceType,
        serviceCode,
        
        // FIXED: Patient service location (with coordinates from Location resource)
        locationId,
        locationName: locationInfo.name,
        locationAddress: locationInfo.address,
        locationLatitude: locationInfo.latitude,    // Patient coordinates from FHIR
        locationLongitude: locationInfo.longitude,  // Patient coordinates from FHIR
      };
    });
    
  return appointments;
}

// ===================
// MAIN SYNC FUNCTION (unchanged)
// ===================

async function fullSync() {
  console.log('🚀 Starting HCHB weekly sync with FULL PAGINATION and 5 CONCURRENT WORKERS...');
  
  try {
    const startTime = Date.now();
    const bundle = await fetchAllAppointments();
    const fetchTime = Date.now() - startTime;
    
    console.log(`📊 Fetched ${bundle.total} SN11 appointments in ${Math.round(fetchTime / 1000)}s`);
    
    if (bundle.entry && bundle.entry.length > 0) {
      const resourceTypes = {};
      bundle.entry.forEach(entry => {
        const type = entry.resource.resourceType;
        resourceTypes[type] = (resourceTypes[type] || 0) + 1;
      });
      console.log('📊 Resource breakdown:', resourceTypes);
      
      const batchStartTime = Date.now();
      const resourceMap = await fetchPatientAndPractitionerData(bundle.entry);
      const batchTime = Date.now() - batchStartTime;
      
      console.log(`⚡ Concurrent batch fetching completed in ${Math.round(batchTime / 1000)}s`);
      
      const allResources = new Map();
      
      bundle.entry.forEach(entry => {
        allResources.set(`${entry.resource.resourceType}/${entry.resource.id}`, entry.resource);
      });
      
      resourceMap.forEach((resource, key) => {
        allResources.set(key, resource);
      });
      
      console.log(`📊 Total resources available for processing: ${allResources.size}`);
      
      const appointmentData = processBundle(bundle, allResources);
      console.log(`🔄 Processed ${appointmentData.length} appointments`);
      
      // Show sample processed data with FIXED fields
      if (appointmentData.length > 0) {
        console.log('\n📋 Sample processed data (first 3 appointments):');
        appointmentData.slice(0, 3).forEach((apt, i) => {
          console.log(`  Appointment ${i + 1}:`);
          console.log(`    FHIR ID: ${apt.fhirId}`);
          console.log(`    Patient: ${apt.patientName} (${apt.patientId})`);
          console.log(`    Nurse: ${apt.nurseName} (${apt.nurseId})`);
          console.log(`    🏠 Nurse Address: ${apt.nurseLocationAddress || 'No address'}`);
          console.log(`    Start: ${apt.startDate}`);
          console.log(`    Status: ${apt.status}`);
          console.log(`    Service: ${apt.serviceType} (${apt.serviceCode})`);
          console.log(`    📍 Patient Location: ${apt.locationName} (${apt.locationId})`);
          console.log(`    📍 Patient Address: ${apt.locationAddress}`);
          if (apt.locationLatitude && apt.locationLongitude) {
            console.log(`    📍 Patient Coordinates: ${apt.locationLatitude}, ${apt.locationLongitude}`);
          }
        });
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`\n📈 Performance Summary:`);
      console.log(`   Appointment fetching: ${Math.round(fetchTime / 1000)}s`);
      console.log(`   Resource batch fetching: ${Math.round(batchTime / 1000)}s`);
      console.log(`   Total sync time: ${Math.round(totalTime / 1000)}s`);
      console.log(`   Complete dataset: ${bundle.total} appointments (full pagination)`);
      
      const clearedCount = clearDatabase();
      
      if (appointmentData.length > 0) {
        await insertAppointmentsInBatches(appointmentData);
        console.log(`✅ Replaced ${clearedCount} old appointments with ${appointmentData.length} new SN11 appointments`);
        
        // Show counts for verification
        const nurseAddressCount = appointmentData.filter(apt => apt.nurseLocationAddress && apt.nurseLocationAddress.trim() !== '').length;
        const patientCoordCount = appointmentData.filter(apt => apt.locationLatitude && apt.locationLongitude).length;
        
        console.log(`\n🔍 Data Verification:`);
        console.log(`   📋 Total appointments: ${appointmentData.length}`);
        console.log(`   🏠 Appointments with nurse addresses: ${nurseAddressCount}/${appointmentData.length} (${Math.round((nurseAddressCount/appointmentData.length)*100)}%)`);
        console.log(`   📍 Appointments with patient coordinates: ${patientCoordCount}/${appointmentData.length} (${Math.round((patientCoordCount/appointmentData.length)*100)}%)`);
        console.log(`   💡 Next step: Run geocoding to add nurse coordinates`);
      } else {
        console.log(`⚠️  No SN11 appointments found for this week`);
      }
      
      console.log('\n✅ Weekly sync with NURSE ADDRESSES and PATIENT COORDINATES completed successfully!');
      return { success: true, count: appointmentData.length, timeMs: totalTime };
    } else {
      console.log('❌ No appointments found in bundle');
      return { success: false, error: 'No appointments found' };
    }
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.error('Full error:', error);
    return { success: false, error: error.message };
  }
}

// ===================
// EXPORTS & CLI
// ===================

module.exports = { fullSync, getAuthToken };

if (require.main === module) {
  const { initializeDatabase } = require('../db/config');
  
  initializeDatabase();
  fullSync().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}