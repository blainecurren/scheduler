/**
 * Service for handling Azure Maps geocoding operations
 */

import { azureMapsClient } from '../../config/azure-maps';

/**
 * Forward geocode an address to get coordinates
 * @param {string} address - Full address to geocode
 * @returns {Promise<Object>} Location coordinates and metadata
 */
export const geocodeAddress = async (address) => {
  try {
    const response = await azureMapsClient.searchAddress({
      query: address,
      limit: 1, // Only need the top result
    });
    
    if (response.results && response.results.length > 0) {
      const topResult = response.results[0];
      return {
        address: topResult.address,
        position: topResult.position,
        score: topResult.score,
        // Include other relevant data
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    throw error;
  }
};

/**
 * Batch geocode multiple addresses
 * @param {Array<string>} addresses - Array of addresses to geocode
 * @returns {Promise<Array<Object>>} Array of geocoded locations
 */
export const batchGeocodeAddresses = async (addresses) => {
  try {
    // Process in batches if needed to avoid rate limits
    const geocodingPromises = addresses.map(address => geocodeAddress(address));
    const results = await Promise.all(geocodingPromises);
    
    return results.filter(result => result !== null);
  } catch (error) {
    console.error('Error batch geocoding addresses:', error);
    throw error;
  }
};

/**
 * Get driving distance and time between two points
 * @param {Object} origin - Origin coordinates {lat, lon}
 * @param {Object} destination - Destination coordinates {lat, lon}
 * @returns {Promise<Object>} Distance and time information
 */
export const getRouteInfo = async (origin, destination) => {
  try {
    const response = await azureMapsClient.getRoute({
      origin: `${origin.lat},${origin.lon}`,
      destination: `${destination.lat},${destination.lon}`,
      travelMode: 'car',
    });
    
    if (response.routes && response.routes.length > 0) {
      const route = response.routes[0];
      return {
        distanceInMeters: route.lengthInMeters,
        travelTimeInSeconds: route.travelTimeInSeconds,
        // Include other relevant data
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting route information:', error);
    throw error;
  }
};