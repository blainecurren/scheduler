// backend/test-api.js
// Comprehensive API test suite for all HCHB endpoints

const axios = require('axios');
require('dotenv').config();

// ===================
// CONFIGURATION
// ===================

const CONFIG = {
  baseUrl: process.env.API_TEST_URL || 'http://localhost:3001',
  timeout: 30000,
  testDate: '2025-07-01', // Adjust this to a date with actual data
  // Add test nurse IDs here (replace with actual IDs from your database)
  testNurseIds: ['test-nurse-1', 'test-nurse-2'], // Update these!
  testPatientIds: ['test-patient-1'], // Update these!
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

// ===================
// UTILITY FUNCTIONS
// ===================

function logTest(name, status, details = '') {
  const timestamp = new Date().toISOString();
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  
  console.log(`${statusIcon} ${name} - ${status}`);
  if (details) console.log(`   📝 ${details}`);
  
  testResults.details.push({ timestamp, name, status, details });
  
  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') testResults.failed++;
  else testResults.skipped++;
}

async function makeRequest(method, endpoint, data = null, expectedStatus = 200) {
  try {
    const config = {
      method,
      url: `${CONFIG.baseUrl}${endpoint}`,
      timeout: CONFIG.timeout,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    };
    
    if (data) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }
    
    const response = await axios(config);
    
    return {
      success: response.status === expectedStatus,
      status: response.status,
      data: response.data,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || null,
      error: error.message
    };
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===================
// TEST FUNCTIONS
// ===================

async function testHealthEndpoint() {
  console.log('\n🏥 Testing Health Endpoint...');
  
  const result = await makeRequest('GET', '/health');
  
  if (result.success && result.data.status === 'ok') {
    logTest('GET /health', 'PASS', 'Server is healthy');
    return true;
  } else {
    logTest('GET /health', 'FAIL', `Status: ${result.status}, Error: ${result.error}`);
    return false;
  }
}

async function testAppointmentEndpoints() {
  console.log('\n📋 Testing Appointment Endpoints...');
  
  // Test GET /api/appointments/options
  const optionsResult = await makeRequest('GET', '/api/appointments/options');
  if (optionsResult.success && optionsResult.data.nurses) {
    logTest('GET /api/appointments/options', 'PASS', `Found ${optionsResult.data.nurses.length} nurses`);
  } else {
    logTest('GET /api/appointments/options', 'FAIL', `Status: ${optionsResult.status}`);
  }
  
  await delay(500);
  
  // Test GET /api/appointments/filter
  const filterResult = await makeRequest('GET', '/api/appointments/filter?dateFrom=2025-07-01&dateTo=2025-07-01');
  if (filterResult.success) {
    logTest('GET /api/appointments/filter', 'PASS', `Found ${filterResult.data.count || 0} appointments`);
  } else {
    logTest('GET /api/appointments/filter', 'FAIL', `Status: ${filterResult.status}`);
  }
  
  await delay(500);
  
  // Test GET /api/appointments/mappable
  const mappableResult = await makeRequest('GET', `/api/appointments/mappable?date=${CONFIG.testDate}`);
  if (mappableResult.success) {
    logTest('GET /api/appointments/mappable', 'PASS', `Found ${mappableResult.data.totalAppointments || 0} mappable appointments`);
  } else {
    logTest('GET /api/appointments/mappable', 'FAIL', `Status: ${mappableResult.status}`);
  }
  
  await delay(500);
  
  // Test GET /api/appointments/calendar
  const calendarResult = await makeRequest('GET', `/api/appointments/calendar?dateFrom=${CONFIG.testDate}&dateTo=${CONFIG.testDate}`);
  if (calendarResult.success) {
    logTest('GET /api/appointments/calendar', 'PASS', `Found ${calendarResult.data.totalAppointments || 0} calendar appointments`);
  } else {
    logTest('GET /api/appointments/calendar', 'FAIL', `Status: ${calendarResult.status}`);
  }
  
  await delay(500);
  
  // Test GET /api/appointments/stats
  const statsResult = await makeRequest('GET', '/api/appointments/stats');
  if (statsResult.success && typeof statsResult.data.total === 'number') {
    logTest('GET /api/appointments/stats', 'PASS', `Total appointments: ${statsResult.data.total}`);
  } else {
    logTest('GET /api/appointments/stats', 'FAIL', `Status: ${statsResult.status}`);
  }
  
  await delay(500);
  
  // Test GET /api/appointments/sync/status
  const syncStatusResult = await makeRequest('GET', '/api/appointments/sync/status');
  if (syncStatusResult.success) {
    logTest('GET /api/appointments/sync/status', 'PASS', `Total appointments in DB: ${syncStatusResult.data.totalAppointments || 0}`);
  } else {
    logTest('GET /api/appointments/sync/status', 'FAIL', `Status: ${syncStatusResult.status}`);
  }
  
  // Skip POST /api/appointments/sync for now (takes too long and hits external API)
  logTest('POST /api/appointments/sync', 'SKIP', 'Skipped - would trigger full HCHB sync');
}

async function testCoordinateEndpoints() {
  console.log('\n🗺️  Testing Coordinate Endpoints...');
  
  // Test GET /api/coordinates/status
  const statusResult = await makeRequest('GET', '/api/coordinates/status');
  if (statusResult.success) {
    const configured = statusResult.data.data?.azureMapsConfigured;
    logTest('GET /api/coordinates/status', 'PASS', `Azure Maps configured: ${configured}`);
  } else {
    logTest('GET /api/coordinates/status', 'FAIL', `Status: ${statusResult.status}`);
  }
  
  await delay(500);
  
  // Test GET /api/coordinates/stats
  const statsResult = await makeRequest('GET', '/api/coordinates/stats');
  if (statsResult.success && statsResult.data.overview) {
    const total = statsResult.data.overview.totalAppointments;
    const withCoords = statsResult.data.overview.appointmentsWithNurseCoords;
    logTest('GET /api/coordinates/stats', 'PASS', `${withCoords}/${total} appointments have nurse coordinates`);
  } else {
    logTest('GET /api/coordinates/stats', 'FAIL', `Status: ${statsResult.status}`);
  }
  
  // Skip POST /api/coordinates/geocode for now (costs money and takes time)
  logTest('POST /api/coordinates/geocode', 'SKIP', 'Skipped - would trigger Azure Maps geocoding');
}

async function testRoutingEndpoints() {
  console.log('\n🚗 Testing Routing Endpoints...');
  
  // Test GET /api/routing/status
  const statusResult = await makeRequest('GET', '/api/routing/status');
  if (statusResult.success) {
    const ready = statusResult.data.data?.serviceReady;
    const routableAppts = statusResult.data.data?.statistics?.routableAppointments || 0;
    logTest('GET /api/routing/status', 'PASS', `Service ready: ${ready}, Routable appointments: ${routableAppts}`);
  } else {
    logTest('GET /api/routing/status', 'FAIL', `Status: ${statusResult.status}`);
  }
  
  await delay(500);
  
  // Test GET /api/routing/nurses-with-routes/:date
  const nursesResult = await makeRequest('GET', `/api/routing/nurses-with-routes/${CONFIG.testDate}`);
  if (nursesResult.success) {
    const nurseCount = nursesResult.data.data?.totalNurses || 0;
    logTest(`GET /api/routing/nurses-with-routes/${CONFIG.testDate}`, 'PASS', `Found ${nurseCount} nurses with routes`);
    
    // Update test nurse IDs with real ones if available
    if (nurseCount > 0 && nursesResult.data.data.nurses.length > 0) {
      CONFIG.testNurseIds = nursesResult.data.data.nurses.slice(0, 2).map(nurse => nurse.nurseId);
      console.log(`   📝 Updated test nurse IDs: ${CONFIG.testNurseIds.join(', ')}`);
    }
  } else {
    logTest(`GET /api/routing/nurses-with-routes/${CONFIG.testDate}`, 'FAIL', `Status: ${nursesResult.status}`);
  }
  
  await delay(500);
  
  // Test GET /api/routing/appointments/:nurseId/:date (only if we have a real nurse ID)
  if (CONFIG.testNurseIds[0] && CONFIG.testNurseIds[0] !== 'test-nurse-1') {
    const appointmentsResult = await makeRequest('GET', `/api/routing/appointments/${CONFIG.testNurseIds[0]}/${CONFIG.testDate}`);
    if (appointmentsResult.success) {
      const apptCount = appointmentsResult.data.data?.totalAppointments || 0;
      logTest(`GET /api/routing/appointments/${CONFIG.testNurseIds[0]}/${CONFIG.testDate}`, 'PASS', `Found ${apptCount} appointments`);
    } else {
      logTest(`GET /api/routing/appointments/${CONFIG.testNurseIds[0]}/${CONFIG.testDate}`, 'FAIL', `Status: ${appointmentsResult.status}`);
    }
  } else {
    logTest('GET /api/routing/appointments/:nurseId/:date', 'SKIP', 'No real nurse IDs available for testing');
  }
  
  await delay(500);
  
  // Test POST /api/routing/optimize-single (only if we have real nurse IDs and Azure Maps is configured)
  if (CONFIG.testNurseIds[0] && CONFIG.testNurseIds[0] !== 'test-nurse-1' && process.env.AZURE_MAPS_KEY) {
    console.log(`   🧪 Testing route optimization for nurse: ${CONFIG.testNurseIds[0]}`);
    const optimizeResult = await makeRequest('POST', '/api/routing/optimize-single', {
      nurseId: CONFIG.testNurseIds[0],
      date: CONFIG.testDate
    });
    
    if (optimizeResult.success && optimizeResult.data.success) {
      const summary = optimizeResult.data.data?.summary;
      logTest('POST /api/routing/optimize-single', 'PASS', 
        `Route: ${summary?.totalDistanceMiles?.toFixed(1)}mi, ${summary?.totalTimeFormatted}, $${summary?.estimatedFuelCost?.toFixed(2)}`);
    } else if (optimizeResult.status === 404) {
      logTest('POST /api/routing/optimize-single', 'SKIP', 'No routable appointments found for test nurse');
    } else {
      logTest('POST /api/routing/optimize-single', 'FAIL', `Status: ${optimizeResult.status}, Error: ${optimizeResult.data?.error}`);
    }
  } else {
    logTest('POST /api/routing/optimize-single', 'SKIP', 'No Azure Maps key or real nurse IDs available');
  }
  
  await delay(500);
  
  // Test POST /api/routing/optimize (multiple nurses)
  if (CONFIG.testNurseIds.length > 0 && CONFIG.testNurseIds[0] !== 'test-nurse-1' && process.env.AZURE_MAPS_KEY) {
    const multiOptimizeResult = await makeRequest('POST', '/api/routing/optimize', {
      nurseIds: CONFIG.testNurseIds.slice(0, 2), // Test with max 2 nurses
      date: CONFIG.testDate
    });
    
    if (multiOptimizeResult.success && multiOptimizeResult.data.success) {
      const data = multiOptimizeResult.data.data;
      logTest('POST /api/routing/optimize', 'PASS', 
        `Optimized ${data.successfulRoutes}/${data.nursesProcessed} nurses, Total: ${data.overallStats?.totalDistance?.toFixed(1)}mi`);
    } else if (multiOptimizeResult.status === 500 && multiOptimizeResult.data?.error?.includes('No appointments found')) {
      logTest('POST /api/routing/optimize', 'SKIP', 'No appointments found for test nurses');
    } else {
      logTest('POST /api/routing/optimize', 'FAIL', `Status: ${multiOptimizeResult.status}, Error: ${multiOptimizeResult.data?.error}`);
    }
  } else {
    logTest('POST /api/routing/optimize', 'SKIP', 'No Azure Maps key or real nurse IDs available');
  }
  
  // Skip POST /api/routing/optimize-all-today for safety (could be expensive)
  logTest('POST /api/routing/optimize-all-today', 'SKIP', 'Skipped - would optimize all nurses (potentially expensive)');
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...');
  
  // Test 404 endpoint
  const notFoundResult = await makeRequest('GET', '/api/nonexistent', null, 404);
  if (notFoundResult.status === 404) {
    logTest('GET /api/nonexistent (404 test)', 'PASS', 'Correctly returns 404');
  } else {
    logTest('GET /api/nonexistent (404 test)', 'FAIL', `Expected 404, got ${notFoundResult.status}`);
  }
  
  await delay(500);
  
  // Test invalid routing request
  const invalidRoutingResult = await makeRequest('POST', '/api/routing/optimize', {
    nurseIds: [], // Empty array should fail
    date: CONFIG.testDate
  }, 400);
  
  if (invalidRoutingResult.status === 400) {
    logTest('POST /api/routing/optimize (invalid data)', 'PASS', 'Correctly validates input');
  } else {
    logTest('POST /api/routing/optimize (invalid data)', 'FAIL', `Expected 400, got ${invalidRoutingResult.status}`);
  }
  
  await delay(500);
  
  // Test invalid date format
  const invalidDateResult = await makeRequest('POST', '/api/routing/optimize-single', {
    nurseId: 'test',
    date: 'invalid-date'
  }, 400);
  
  if (invalidDateResult.status === 400) {
    logTest('POST /api/routing/optimize-single (invalid date)', 'PASS', 'Correctly validates date format');
  } else {
    logTest('POST /api/routing/optimize-single (invalid date)', 'FAIL', `Expected 400, got ${invalidDateResult.status}`);
  }
}

// ===================
// MAIN TEST RUNNER
// ===================

async function runAllTests() {
  console.log('🚀 HCHB API Test Suite Starting...');
  console.log(`📡 Testing API at: ${CONFIG.baseUrl}`);
  console.log(`📅 Test Date: ${CONFIG.testDate}`);
  console.log(`🔑 Azure Maps Key: ${process.env.AZURE_MAPS_KEY ? 'Configured' : 'Not configured'}`);
  console.log('');
  
  const startTime = Date.now();
  
  try {
    // Test health first - if this fails, no point continuing
    const healthPassed = await testHealthEndpoint();
    if (!healthPassed) {
      console.log('❌ Health check failed - server may not be running');
      console.log('💡 Make sure to start the server with: npm run server');
      return;
    }
    
    // Run all test suites
    await testAppointmentEndpoints();
    await testCoordinateEndpoints();
    await testRoutingEndpoints();
    await testErrorHandling();
    
  } catch (error) {
    console.error('💥 Test suite encountered an unexpected error:', error.message);
    testResults.failed++;
  }
  
  // Print summary
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const totalTests = testResults.passed + testResults.failed + testResults.skipped;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}/${totalTests}`);
  console.log(`❌ Failed: ${testResults.failed}/${totalTests}`);
  console.log(`⏭️  Skipped: ${testResults.skipped}/${totalTests}`);
  console.log(`⏱️  Total time: ${totalTime}s`);
  console.log('');
  
  if (testResults.failed > 0) {
    console.log('❌ Failed Tests:');
    testResults.details
      .filter(test => test.status === 'FAIL')
      .forEach(test => console.log(`   • ${test.name}: ${test.details}`));
    console.log('');
  }
  
  if (testResults.skipped > 0) {
    console.log('⏭️  Skipped Tests:');
    testResults.details
      .filter(test => test.status === 'SKIP')
      .forEach(test => console.log(`   • ${test.name}: ${test.details}`));
    console.log('');
  }
  
  console.log('💡 Notes:');
  console.log('   • Update CONFIG.testDate with a date that has real appointments');
  console.log('   • Some tests are skipped to avoid costs/long operations');
  console.log('   • Set AZURE_MAPS_KEY environment variable to test routing');
  console.log('   • Ensure database has appointments with coordinates for full testing');
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// ===================
// CLI EXECUTION
// ===================

if (require.main === module) {
  // Check if server is likely running
  if (!process.env.API_TEST_URL && !process.env.PORT) {
    console.log('💡 Make sure your server is running:');
    console.log('   npm run server');
    console.log('');
  }
  
  runAllTests().catch(error => {
    console.error('💥 Test suite failed to start:', error.message);
    console.log('💡 Make sure your server is running on the correct port');
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testHealthEndpoint,
  testAppointmentEndpoints,
  testCoordinateEndpoints,
  testRoutingEndpoints,
  CONFIG
};