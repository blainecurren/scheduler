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
const CLIENT_ID = process.env.HCHB_CLIENT_ID;
const RESOURCE_SECURITY_ID = process.env.HCHB_RESOURCE_SECURITY_ID;
const AGENCY_SECRET = process.env.HCHB_AGENCY_SECRET;
const TOKEN_URL = process.env.HCHB_TOKEN_URL;
const API_BASE_URL = process.env.HCHB_API_BASE_URL;
const REQUEST_TIMEOUT = parseInt(process.env.HCHB_REQUEST_TIMEOUT) || 60000;
const BATCH_SIZE = parseInt(process.env.HCHB_BATCH_SIZE) || 100;
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.HCHB_MAX_CONCURRENT_REQUESTS) || 10;

// Validate required environment variables
function validateEnvironmentVariables() {
  const requiredVars = [
    'HCHB_CLIENT_ID',
    'HCHB_RESOURCE_SECURITY_ID', 
    'HCHB_AGENCY_SECRET',
    'HCHB_TOKEN_URL',
    'HCHB_API_BASE_URL'
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
  logger.test(`  HCHB_CLIENT_ID: ${process.env.HCHB_CLIENT_ID ? '✅ SET' : '❌ NOT SET'}`);
  logger.test(`  HCHB_RESOURCE_SECURITY_ID: ${process.env.HCHB_RESOURCE_SECURITY_ID ? '✅ SET' : '❌ NOT SET'}`);
  logger.test(`  HCHB_AGENCY_SECRET: ${process.env.HCHB_AGENCY_SECRET ? '✅ SET' : '❌ NOT SET'}`);
  logger.test(`  HCHB_TOKEN_URL: ${process.env.HCHB_TOKEN_URL ? '✅ SET' : '❌ NOT SET'}`);
  logger.test(`  HCHB_API_BASE_URL: ${process.env.HCHB_API_BASE_URL ? '✅ SET' : '❌ NOT SET'}`);
  
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