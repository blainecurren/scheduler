const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables from global .env file
const dotenv = require('dotenv');

// Robust environment loader - searches for .env file in parent directories
function findEnvFile(startDir = __dirname) {
  let currentDir = startDir;
  
  while (currentDir !== path.dirname(currentDir)) {
    const envPath = path.join(currentDir, '.env');
    try {
      require('fs').accessSync(envPath);
      return envPath;
    } catch {
      currentDir = path.dirname(currentDir);
    }
  }
  
  return null;
}

// Load global environment
function loadGlobalEnv() {
  // For your specific project structure: scheduler/graphql/src/datasources/fhir/HCHBservice.js
  // We need to go up 4 levels to reach the project root (scheduler/)
  const projectRoot = path.resolve(__dirname, '../../../..');
  const rootEnvPath = path.join(projectRoot, '.env');
  
  // Try multiple strategies to find .env file
  const strategies = [
    // 1. Use ENV_FILE_PATH if set
    process.env.ENV_FILE_PATH,
    
    // 2. Project root (4 levels up from this file)
    rootEnvPath,
    
    // 3. Search upward from current directory
    findEnvFile(__dirname),
    
    // 4. Try process.cwd() (where the script was run from)
    path.join(process.cwd(), '.env'),
    
    // 5. Try other common locations
    path.join(__dirname, '../../..', '.env'),     // 3 levels up
    path.join(__dirname, '../..', '.env'),        // 2 levels up
    path.join(__dirname, '..', '.env'),           // 1 level up
    path.join(__dirname, '.env')                  // current directory
  ];
  
  console.log(`🔍 Looking for .env file, expecting it at: ${rootEnvPath}`);
  
  for (const envPath of strategies) {
    if (envPath) {
      try {
        // Check if file exists first
        require('fs').accessSync(envPath);
        
        // Try to load it
        const result = dotenv.config({ path: envPath });
        if (!result.error) {
          console.log(`✅ Environment loaded from: ${envPath}`);
          return envPath;
        }
      } catch (error) {
        // Continue to next strategy
        if (envPath === rootEnvPath) {
          console.log(`❌ Expected .env file not found at: ${envPath}`);
        }
      }
    }
  }
  
  console.warn('⚠️  Could not find .env file, using system environment variables');
  dotenv.config(); // Fallback to default behavior
  return null;
}

// Load the environment
const envFilePath = loadGlobalEnv();

// HCHB API Configuration from environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const RESOURCE_SECURITY_ID = process.env.RESOURCE_SECURITY_ID;
const AGENCY_SECRET = process.env.AGENCY_SECRET;
const TOKEN_URL = process.env.TOKEN_URL;
const API_BASE_URL = process.env.API_BASE_URL;
const REQUEST_TIMEOUT = parseInt(process.env.HCHB_REQUEST_TIMEOUT) || 60000;
const BATCH_SIZE = parseInt(process.env.HCHB_BATCH_SIZE) || 100;
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.HCHB_MAX_CONCURRENT_REQUESTS) || 10;

