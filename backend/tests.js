// backend/test/service-codes-test.js
// Test script to analyze all service codes from HCHB

const axios = require('axios');
require('dotenv').config();

// ===================
// CONFIGURATION
// ===================

const CONFIG = {
  clientId: process.env.HCHB_CLIENT_ID,
  resourceSecurityId: process.env.HCHB_RESOURCE_SECURITY_ID,
  agencySecret: process.env.HCHB_AGENCY_SECRET,
  tokenUrl: process.env.HCHB_TOKEN_URL,
  apiBaseUrl: process.env.HCHB_API_BASE_URL,
  timeout: 60000,
};

let tokenCache = null;

// ===================
// AUTHENTICATION
// ===================

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
// DATA FETCHING
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

async function fetchAllServiceCodes() {
  console.log('📊 Analyzing all service codes from HCHB appointments...');
  
  const token = await getAuthToken();
  let url = `${CONFIG.apiBaseUrl}/Appointment?_count=100`; // Get more for analysis
  
  const serviceCodes = new Map();
  const serviceTypes = new Map();
  let totalAppointments = 0;
  let pageCount = 0;
  
  while (url && pageCount < 10) { // Limit to 10 pages for analysis
    try {
      console.log(`📄 Fetching page ${pageCount + 1}...`);
      const bundle = await fetchAppointmentPage(url, token);
      pageCount++;
      
      if (bundle.entry) {
        const appointments = bundle.entry.filter(entry => entry.resource.resourceType === 'Appointment');
        totalAppointments += appointments.length;
        
        // Debug output for first page
        if (pageCount === 1 && appointments.length > 0) {
          console.log(`🔍 DEBUG: Sample appointment structure from first page:`);
          const sampleApt = appointments[0].resource;
          console.log(`  - Appointment ID: ${sampleApt.id}`);
          console.log(`  - Keys: ${Object.keys(sampleApt)}`);
          console.log(`  - serviceType: ${JSON.stringify(sampleApt.serviceType, null, 2)}`);
          console.log(`  - appointmentType: ${JSON.stringify(sampleApt.appointmentType, null, 2)}`);
          console.log(`  - status: ${sampleApt.status}`);
          console.log('');
        }
        
        appointments.forEach(entry => {
          const apt = entry.resource;
          
          // HCHB serviceType is an ARRAY of objects
          if (apt.serviceType && Array.isArray(apt.serviceType) && apt.serviceType.length > 0) {
            apt.serviceType.forEach(st => {
              // Check for coding structure
              if (st.coding && Array.isArray(st.coding) && st.coding.length > 0) {
                st.coding.forEach(coding => {
                  const code = coding.code;
                  const display = coding.display;
                  const system = coding.system;
                  
                  if (code && display) {
                    // Count service codes
                    const key = `${code}|${display}`;
                    serviceCodes.set(key, (serviceCodes.get(key) || 0) + 1);
                  }
                });
              }
              
              // Also track text-only service types
              if (st.text) {
                serviceTypes.set(st.text, (serviceTypes.get(st.text) || 0) + 1);
              }
            });
          }
          
          // Also check appointmentType for additional codes
          if (apt.appointmentType && apt.appointmentType.coding && Array.isArray(apt.appointmentType.coding)) {
            apt.appointmentType.coding.forEach(coding => {
              const code = coding.code;
              const display = coding.display || 'No Display';
              
              if (code) {
                const key = `${code}|${display} (AppointmentType)`;
                serviceCodes.set(key, (serviceCodes.get(key) || 0) + 1);
              }
            });
          }
        });
      }
      
      // Find next page
      const nextLink = bundle.link?.find(link => link.relation === 'next');
      url = nextLink?.url || null;
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ Error fetching page ${pageCount + 1}:`, error.message);
      break;
    }
  }
  
  return { serviceCodes, serviceTypes, totalAppointments, pageCount };
}

// ===================
// ANALYSIS & REPORTING
// ===================

function analyzeServiceCodes(serviceCodes, serviceTypes, totalAppointments, pageCount) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SERVICE CODE ANALYSIS REPORT');
  console.log('='.repeat(60));
  
  console.log(`📈 Analysis Summary:`);
  console.log(`   Total appointments analyzed: ${totalAppointments}`);
  console.log(`   Pages fetched: ${pageCount}`);
  console.log(`   Unique service codes found: ${serviceCodes.size}`);
  console.log(`   Unique service types (text) found: ${serviceTypes.size}`);
  
  // Top service codes by frequency
  console.log('\n🔝 TOP 20 SERVICE CODES BY FREQUENCY:');
  console.log('-'.repeat(80));
  console.log('COUNT | CODE     | DESCRIPTION');
  console.log('-'.repeat(80));
  
  const sortedCodes = Array.from(serviceCodes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  sortedCodes.forEach(([key, count]) => {
    const [code, display] = key.split('|');
    console.log(`${count.toString().padStart(5)} | ${code.padEnd(8)} | ${display}`);
  });
  
  // All unique service codes (for reference)
  console.log('\n📋 ALL UNIQUE SERVICE CODES:');
  console.log('-'.repeat(50));
  
  const allCodes = Array.from(serviceCodes.keys())
    .map(key => key.split('|'))
    .sort((a, b) => a[0].localeCompare(b[0]));
  
  allCodes.forEach(([code, display]) => {
    console.log(`${code} - ${display}`);
  });
  
  // Service types (text only)
  if (serviceTypes.size > 0) {
    console.log('\n📝 SERVICE TYPES (TEXT ONLY):');
    console.log('-'.repeat(50));
    
    const sortedTypes = Array.from(serviceTypes.entries())
      .sort((a, b) => b[1] - a[1]);
    
    sortedTypes.forEach(([text, count]) => {
      console.log(`${count.toString().padStart(3)} | ${text}`);
    });
  }
  
  // Export to JSON file
  const fs = require('fs');
  const path = require('path');
  
  const analysisData = {
    summary: {
      totalAppointments,
      pageCount,
      uniqueServiceCodes: serviceCodes.size,
      uniqueServiceTypes: serviceTypes.size,
      analysisDate: new Date().toISOString()
    },
    serviceCodes: Array.from(serviceCodes.entries()).map(([key, count]) => {
      const [code, display] = key.split('|');
      return { code, display, count };
    }).sort((a, b) => b.count - a.count),
    serviceTypes: Array.from(serviceTypes.entries()).map(([text, count]) => ({
      text, count
    })).sort((a, b) => b.count - a.count)
  };
  
  const outputPath = path.join(process.cwd(), 'service-codes-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(analysisData, null, 2));
  
  console.log(`\n💾 Full analysis saved to: ${outputPath}`);
  console.log('='.repeat(60));
}

// ===================
// MAIN FUNCTION
// ===================

async function runServiceCodeAnalysis() {
  console.log('🚀 Starting HCHB Service Code Analysis...');
  console.log('📊 This will analyze appointments to find all service codes\n');
  
  try {
    const { serviceCodes, serviceTypes, totalAppointments, pageCount } = await fetchAllServiceCodes();
    
    if (serviceCodes.size === 0) {
      console.log('❌ No service codes found in appointments');
      return;
    }
    
    analyzeServiceCodes(serviceCodes, serviceTypes, totalAppointments, pageCount);
    
    console.log('\n✅ Service code analysis completed successfully!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    console.error('Full error:', error);
  }
}

// ===================
// CLI EXECUTION
// ===================

if (require.main === module) {
  runServiceCodeAnalysis().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { runServiceCodeAnalysis };