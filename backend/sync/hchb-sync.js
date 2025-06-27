// backend/sync/hchb-sync.js
// Simple HCHB sync for appointments only

const axios = require('axios');
const { db, appointments } = require('../db/config');
require('dotenv').config();

// ===================
// CONFIGURATION & AUTH
// ===================

const CONFIG = {
  clientId: process.env.HCHB_CLIENT_ID,
  resourceSecurityId: process.env.HCHB_RESOURCE_SECURITY_ID,
  agencySecret: process.env.HCHB_AGENCY_SECRET,
  tokenUrl: process.env.HCHB_TOKEN_URL,
  apiBaseUrl: process.env.HCHB_API_BASE_URL,
  batchSize: 200, // Increased batch size
  maxWorkers: 10, // Concurrent workers
  timeout: 60000,
};

let tokenCache = null;

async function getAuthToken() {
  if (tokenCache && tokenCache.expiresAt > new Date()) {
    return tokenCache.token;
  }

  console.log('🔑 Getting HCHB token...');
  
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
// DATE UTILITIES
// ===================

// ===================
// DATE UTILITIES
// ===================

function getWeekDateRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days since Monday (Monday = 0)
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Get Monday of current week
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() - daysSinceMonday);
  mondayDate.setHours(0, 0, 0, 0);
  
  // Generate array of all days in the week (Monday to Sunday)
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(mondayDate);
    day.setDate(mondayDate.getDate() + i);
    weekDays.push({
      date: day.toISOString().split('T')[0], // YYYY-MM-DD
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
// CONCURRENT PROCESSING
// ===================

class ConcurrentProcessor {
  constructor(maxWorkers = 10) {
    this.maxWorkers = maxWorkers;
    this.activeWorkers = 0;
    this.queue = [];
  }

  async processInBatches(tasks, processor) {
    return new Promise((resolve, reject) => {
      const results = [];
      let completed = 0;

      const processTask = async (task, index) => {
        this.activeWorkers++;
        try {
          const result = await processor(task);
          results[index] = result;
        } catch (error) {
          results[index] = { error: error.message, task };
        } finally {
          this.activeWorkers--;
          completed++;
          
          if (completed === tasks.length) {
            resolve(results);
          } else {
            // Process next task if available
            this.processNext();
          }
        }
      };

      const processNext = () => {
        if (this.queue.length > 0 && this.activeWorkers < this.maxWorkers) {
          const { task, index } = this.queue.shift();
          processTask(task, index);
        }
      };

      // Start initial batch
      for (let i = 0; i < Math.min(tasks.length, this.maxWorkers); i++) {
        processTask(tasks[i], i);
      }

      // Queue remaining tasks
      for (let i = this.maxWorkers; i < tasks.length; i++) {
        this.queue.push({ task: tasks[i], index: i });
      }

      this.processNext = processNext;
    });
  }
}

async function debugAuth() {
  console.log('🔍 Debugging HCHB Authentication...');
  console.log('='.repeat(50));
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log(`CLIENT_ID: ${CONFIG.clientId ? '✅ SET' : '❌ MISSING'}`);
  console.log(`RESOURCE_SECURITY_ID: ${CONFIG.resourceSecurityId ? '✅ SET' : '❌ MISSING'}`);
  console.log(`AGENCY_SECRET: ${CONFIG.agencySecret ? '✅ SET' : '❌ MISSING'}`);
  console.log(`TOKEN_URL: ${CONFIG.tokenUrl}`);
  console.log(`API_BASE_URL: ${CONFIG.apiBaseUrl}`);
  
  // Check actual values (first 4 chars only)
  console.log('\nFirst 4 characters of each credential:');
  console.log(`CLIENT_ID starts with: ${CONFIG.clientId?.substring(0, 4) || 'MISSING'}`);
  console.log(`RESOURCE_SECURITY_ID starts with: ${CONFIG.resourceSecurityId?.substring(0, 4) || 'MISSING'}`);
  console.log(`AGENCY_SECRET starts with: ${CONFIG.agencySecret?.substring(0, 4) || 'MISSING'}`);
  
  // Try authentication with detailed error handling
  console.log('\n🔑 Testing token request...');
  
  try {
    const requestData = new URLSearchParams({
      grant_type: 'agency_auth',
      client_id: CONFIG.clientId,
      scope: 'openid HCHB.api.scope agency.identity hchb.identity',
      resource_security_id: CONFIG.resourceSecurityId,
      agency_secret: CONFIG.agencySecret,
    });
    
    console.log('Request payload keys:', Array.from(requestData.keys()));
    
    const response = await axios.post(
      CONFIG.tokenUrl,
      requestData,
      {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: CONFIG.timeout,
      }
    );
    
    console.log('✅ Token request successful!');
    console.log('Response keys:', Object.keys(response.data));
    
  } catch (error) {
    console.log('❌ Token request failed');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Response Headers:', error.response?.headers);
    console.log('Response Data:', JSON.stringify(error.response?.data, null, 2));
    
    // Common HCHB auth errors
    if (error.response?.status === 400) {
      console.log('\n🔍 Status 400 usually means:');
      console.log('- Invalid client_id');
      console.log('- Invalid resource_security_id'); 
      console.log('- Invalid agency_secret');
      console.log('- Wrong grant_type or scope');
      console.log('- Missing required parameters');
    }
  }
}

// ===================
// FHIR DATA FETCHING
// ===================

// ===================
// FHIR DATA FETCHING
// ===================

// ===================
// FHIR DATA FETCHING
// ===================

async function fetchAppointmentPage(url, token) {
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/fhir+json',
    },
    timeout: CONFIG.timeout,
  });

  return response.data;
}