// Validate required environment variables
function validateEnvironmentVariables() {
  const requiredVars = [
    'CLIENT_ID',
    'RESOURCE_SECURITY_ID', 
    'AGENCY_SECRET',
    'TOKEN_URL',
    'API_BASE_URL'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

// Enhanced logging utility with different levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;

const logger = {
  error: (msg, error = null) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`);
      if (error && error.stack) {
        console.error(error.stack);
      }
    }
  },
  warning: (msg) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`);
    }
  },
  info: (msg) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`[INFO] ${new Date().toISOString()} - ${msg}`);
    }
  },
  debug: (msg, data = null) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`);
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  },
  test: (msg) => {
    console.log(`[TEST] ${new Date().toISOString()} - ${msg}`);
  }
};

/**
 * Get HCHB API bearer token
 */
async function getHchbToken() {
  logger.info("Requesting a new HCHB API token...");
  logger.debug("Token request details", {
    tokenUrl: TOKEN_URL,
    clientId: CLIENT_ID,
    resourceSecurityId: RESOURCE_SECURITY_ID ? "***SET***" : "***NOT SET***",
    agencySecret: AGENCY_SECRET ? "***SET***" : "***NOT SET***"
  });
  
  const data = new URLSearchParams({
    grant_type: "agency_auth",
    client_id: CLIENT_ID,
    scope: "openid HCHB.api.scope agency.identity hchb.identity",
    resource_security_id: RESOURCE_SECURITY_ID,
    agency_secret: AGENCY_SECRET,
  });
  
  logger.debug("Request payload", {
    grant_type: "agency_auth",
    client_id: CLIENT_ID,
    scope: "openid HCHB.api.scope agency.identity hchb.identity",
    resource_security_id: RESOURCE_SECURITY_ID ? "***SET***" : "***NOT SET***",
    agency_secret: AGENCY_SECRET ? "***SET***" : "***NOT SET***"
  });
  
  try {
    logger.debug(`Making POST request to: ${TOKEN_URL}`);
    
    const response = await axios.post(TOKEN_URL, data, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const token = response.data.access_token;
    logger.info("Successfully obtained HCHB API token");
    logger.debug("Token details", {
      tokenLength: token ? token.length : 0,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type
    });
    return token;
  } catch (error) {
    logger.error(`Failed to obtain token: ${error.message}`, error);
    
    // Enhanced error logging
    if (error.response) {
      logger.error(`Response status: ${error.response.status}`);
      logger.error(`Response status text: ${error.response.statusText}`);
      logger.error(`Response headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      logger.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      logger.error("No response received from server");
      logger.error(`Request details: ${JSON.stringify(error.request, null, 2)}`);
    } else {
      logger.error(`Request setup error: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * Sleep utility function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test connection to HCHB API endpoints - FIXED VERSION
 */
async function testConnection() {
  logger.test("Testing connection to HCHB endpoints...");
  
  try {
    // Test token endpoint directly with a HEAD request
    logger.test("Testing token endpoint accessibility...");
    logger.test(`Token URL: ${TOKEN_URL}`);
    
    // Try a HEAD request to the actual token endpoint
    const tokenResponse = await axios.head(TOKEN_URL, {
      timeout: 10000
    });
    logger.test(`✅ Token endpoint accessible - Status: ${tokenResponse.status}`);
  } catch (error) {
    // This is expected to fail with 400/405 since HEAD requests aren't supported
    if (error.response && (error.response.status === 400 || error.response.status === 405)) {
      logger.test(`✅ Token endpoint reachable (returned ${error.response.status} as expected for HEAD request)`);
    } else {
      logger.test(`❌ Token endpoint test failed: ${error.message}`);
      if (error.response) {
        logger.test(`Response status: ${error.response.status}`);
      }
    }
  }
  
  try {
    // Test API base URL - but don't fail if it requires auth
    logger.test("Testing FHIR API endpoint accessibility...");
    logger.test(`API Base URL: ${API_BASE_URL}`);
    
    const apiResponse = await axios.get(`${API_BASE_URL}/metadata`, {
      timeout: 10000,
      headers: { 'Accept': 'application/fhir+json' }
    });
    logger.test(`✅ FHIR API endpoint accessible - Status: ${apiResponse.status}`);
    logger.debug("FHIR Capability Statement", {
      fhirVersion: apiResponse.data.fhirVersion,
      software: apiResponse.data.software?.name,
      implementationDescription: apiResponse.data.implementation?.description
    });
  } catch (error) {
    // Don't fail if it's just auth required (401)
    if (error.response && error.response.status === 401) {
      logger.test(`✅ FHIR API endpoint reachable (401 - authentication required as expected)`);
    } else {
      logger.test(`❌ FHIR API endpoint test failed: ${error.message}`);
      if (error.response) {
        logger.test(`Response status: ${error.response.status}`);
      }
      return false;
    }
  }
  
  return true;
}

/**
 * Test token generation
 */
async function testTokenGeneration() {
  logger.test("Testing token generation...");
  
  try {
    const token = await getHchbToken();
    logger.test(`✅ Token generation successful - Length: ${token.length} characters`);
    logger.test(`Token preview: ${token.substring(0, 20)}...${token.substring(token.length - 10)}`);
    return token;
  } catch (error) {
    logger.test(`❌ Token generation failed: ${error.message}`);
    return null;
  }
}

/**
 * Test API access with token
 */
async function testApiAccess(token) {
  if (!token) {
    logger.test("❌ Cannot test API access - no token provided");
    return false;
  }
  
  logger.test("Testing authenticated API access...");
  
  try {
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/fhir+json"
    };
    
    // Test simple Patient search
    logger.test("Testing Patient resource access...");
    const patientResponse = await axios.get(`${API_BASE_URL}/Patient`, {
      timeout: 30000,
      headers: headers,
      params: { "_count": "1" }
    });
    
    logger.test(`✅ Patient resource accessible - Status: ${patientResponse.status}`);
    logger.debug("Patient response", {
      total: patientResponse.data.total,
      entryCount: patientResponse.data.entry?.length || 0
    });
    
    // Test Appointment search
    logger.test("Testing Appointment resource access...");
    const appointmentResponse = await axios.get(`${API_BASE_URL}/Appointment`, {
      timeout: 30000,
      headers: headers,
      params: { "_count": "1" }
    });
    
    logger.test(`✅ Appointment resource accessible - Status: ${appointmentResponse.status}`);
    logger.debug("Appointment response", {
      total: appointmentResponse.data.total,
      entryCount: appointmentResponse.data.entry?.length || 0
    });
    
    return true;
  } catch (error) {
    logger.test(`❌ API access test failed: ${error.message}`);
    if (error.response) {
      logger.test(`Response status: ${error.response.status}`);
      logger.test(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  logger.test("🚀 Starting HCHB FHIR API Client Tests");
  logger.test("=".repeat(50));
  
  // Debug environment loading
  logger.test(`Current working directory: ${process.cwd()}`);
  logger.test(`Script location: ${__dirname}`);
  logger.test(`Environment file used: ${envFilePath || 'None found'}`);
  
  // Show current environment variables (safely)
  logger.test("Environment variables status:");
  logger.test(`  CLIENT_ID: ${process.env.CLIENT_ID ? '✅ SET' : '❌ NOT SET'}`);
  logger.test(`  RESOURCE_SECURITY_ID: ${process.env.RESOURCE_SECURITY_ID ? '✅ SET' : '❌ NOT SET'}`);
  logger.test(`  AGENCY_SECRET: ${process.env.AGENCY_SECRET ? '✅ SET' : '❌ NOT SET'}`);
  logger.test(`  TOKEN_URL: ${process.env.TOKEN_URL ? '✅ SET' : '❌ NOT SET'}`);
  logger.test(`  API_BASE_URL: ${process.env.API_BASE_URL ? '✅ SET' : '❌ NOT SET'}`);
  
  // Validate environment
  try {
    validateEnvironmentVariables();
    logger.test("✅ Environment variables validation passed");
  } catch (error) {
    logger.test(`❌ Environment validation failed: ${error.message}`);
    
    // Provide helpful debugging information
    logger.test("\n🔍 Debugging suggestions:");
    logger.test("1. Check if .env file exists in project root");
    logger.test("2. Verify .env file contains the required HCHB variables");
    logger.test("3. Ensure .env file is not in .gitignore if you expect it to be there");
    logger.test("4. Try running from project root directory");
    
    return false;
  }
  
  // Test connection
  const connectionOk = await testConnection();
  if (!connectionOk) {
    logger.test("❌ Connection tests failed - stopping here");
    return false;
  }
  
  // Test token generation
  const token = await testTokenGeneration();
  if (!token) {
    logger.test("❌ Token generation failed - stopping here");
    return false;
  }
  
  // Test API access
  const apiAccessOk = await testApiAccess(token);
  if (!apiAccessOk) {
    logger.test("❌ API access tests failed");
    return false;
  }
  
  logger.test("🎉 All tests passed successfully!");
  logger.test("=".repeat(50));
  
  // Optional: Test appointment retrieval
  const testAppointments = process.env.TEST_APPOINTMENT_RETRIEVAL === 'true';
  if (testAppointments) {
    logger.test("Testing appointment retrieval (this may take a while)...");
    try {
      const appointments = await getAppointments(token, "today");
      logger.test(`✅ Appointment retrieval test completed - Found ${appointments.length} appointments`);
    } catch (error) {
      logger.test(`❌ Appointment retrieval test failed: ${error.message}`);
    }
  }
  
  return true;
}

// Placeholder main function (simplified for testing)
async function main() {
  logger.info("Running HCHB FHIR sync...");
  try {
    const token = await getHchbToken();
    logger.info("Sync completed successfully");
  } catch (error) {
    logger.error("Sync failed", error);
  }
}

// Export functions for potential use as a module
module.exports = {
  getHchbToken,
  main,
  // Test functions
  testConnection,
  testTokenGeneration,
  testApiAccess,
  runAllTests
};

// Run if this is the main module
if (require.main === module) {
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--test') || args.includes('-t')) {
    // Run tests
    runAllTests().then(success => {
      process.exit(success ? 0 : 1);
    });
  } else if (args.includes('--debug-env') || args.includes('-d')) {
    // Debug environment loading
    console.log('🔍 Environment Debug Information:');
    console.log(`Current working directory: ${process.cwd()}`);
    console.log(`Script location: ${__dirname}`);
    console.log(`Environment file found: ${envFilePath || 'None'}`);
    console.log('\nSearching for .env files in:');
    
    const searchPaths = [
      process.env.ENV_FILE_PATH,
      findEnvFile(__dirname),
      path.join(process.cwd(), '.env'),
      path.join(__dirname, '../../../..', '.env'),
      path.join(__dirname, '../../..', '.env'),
      path.join(__dirname, '../..', '.env'),
      path.join(__dirname, '..', '.env'),
      path.join(__dirname, '.env')
    ].filter(Boolean);
    
    searchPaths.forEach(envPath => {
      try {
        require('fs').accessSync(envPath);
        console.log(`  ✅ ${envPath} (EXISTS)`);
      } catch {
        console.log(`  ❌ ${envPath} (NOT FOUND)`);
      }
    });
    
    console.log('\nEnvironment variables:');
    Object.keys(process.env)
      .filter(key => key.startsWith('HCHB_'))
      .forEach(key => {
        console.log(`  ${key}: ${process.env[key] ? 'SET' : 'NOT SET'}`);
      });
      
  } else if (args.includes('--test-token') || args.includes('-tt')) {
    // Test token generation only
    testTokenGeneration().then(token => {
      process.exit(token ? 0 : 1);
    });
  } else if (args.includes('--test-connection') || args.includes('-tc')) {
    // Test connection only
    testConnection().then(success => {
      process.exit(success ? 0 : 1);
    });
  } else if (args.includes('--help') || args.includes('-h')) {
    // Show help
    console.log(`
HCHB FHIR API Client

Usage:
  node HCHBservice.js                 Run the full appointment sync
  node HCHBservice.js --test          Run all tests
  node HCHBservice.js --debug-env     Debug environment variable loading
  node HCHBservice.js --test-token    Test token generation only
  node HCHBservice.js --test-connection Test endpoint connectivity only
  node HCHBservice.js --help          Show this help

Environment Variables:
  LOG_LEVEL                      Set to DEBUG for verbose logging
  TEST_APPOINTMENT_RETRIEVAL     Set to true to test appointment retrieval in tests
  ENV_FILE_PATH                  Specify custom path to .env file
  HCHB_CLIENT_ID                 Your HCHB client ID (required)
  HCHB_RESOURCE_SECURITY_ID      Your resource security ID (required)
  HCHB_AGENCY_SECRET             Your agency secret (required)
  HCHB_TOKEN_URL                 Token endpoint URL (required)
  HCHB_API_BASE_URL              FHIR API base URL (required)
    `);
  } else {
    // Run main function
    main();
  }
}

// Fetch all patients
async function getAllPatients(token, options = {}) {
  logger.info("Fetching all patients from HCHB API...");

  const { 
    batchSize = BATCH_SIZE,
    maxPatients = null,
    includeInactive = false
  } = options;

  const patients = [];
  let nextUrl = `${API_BASE_URL}/Patient`;
  const params = {
    _count: batchSize,
    _sort: 'family', // Sort by last name
  };

  if (!includeInactive) {
    params.active = 'true';
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/fhir+json"
  };

  try {
    while (nextUrl && (!maxPatients || patients.length < maxPatients)) {
      logger.debug(`Fetching patients from: ${nextUrl}`);

      const response = await axios.get(nextUrl, {
        timeout:  REQUEST_TIMEOUT,
        headers: headers,
        params: nextUrl === `${API_BASE_URL}/Patient` ? params : undefined
      });

      const bundle = response.data;

      if (bundle.entry && bundle.entry.length > 0) {
        const batchPatients = bundle.entry.map(entry => transformPatient(entry.resource));
        patients.push(...batchPatients);

        logger.info(`Fetched ${batchPatients.length} patients (total: ${patients.length})`);
      }

      // Find next page URL
      nextUrl = null;
      if (bundle.link) {
        const nextLink = bundle.link.find(link => link.relation === 'next');
        if (nextLink) {
          nextUrl = nextLink.url;
        }
      }

      //Rate Limiting
      await sleep(100)
    }

    logger.info(`Successfully fetched ${patients.length} patients total`)
    return patients;

  } catch (error) {
    logger.error(`Error fetching patinets: ${error.message}`, error);
    throw error;
  }
}

// Fetch Appointments
async function getAppointments(token, dateFilter = "today", options = {}) {
  logger.info(`Fetching appointments for: ${dateFilter}`);

  const {
    batchSize = BATCH_SIZE,
    maxAppointments = null, 
    status = null // 'booked', 'arrived', 'fulfilled', etc.
  } = options;

  const appointments = [];
  let nextUrl = `${API_BASE_URL}/Appointment`;

  const params = {
    _count: batchSize,
    _sort: 'date'
  };

  if (dateFilter === "today") {
    const today = new Date().toISOString().split('T')[0];
    params.date = `ge${today}&date=lt${getNextDat(today)}`;
  } else if (dateFilter === "week") {
    const startOfWeek = getStartOfWeek();
    const endOfWeek = getEndOfWeek();
    params.data = `ge${startOfWeek}&date=le${endOfWeek}`;
  } else if (dateFilter.includes('-')) {
    params.date = `ge${dateFilter}&date=lt${getNextDat(dateFilter)}`;
  }

  if (status) {
     params.status = status;
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/fhir+json"
  };

  try {
    while (nextUrl && (!maxAppointments || appointments.length < maxAppointments)) {
      logger.debug(`Fetching appointments from: ${nextUrl}`);

      const response = await axios.get(nextUrl, {
        timeout: REQUEST_TIMEOUT,
        headers: headers,
        params: nextUrl === `${API_BASE_URL}/Appointment` ? params : undefined
      });

      const bundle = response.data;

      if (bundle.entry && bundle.entry.length > 0) {
        const batchAppointments = bundle.entry.map(entry => transformAppointment(entry.resource));
        appointments.push(...batchAppointments);

        logger.info(`Fetched ${batchAppointments.length} appointments (total: ${appointments.length})`);
      }

      // Find next page URL
      nextUrl = null;
      if (bundle.link) {
        const nextLink = bundle.link.find(link => link.relation === 'next');
        if (nextLink) {
          nextUrl = nextLink.url;
        }
      }

      // Rate Limiting
      await sleep(100)
    }

    logger.info(`Successfully fetched ${appointments.length} appointments total`);
    return appointments;
  } catch (error) {
    logger.error(`Error fetching appointments: ${error.message}`, error);
    throw error;
  }
}

// Fetch Practitioners 
async function getAllPractitioners(token, options = {}) {
  logger.info("Fetching all practitioners from HCHB API...");

  const {
    batchSize = BATCH_SIZE,
    maxPractitioners = null,
    specialty = null,
  } = options;

const practitioners = [];
let nextUrl = `${API_BASE_URL}/Practitioner`;
const params = {
  _count: batchSize,
  _sort: 'family',
  active: 'true'
};

if (specialty) {
  params['qualification.code'] = specialty;
}

const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/fhir+json"
  };
  
  try {
    while (nextUrl && (!maxPractitioners || practitioners.length < maxPractitioners)) {
      logger.debug(`Fetching practitioners from: ${nextUrl}`);
      
      const response = await axios.get(nextUrl, {
        timeout: REQUEST_TIMEOUT,
        headers: headers,
        params: nextUrl === `${API_BASE_URL}/Practitioner` ? params : undefined
      });
      
      const bundle = response.data;
      
      if (bundle.entry && bundle.entry.length > 0) {
        const batchPractitioners = bundle.entry.map(entry => transformPractitioner(entry.resource));
        practitioners.push(...batchPractitioners);
        
        logger.info(`Fetched ${batchPractitioners.length} practitioners (total: ${practitioners.length})`);
      }
      
      // Find next page URL
      nextUrl = null;
      if (bundle.link) {
        const nextLink = bundle.link.find(link => link.relation === 'next');
        if (nextLink) {
          nextUrl = nextLink.url;
        }
      }
      
      // Rate limiting
      await sleep(100);
    }
    
    logger.info(`Successfully fetched ${practitioners.length} practitioners total`);
    return practitioners;
    
  } catch (error) {
    logger.error(`Error fetching practitioners: ${error.message}`, error);
    throw error;
  }
}

/**
 * Transform FHIR Patient to our internal format
 */
function transformPatient(fhirPatient) {
  return {
    id: fhirPatient.id,
    resourceType: 'Patient',
    name: formatHumanName(fhirPatient.name?.[0]),
    active: fhirPatient.active,
    gender: fhirPatient.gender,
    birthDate: fhirPatient.birthDate,
    address: fhirPatient.address?.[0] || null,
    telecom: fhirPatient.telecom || [],
    phoneNumber: getContactValue(fhirPatient.telecom, 'phone'),
    email: getContactValue(fhirPatient.telecom, 'email'),
    // Extract care needs from extensions if available
    careNeeds: extractCareNeeds(fhirPatient.extension),
    // Raw FHIR data for reference
    _raw: fhirPatient
  };
}

/**
 * Transform FHIR Appointment to our internal format
 */
function transformAppointment(fhirAppointment) {
  const participants = fhirAppointment.participant || [];
  
  return {
    id: fhirAppointment.id,
    resourceType: 'Appointment',
    status: fhirAppointment.status,
    start: fhirAppointment.start,
    end: fhirAppointment.end,
    serviceType: fhirAppointment.serviceType || [],
    participants: participants.map(p => ({
      actor: p.actor,
      status: p.status,
      type: p.type
    })),
    // Extract patient and practitioner references
    patientRef: participants.find(p => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference,
    practitionerRef: participants.find(p => p.actor?.reference?.startsWith('Practitioner/'))?.actor?.reference,
    patientId: participants.find(p => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference?.replace('Patient/', ''),
    practitionerId: participants.find(p => p.actor?.reference?.startsWith('Practitioner/'))?.actor?.reference?.replace('Practitioner/', ''),
    comment: fhirAppointment.comment,
    description: fhirAppointment.description,
    // Raw FHIR data for reference
    _raw: fhirAppointment
  };
}

/**
 * Transform FHIR Practitioner to our internal format
 */
function transformPractitioner(fhirPractitioner) {
  return {
    id: fhirPractitioner.id,
    resourceType: 'Practitioner',
    name: formatHumanName(fhirPractitioner.name?.[0]),
    active: fhirPractitioner.active,
    gender: fhirPractitioner.gender,
    birthDate: fhirPractitioner.birthDate,
    telecom: fhirPractitioner.telecom || [],
    phoneNumber: getContactValue(fhirPractitioner.telecom, 'phone'),
    email: getContactValue(fhirPractitioner.telecom, 'email'),
    qualification: fhirPractitioner.qualification || [],
    specialty: extractSpecialty(fhirPractitioner.qualification),
    // Raw FHIR data for reference
    _raw: fhirPractitioner
  };
}

/**
 * Save data to JSON files for development/debugging
 */
async function saveDataToFiles(data, dataType) {
  const outputDir = path.join(__dirname, '../../../data');
  
  // Create data directory if it doesn't exist
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${dataType}_${timestamp}.json`;
  const filepath = path.join(outputDir, filename);
  
  try {
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    logger.info(`Saved ${data.length} ${dataType} records to: ${filepath}`);
  } catch (error) {
    logger.error(`Error saving ${dataType} data to file: ${error.message}`, error);
  }
}

/**
 * Main data sync function - this is what actually pulls and processes data
 */
async function syncAllData() {
  logger.info("🔄 Starting complete data sync from HCHB...");
  
  try {
    // Get authentication token
    const token = await getHchbToken();
    
    // Fetch all data types
    logger.info("📋 Fetching patients...");
    const patients = await getAllPatients(token, { maxPatients: 100 }); // Limit for testing
    await saveDataToFiles(patients, 'patients');
    
    logger.info("👩‍⚕️ Fetching practitioners...");
    const practitioners = await getAllPractitioners(token, { maxPractitioners: 50 });
    await saveDataToFiles(practitioners, 'practitioners');
    
    logger.info("📅 Fetching appointments...");
    const appointments = await getAppointments(token, "week", { maxAppointments: 200 });
    await saveDataToFiles(appointments, 'appointments');
    
    // Summary
    logger.info("✅ Data sync completed successfully!");
    logger.info(`📊 Summary:`);
    logger.info(`   Patients: ${patients.length}`);
    logger.info(`   Practitioners: ${practitioners.length}`);
    logger.info(`   Appointments: ${appointments.length}`);
    
    return {
      patients,
      practitioners,
      appointments,
      summary: {
        patientCount: patients.length,
        practitionerCount: practitioners.length,
        appointmentCount: appointments.length,
        syncTime: new Date().toISOString()
      }
    };
    
  } catch (error) {
    logger.error("❌ Data sync failed", error);
    throw error;
  }
}

// Helper functions
function formatHumanName(name) {
  if (!name) return "";
  const parts = [];
  if (name.prefix) parts.push(name.prefix.join(" "));
  if (name.given) parts.push(name.given.join(" "));
  if (name.family) parts.push(name.family);
  return parts.filter(Boolean).join(" ");
}

function getContactValue(telecom, system) {
  if (!telecom || !telecom.length) return null;
  const contact = telecom.find(t => t.system === system);
  return contact?.value;
}

function extractCareNeeds(extensions) {
  // This would extract care needs from FHIR extensions if they exist
  // Implementation depends on how HCHB structures their extensions
  return [];
}

function extractSpecialty(qualifications) {
  if (!qualifications || !qualifications.length) return null;
  return qualifications[0]?.code?.text || qualifications[0]?.code?.coding?.[0]?.display;
}

function getNextDay(dateString) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function getStartOfWeek() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day;
  return new Date(today.setDate(diff)).toISOString().split('T')[0];
}

