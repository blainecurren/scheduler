/**
 * GraphHopper configuration and client setup
 */

// Import axios for HTTP requests
import axios from 'axios';

// GraphHopper API configuration
const graphhopperConfig = {
  baseUrl: process.env.REACT_APP_GRAPHHOPPER_URL || 'http://localhost:8080', // Default to local Docker container
  apiKey: process.env.REACT_APP_GRAPHHOPPER_API_KEY || '',
};

/**
 * GraphHopper client for route optimization
 */
const GraphhopperClient = {
  /**
   * Optimize routes based on multiple locations
   * @param {Array} locations - Array of location objects with coordinates
   * @param {Array} vehicles - Array of vehicle objects with start/end locations
   * @returns {Promise<Object>} Optimized route plan
   */
  optimizeRoute: async (locations, vehicles) => {
    try {
      const response = await axios.post(`${graphhopperConfig.baseUrl}/optimize`, {
        vehicles,
        services: locations.map(location => ({
          id: location.id,
          address: {
            location_id: location.id,
            lon: location.point.lng,
            lat: location.point.lat
          }
        })),
        algorithm: {
          problem_type: "min-max",
          objective: "transport_time"
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(graphhopperConfig.apiKey ? { 'Authorization': `Bearer ${graphhopperConfig.apiKey}` } : {})
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error optimizing route:', error);
      throw error;
    }
  },
  
  /**
   * Get detailed route between two points
   * @param {Object} origin - Origin coordinates {lat, lng}
   * @param {Object} destination - Destination coordinates {lat, lng}
   * @returns {Promise<Object>} Detailed route information
   */
  getRoute: async (origin, destination) => {
    try {
      const response = await axios.get(`${graphhopperConfig.baseUrl}/route`, {
        params: {
          point: [`${origin.lat},${origin.lng}`, `${destination.lat},${destination.lng}`],
          vehicle: 'car',
          points_encoded: false,
          instructions: true,
          ...(graphhopperConfig.apiKey ? { key: graphhopperConfig.apiKey } : {})
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting route:', error);
      throw error;
    }
  },

  /**
   * Get detailed routes for multiple waypoints
   * @param {Array<Object>} points - Array of points {lat, lng}
   * @returns {Promise<Object>} Detailed route information
   */
  getRouteWithWaypoints: async (points) => {
    try {
      const pointParams = points.map(p => `${p.lat},${p.lng}`);
      
      const response = await axios.get(`${graphhopperConfig.baseUrl}/route`, {
        params: {
          point: pointParams,
          vehicle: 'car',
          points_encoded: false,
          instructions: true,
          ...(graphhopperConfig.apiKey ? { key: graphhopperConfig.apiKey } : {})
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting route with waypoints:', error);
      throw error;
    }
  }
};

// Export the client
export const graphhopperClient = GraphhopperClient;

// Export configuration for use elsewhere
export default graphhopperConfig;