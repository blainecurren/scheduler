/**
 * Service for handling FHIR API interactions for nurse resources
 */

import { fhirClient } from '../../config/fhir-api';

/**
 * Fetch all nurses from FHIR server
 * @returns {Promise<Array>} Array of nurse resources
 */
export const fetchNurses = async () => {
  try {
    // FHIR search for Practitioner resources representing nurses
    const response = await fhirClient.search({
      resourceType: 'Practitioner',
      searchParams: {
        // Filter for nurses - specific query parameters would depend on your FHIR implementation
        _tag: 'nurse'
      }
    });
    
    return response.entry?.map(entry => entry.resource) || [];
  } catch (error) {
    console.error('Error fetching nurses:', error);
    throw error;
  }
};

/**
 * Fetch a specific nurse by ID
 * @param {string} id - The FHIR resource ID
 * @returns {Promise<Object>} Nurse resource
 */
export const fetchNurseById = async (id) => {
  try {
    const nurse = await fhirClient.read({
      resourceType: 'Practitioner',
      id
    });
    
    return nurse;
  } catch (error) {
    console.error(`Error fetching nurse with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Get the current location/address for a nurse
 * @param {string} id - The nurse's FHIR resource ID
 * @returns {Promise<Object>} Location information for the nurse
 */
export const getNurseLocation = async (id) => {
  try {
    // This will depend on how your FHIR system stores nurse locations
    // Could be via Location resources linked to the nurse or PractitionerRole
    const location = await fhirClient.search({
      resourceType: 'Location',
      searchParams: {
        'practitioner': id,
        'status': 'active'
      }
    });
    
    return location.entry?.[0]?.resource || null;
  } catch (error) {
    console.error(`Error fetching location for nurse ${id}:`, error);
    throw error;
  }
};