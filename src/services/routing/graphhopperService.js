/**
 * Service for interacting with GraphHopper routing engine
 */

import { graphhopperClient } from '../../config/graphhopper';

/**
 * Get a route between two points
 * @param {Object} start - Starting coordinates {lat, lng}
 * @param {Object} end - Destination coordinates {lat, lng}
 * @returns {Promise<Object>} Route information
 */
export const getRoute = async (start, end) => {
  try {
    const response = await graphhopperClient.getRoute(start, end);
    return response;
  } catch (error) {
    console.error('Error getting route:', error);
    throw error;
  }
};

/**
 * Calculate an optimized route for multiple points
 * @param {Object} start - Starting point {lat, lng}
 * @param {Array<Object>} waypoints - Array of waypoint objects {lat, lng, id}
 * @param {Object} end - Ending point {lat, lng}
 * @returns {Promise<Object>} Optimized route
 */
export const getOptimizedRoute = async (start, waypoints, end) => {
  try {
    // Convert to GraphHopper format
    const locations = [
      { id: 'start', point: start },
      ...waypoints.map(wp => ({ id: wp.id, point: wp })),
      { id: 'end', point: end },
    ];
    
    // Define vehicles (nurses) for the optimization
    const vehicles = [{
      vehicle_id: 'nurse',
      start_address: { location_id: 'start' },
      end_address: { location_id: 'end' },
    }];
    
    const response = await graphhopperClient.optimizeRoute(locations, vehicles);
    return response;
  } catch (error) {
    console.error('Error optimizing route:', error);
    throw error;
  }
};

/**
 * Convert GraphHopper route response to a format usable by the Map component
 * @param {Object} route - GraphHopper route response
 * @returns {Object} Formatted route data
 */
export const formatRouteForMap = (route) => {
  if (!route || !route.paths || !route.paths[0] || !route.paths[0].points) {
    return { points: [] };
  }
  
  // The points will be in encoded polyline format, 
  // but in a real implementation we'd decode this
  // For now, we'll return a dummy route
  const points = [
    // Example points - in a real implementation, this would come from GraphHopper
    { lat: 30.2672, lng: -97.7431 }, // Austin
    { lat: 30.2747, lng: -97.7404 }, // Waypoint 1
    { lat: 30.2843, lng: -97.7466 }, // Waypoint 2
    { lat: 30.2672, lng: -97.7431 }, // Back to start
  ];
  
  return {
    points,
    distance: route.paths?.[0]?.distance || 0,
    time: route.paths?.[0]?.time || 0,
    instructions: route.paths?.[0]?.instructions || [],
  };
};

/**
 * Get estimated travel time and distance between two points
 * @param {Object} start - Starting coordinates {lat, lng}
 * @param {Object} end - Destination coordinates {lat, lng}
 * @returns {Promise<Object>} Distance and time information
 */
export const getTravelEstimate = async (start, end) => {
  try {
    const route = await getRoute(start, end);
    
    return {
      distanceInMeters: route.paths?.[0]?.distance || 0,
      timeInSeconds: route.paths?.[0]?.time || 0,
    };
  } catch (error) {
    console.error('Error getting travel estimate:', error);
    throw error;
  }
};