function getEndOfWeek() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + 6;
  return new Date(today.setDate(diff)).toISOString().split('T')[0];
}

// Export new functions
module.exports = {
  // ... existing exports
  getAllPatients,
  getAppointments,
  getAllPractitioners,
  syncAllData,
  transformPatient,
  transformAppointment,
  transformPractitioner
};

// Update the main module check
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--sync') || args.includes('-s')) {
    // Run full data sync
    syncAllData().then(result => {
      console.log("Data sync completed!");
      process.exit(0);
    }).catch(error => {
      console.error("Data sync failed:", error.message);
      process.exit(1);
    });
  } else if (args.includes('--patients') || args.includes('-p')) {
    // Sync patients only
    getHchbToken().then(token => 
      getAllPatients(token)
    ).then(patients => {
      console.log(`Fetched ${patients.length} patients`);
      saveDataToFiles(patients, 'patients');
      process.exit(0);
    }).catch(error => {
      console.error("Patient sync failed:", error.message);
      process.exit(1);
    });
  } else if (args.includes('--appointments') || args.includes('-a')) {
    // Sync appointments only
    getHchbToken().then(token => 
      getAppointments(token, "today")
    ).then(appointments => {
      console.log(`Fetched ${appointments.length} appointments`);
      saveDataToFiles(appointments, 'appointments');
      process.exit(0);
    }).catch(error => {
      console.error("Appointment sync failed:", error.message);
      process.exit(1);
    });
  }
  // ... keep existing test commands
}