async function fetchAppointmentsForDay(date, token) {
  console.log(`📅 Fetching appointments for ${date.dayName} (${date.date})${date.isToday ? ' - TODAY' : ''}`);

  // Build URL for single day - no filter for now to see actual service types
  const baseUrl = `${CONFIG.apiBaseUrl}/Appointment`;
  const params = new URLSearchParams({
    _count: CONFIG.batchSize.toString(),
    // Single day filter - exact date match
    date: date.date,
  });
  
  // Add include parameters for related resources
  params.append('_include', 'Appointment:patient');
  params.append('_include', 'Appointment:practitioner');
  params.append('_include', 'Appointment:location');

  let nextUrl = `${baseUrl}?${params.toString()}`;
  const dayResources = [];
  let pageCount = 0;

  console.log(`   🔍 No filters - fetching all appointments to analyze service types`);

  while (nextUrl) {
    try {
      const bundle = await fetchAppointmentPage(nextUrl, token);
      pageCount++;
      
      if (bundle.entry) {
        dayResources.push(...bundle.entry.map(entry => entry.resource));
        
        // On first page, analyze service types
        if (pageCount === 1) {
          const appointments = bundle.entry.filter(entry => entry.resource.resourceType === 'Appointment');
          if (appointments.length > 0) {
            console.log(`   🔍 Sample service types found:`);
            const serviceTypes = new Set();
            
            appointments.slice(0, 5).forEach((entry, i) => {
              const apt = entry.resource;
              if (apt.serviceType && apt.serviceType.length > 0) {
                apt.serviceType.forEach(st => {
                  if (st.coding && st.coding[0]) {
                    const code = st.coding[0].code;
                    const display = st.coding[0].display;
                    serviceTypes.add(`${code}: ${display}`);
                  }
                });
              }
            });
            
            serviceTypes.forEach(type => console.log(`     - ${type}`));
          }
        }
      }

      // Find next page URL
      const nextLink = bundle.link?.find(link => link.relation === 'next');
      nextUrl = nextLink?.url || null;
      
      // Intelligent rate limiting
      const rateLimitDelay = getRateLimitDelay(bundle);
      if (rateLimitDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
      }
      
    } catch (error) {
      // Handle rate limiting with retry
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || 30;
        console.log(`   ⏳ Rate limited - waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      // Handle token expiration
      if (error.response?.status === 401) {
        console.log('   🔄 Token expired - getting new token...');
        tokenCache = null;
        const newToken = await getAuthToken();
        continue;
      }
      
      console.error(`   ❌ Error fetching ${date.dayName}:`, error.response?.data || error.message);
      break;
    }
  }

  const appointments = dayResources.filter(r => r.resourceType === 'Appointment');
  console.log(`   ✅ ${date.dayName}: ${appointments.length} appointments (${dayResources.length} total resources, ${pageCount} pages)`);
  
  return dayResources;
}

async function fetchAppointments() {
  const token = await getAuthToken();
  const dateRange = getWeekDateRange();
  
  console.log(`📅 Fetching appointments day-by-day for current week:`);
  console.log(`   Week: ${dateRange.startDate} to ${dateRange.endDate}`);
  console.log(`   Days: ${dateRange.weekDays.map(d => d.dayName).join(', ')}`);
  console.log('');

  const allResources = [];
  let totalAppointments = 0;

  // Process each day sequentially to avoid hitting API limits
  for (const day of dateRange.weekDays) {
    const dayResources = await fetchAppointmentsForDay(day, token);
    allResources.push(...dayResources);
    
    const dayAppointments = dayResources.filter(r => r.resourceType === 'Appointment').length;
    totalAppointments += dayAppointments;
    
    // Small delay between days to be respectful
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('');
  console.log(`📊 Week Summary:`);
  console.log(`   Total appointments: ${totalAppointments}`);
  console.log(`   Total resources: ${allResources.length}`);
  console.log(`   Average per day: ${Math.round(totalAppointments / 7)} appointments`);

  // Separate resource types for final breakdown
  const appointments = allResources.filter(r => r.resourceType === 'Appointment');
  const patients = allResources.filter(r => r.resourceType === 'Patient');
  const practitioners = allResources.filter(r => r.resourceType === 'Practitioner');
  const locations = allResources.filter(r => r.resourceType === 'Location');

  console.log(`📋 Resource breakdown:`);
  console.log(`   Appointments: ${appointments.length}`);
  console.log(`   Patients: ${patients.length}`);
  console.log(`   Practitioners: ${practitioners.length}`);
  console.log(`   Locations: ${locations.length}`);

  return allResources;
}

// Smart rate limiting based on response patterns
function getRateLimitDelay(response) {
  // Check for rate limit headers
  if (response.headers) {
    const remaining = parseInt(response.headers['x-ratelimit-remaining']) || null;
    
    if (remaining !== null && remaining < 10) {
      return 300; // Slow down when approaching limit
    }
  }
  
  // Default minimal delay
  return 25;
}

// ===================
// FHIR DATA TRANSFORMATION
// ===================

function extractNameFromResource(resource) {
  if (!resource) return null;
  
  // Handle Patient resource
  if (resource.resourceType === 'Patient') {
    const name = resource.name?.[0];
    return name ? `${name.given?.[0] || ''} ${name.family || ''}`.trim() : null;
  }
  
  // Handle Practitioner resource
  if (resource.resourceType === 'Practitioner') {
    const name = resource.name?.[0];
    return name ? `${name.given?.[0] || ''} ${name.family || ''}`.trim() : null;
  }
  
  return null;
}

function findContainedResource(appointment, resourceType, id) {
  if (!appointment.contained) return null;
  
  return appointment.contained.find(resource => 
    resource.resourceType === resourceType && resource.id === id
  );
}

function transformAppointment(fhirAppointment, bundleResources = []) {
  const description = fhirAppointment.description || '';
  const serviceTypes = fhirAppointment.serviceType?.map(st => st.text).join(' ') || '';
  
  // Skip IDG meetings
  if (description.includes('IDG') || serviceTypes.includes('IDG')) {
    return null;
  }

  const participants = fhirAppointment.participant || [];
  
  // Extract IDs from references
  const patientRef = participants.find(p => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;
  const nurseRef = participants.find(p => p.actor?.reference?.startsWith('Practitioner/'))?.actor?.reference;
  const locationRef = participants.find(p => p.actor?.reference?.startsWith('Location/'))?.actor?.reference;
  
  const patientId = patientRef?.replace('Patient/', '') || null;
  const nurseId = nurseRef?.replace('Practitioner/', '') || null;
  const locationId = locationRef?.replace('Location/', '') || null;

  // Try to get names from contained resources first
  let patientName = null;
  let nurseName = null;

  // Method 1: Check contained resources
  if (patientId) {
    const containedPatient = findContainedResource(fhirAppointment, 'Patient', patientId);
    patientName = extractNameFromResource(containedPatient);
  }

  if (nurseId) {
    const containedPractitioner = findContainedResource(fhirAppointment, 'Practitioner', nurseId);
    nurseName = extractNameFromResource(containedPractitioner);
  }

  // Method 2: Check if names are in extensions
  if (!patientName || !nurseName) {
    const extensions = fhirAppointment.extension || [];
    
    extensions.forEach(ext => {
      if (ext.url?.includes('patient-name') || ext.url?.includes('patientName')) {
        patientName = patientName || ext.valueString;
      }
      if (ext.url?.includes('practitioner-name') || ext.url?.includes('practitionerName')) {
        nurseName = nurseName || ext.valueString;
      }
    });
  }

  // Method 3: Look in bundle resources (from _include)
  if (!patientName && patientId) {
    const patient = bundleResources.find(r => r.resourceType === 'Patient' && r.id === patientId);
    patientName = extractNameFromResource(patient);
  }

  if (!nurseName && nurseId) {
    const practitioner = bundleResources.find(r => r.resourceType === 'Practitioner' && r.id === nurseId);
    nurseName = extractNameFromResource(practitioner);
  }

  // Parse times
  const startTime = fhirAppointment.start ? new Date(fhirAppointment.start).toISOString() : null;
  const endTime = fhirAppointment.end ? new Date(fhirAppointment.end).toISOString() : null;

  // Extract care services
  const careServices = fhirAppointment.serviceType?.map(st => st.text) || [];

  return {
    id: fhirAppointment.id,
    nurseId: nurseId,
    nurseName: nurseName || 'Unknown Nurse',
    patientId: patientId,
    patientName: patientName || 'Unknown Patient',
    startTime: startTime,
    endTime: endTime,
    status: fhirAppointment.status || 'unknown',
    careServices: JSON.stringify(careServices),
    locationId: locationId,
  };
}

// ===================
// DATABASE OPERATIONS
// ===================

// ===================
// DATABASE OPERATIONS
// ===================

async function syncAppointments(fhirBundle) {
  console.log('📅 Processing appointments with concurrent workers...');
  
  // Separate appointments from included resources
  const appointmentResources = fhirBundle.filter(r => r.resourceType === 'Appointment');
  const includedResources = fhirBundle.filter(r => r.resourceType !== 'Appointment');
  
  console.log(`🔄 Processing ${appointmentResources.length} appointments in batches...`);

  // Process appointments in batches using concurrent workers
  const processor = new ConcurrentProcessor(CONFIG.maxWorkers);
  const batchSize = 50; // Process 50 appointments per batch
  const batches = [];
  
  for (let i = 0; i < appointmentResources.length; i += batchSize) {
    batches.push(appointmentResources.slice(i, i + batchSize));
  }

  let totalSynced = 0;
  let totalFiltered = 0;

  const batchResults = await processor.processInBatches(batches, async (batch) => {
    let batchSynced = 0;
    let batchFiltered = 0;

    for (const fhirAppointment of batch) {
      try {
        const appointment = transformAppointment(fhirAppointment, includedResources);
        
        if (!appointment) {
          batchFiltered++;
          continue; // Skip filtered appointments (IDG meetings, etc.)
        }
        
        await db.insert(appointments)
          .values(appointment)
          .onConflictDoUpdate({
            target: appointments.id,
            set: {
              nurseId: appointment.nurseId,
              nurseName: appointment.nurseName,
              patientId: appointment.patientId,
              patientName: appointment.patientName,
              startTime: appointment.startTime,
              endTime: appointment.endTime,
              status: appointment.status,
              careServices: appointment.careServices,
              locationId: appointment.locationId,
            }
          });
        
        batchSynced++;
      } catch (error) {
        console.error(`❌ Error syncing appointment ${fhirAppointment.id}:`, error.message);
      }
    }

    return { synced: batchSynced, filtered: batchFiltered };
  });

  // Aggregate results
  for (const result of batchResults) {
    if (result && !result.error) {
      totalSynced += result.synced;
      totalFiltered += result.filtered;
    }
  }

  console.log(`✅ Sync completed:`);
  console.log(`   📋 Synced: ${totalSynced} appointments`);
  console.log(`   🚫 Filtered: ${totalFiltered} appointments (IDG meetings, etc.)`);
  console.log(`   📊 Total processed: ${totalSynced + totalFiltered}`);

  return totalSynced;
}

// ===================
// MAIN SYNC FUNCTION
// ===================

async function fullSync() {
  console.log('🚀 Starting HCHB appointments sync...');
  
  try {
    const fhirBundle = await fetchAppointments();
    const syncedCount = await syncAppointments(fhirBundle);
    
    console.log(`✅ Sync completed! Processed ${syncedCount} appointments`);
    return { success: true, count: syncedCount };
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ===================
// EXPORTS & CLI
// ===================

module.exports = { fullSync, getAuthToken, debugAuth };

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🏥 HCHB Sync Tool

Usage:
  node hchb-sync.js              # Run full sync
  node hchb-sync.js --debug      # Debug authentication
  node hchb-sync.js --test       # Test connection
  node hchb-sync.js --help       # Show this help

Environment Variables Required:
  HCHB_CLIENT_ID                 Your HCHB client ID
  HCHB_RESOURCE_SECURITY_ID      Your resource security ID  
  HCHB_AGENCY_SECRET             Your agency secret
  HCHB_TOKEN_URL                 Token endpoint URL
  HCHB_API_BASE_URL              FHIR API base URL
    `);
    process.exit(0);
  }

  if (args.includes('--debug') || args.includes('-d')) {
    debugAuth().then(() => process.exit(0));
  } else if (args.includes('--test') || args.includes('-t')) {
    console.log('🧪 Testing HCHB connection...');
    getAuthToken()
      .then(() => {
        console.log('✅ HCHB connection test successful!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ HCHB connection test failed:', error.message);
        process.exit(1);
      });
  } else {
    const { initializeDatabase } = require('../db/config');
    
    initializeDatabase();
    fullSync().then(result => {
      process.exit(result.success ? 0 : 1);
    });
  }
}