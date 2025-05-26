const HCHB_CONFIG = {
  CLIENT_ID,
  RESOURCE_SECURITY_ID,
  AGENCY_SECRET,
  TOKEN_URL,
  API_BASE_URL,
  REQUEST_TIMEOUT: 60000,
};

// Token Storage
let cachedToken = null;
let tokenExpiry = null;

// Get BEARER Token
export const getBearerToken = async () => {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    console.log("Using cached token");
    return cachedToken;
  }

  console.log("Requesting new HCHB API token");

  const formData = new URLSearchParams({
    grant_type: "agency_auth",
    client_id: HCHB_CONFIGCLIENT_ID,
    resource_security_id: HCHB_CONFIG.RESOURCE_SECURITY_ID,
    agency_secret: HCHB_CONFIG.AGENCY_SECRET,
  });

  try {
    const response = await fetch(HCHB_CONFIG.TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(HCHB_CONFIG.REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(
        `Token request failed: ${response.status} - ${errorText}`
      );
    }

    const tokenData = await response.json();

    // Cache the token
    cachedToken = tokenData.access_token;

    // Set token expiry (default to 55 minutes if not provided)
    const expiresIn = tokenData.expires_in || 3300; // 55 minutes in seconds
    tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    console.log("Successfully retrieved HCHB API token");
    console.log("Token expires at: ${tokenExpiry.toISOString()}");

    return cachedToken;
  } catch (error) {
    console.error("Error retrieving HCHB API token:", error);
    throw error;
  }
};

// Clear cached token (useful for forcing re-authentication)
export const clearCachedToken = async () => {
  const token = await getBearerToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/fhir+json",
  };
};

// Export config for use in other modules
export { HCHB_CONFIG };

// Test function to verify authentication works
export const testAuthentication = async () => {
  try {
    console.log("Testing HCHB API authentication...");
    const token = await getBearerToken();
    console.log("Authentication successful");
    console.log(`Token length: ${token.length} characters`);
    return true;
  } catch (error) {
    console.error("Authentication test failed:", error);
    return false;
  }
};
