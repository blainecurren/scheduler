// graphql/src/debug-fhir-response.js
// Debug script to examine the actual FHIR response structure

require("dotenv").config();
const { getToken } = require("./datasources/fhir/service");
const axios = require("axios");

async function debugFHIRResponse() {
  console.log("=== STEP 2: Debugging FHIR Response Structure ===\n");

  try {
    // Get authentication token
    console.log("1. Getting authentication token...");
    const token = await getToken();
    console.log("   ✓ Token obtained successfully\n");

    // Make a direct request to see the response structure
    console.log("2. Making direct FHIR request to /Practitioner...");
    const apiUrl = process.env.API_BASE_URL || "https://api.hchb.com/fhir/r4";
    
    const response = await axios.get(`${apiUrl}/Practitioner`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      },
      params: {
        _count: 5,  // Just get a few for debugging
        _sort: 'family',
        active: 'true'
      }
    });

    console.log("   ✓ Request successful\n");

    // Examine the response structure
    console.log("3. Response structure:");
    console.log("   Response status:", response.status);
    console.log("   Response data type:", typeof response.data);
    console.log("   Response data keys:", Object.keys(response.data));
    
    // Check resourceType
    if (response.data.resourceType) {
      console.log("   Resource type:", response.data.resourceType);
    }

    // Check for entries
    if (response.data.entry) {
      console.log("\n4. Entry structure:");
      console.log("   Number of entries:", response.data.entry.length);
      if (response.data.entry.length > 0) {
        console.log("   First entry keys:", Object.keys(response.data.entry[0]));
        console.log("   First entry resource type:", response.data.entry[0].resource?.resourceType);
      }
    }

    // Check for links
    console.log("\n5. Link structure:");
    console.log("   Type of response.data.link:", typeof response.data.link);
    console.log("   Is link an array?", Array.isArray(response.data.link));
    
    if (response.data.link) {
      console.log("   Link value:", JSON.stringify(response.data.link, null, 2));
    } else {
      console.log("   No link property found");
    }

    // Check for next page
    console.log("\n6. Pagination:");
    if (response.data.link && Array.isArray(response.data.link)) {
      const nextLink = response.data.link.find(l => l.relation === 'next');
      console.log("   Next link found:", nextLink ? 'Yes' : 'No');
      if (nextLink) {
        console.log("   Next URL:", nextLink.url);
      }
    } else if (response.data.link) {
      console.log("   Link structure is not an array. Full link object:");
      console.log(JSON.stringify(response.data.link, null, 2));
    }

    // Show a sample practitioner
    if (response.data.entry && response.data.entry.length > 0) {
      console.log("\n7. Sample Practitioner:");
      console.log(JSON.stringify(response.data.entry[0].resource, null, 2));
    }

    // Save full response for analysis
    const fs = require('fs').promises;
    const debugFile = 'debug-practitioner-response.json';
    await fs.writeFile(debugFile, JSON.stringify(response.data, null, 2));
    console.log(`\n✓ Full response saved to ${debugFile}`);

  } catch (error) {
    console.error("\n✗ Error during debugging:");
    console.error("  Message:", error.message);
    
    if (error.response) {
      console.error("  Response status:", error.response.status);
      console.error("  Response data:", error.response.data);
    }
    
    console.error("\n  Stack trace:", error.stack);
  }
}

// Run the debug script
debugFHIRResponse().catch(console.error);