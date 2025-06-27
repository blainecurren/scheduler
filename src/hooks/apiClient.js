// src/hooks/apiClient.js
import { useState, useCallback, useMemo, useRef } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class APIClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.requestCache = new Map(); // Simple cache to prevent duplicate requests
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    
    // Check if we're already making this request
    if (this.requestCache.has(cacheKey)) {
      return this.requestCache.get(cacheKey);
    }
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const requestPromise = fetch(url, config)
      .then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .finally(() => {
        // Remove from cache after request completes
        this.requestCache.delete(cacheKey);
      });

    // Cache the promise to prevent duplicate requests
    this.requestCache.set(cacheKey, requestPromise);
    
    return requestPromise;
  }

  async getHealth() {
    return this.request('/health');
  }

  async getFilterOptions() {
    return this.request('/api/appointments/options');
  }

  async getAppointments(filters = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          params.set(key, value.join(','));
        } else {
          params.set(key, value);
        }
      }
    });
    
    const queryString = params.toString();
    const endpoint = `/api/appointments/filter${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async getMappableAppointments(filters = {}) {
    const params = new URLSearchParams();
    
    if (!filters.date) {
      filters.date = new Date().toISOString().split('T')[0];
    }
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          params.set(key, value.join(','));
        } else {
          params.set(key, value);
        }
      }
    });
    
    const queryString = params.toString();
    const endpoint = `/api/appointments/mappable${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async getCalendarData(filters = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          params.set(key, value.join(','));
        } else {
          params.set(key, value);
        }
      }
    });
    
    const queryString = params.toString();
    const endpoint = `/api/appointments/calendar${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async getStats() {
    return this.request('/api/appointments/stats');
  }

  async triggerSync() {
    return this.request('/api/appointments/sync', {
      method: 'POST'
    });
  }

  async getSyncStatus() {
    return this.request('/api/appointments/sync-status');
  }
}

// Create singleton instance
const apiClient = new APIClient();

function useAPIClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const activeRequests = useRef(new Set());

  const execute = useCallback(async (apiMethod, ...args) => {
    const requestKey = `${apiMethod.name}-${JSON.stringify(args)}`;
    
    // Prevent duplicate requests
    if (activeRequests.current.has(requestKey)) {
      console.log(`⏳ Request already in progress: ${requestKey}`);
      return;
    }
    
    activeRequests.current.add(requestKey);
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiMethod.apply(apiClient, args);
      return result;
    } catch (err) {
      setError(err.message);
      console.error('API Error:', err);
      throw err;
    } finally {
      activeRequests.current.delete(requestKey);
      setLoading(false);
    }
  }, []);

  // Memoize the API functions with stable references
  const memoizedFunctions = useMemo(() => ({
    getHealth: (...args) => execute(apiClient.getHealth, ...args),
    getFilterOptions: (...args) => execute(apiClient.getFilterOptions, ...args),
    getAppointments: (...args) => execute(apiClient.getAppointments, ...args),
    getMappableAppointments: (...args) => execute(apiClient.getMappableAppointments, ...args),
    getCalendarData: (...args) => execute(apiClient.getCalendarData, ...args),
    getStats: (...args) => execute(apiClient.getStats, ...args),
    triggerSync: (...args) => execute(apiClient.triggerSync, ...args),
    getSyncStatus: (...args) => execute(apiClient.getSyncStatus, ...args),
  }), [execute]);

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    error,
    clearError,
    client: apiClient,
    ...memoizedFunctions
  };
}

export default useAPIClient;