import React, { useState } from 'react';
import MapView from '../maps/MapView';
import { getOptimizedRoute, formatRouteForMap } from '../../services/routing/graphhopperService';
import './RouteOptimizer.css';

const RouteOptimizer = () => {
  const [selectedNurse, setSelectedNurse] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [routeType, setRouteType] = useState('optimized');
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(null);
  
  // Dummy data - would be fetched from API in a real implementation
  const nurseOptions = [
    { id: 'nurse1', name: 'Jane Smith' },
    { id: 'nurse2', name: 'John Doe' },
    { id: 'nurse3', name: 'Sarah Johnson' },
  ];

  // Example dummy data for map demonstration
  const sampleNurseLocations = [
    {
      id: 'nurse1',
      name: 'Jane Smith',
      title: 'RN',
      address: '123 Main St, Austin, TX',
      location: { lat: 30.2672, lng: -97.7431 }
    }
  ];

  const samplePatientLocations = [
    {
      id: 'patient1',
      name: 'Bob Johnson',
      appointmentTime: '09:00 AM',
      address: '456 Oak St, Austin, TX',
      location: { lat: 30.2747, lng: -97.7404 }
    },
    {
      id: 'patient2',
      name: 'Sarah Miller',
      appointmentTime: '10:30 AM',
      address: '789 Pine St, Austin, TX',
      location: { lat: 30.2843, lng: -97.7466 }
    },
    {
      id: 'patient3',
      name: 'David Wilson',
      appointmentTime: '01:15 PM',
      address: '101 Maple Ave, Austin, TX',
      location: { lat: 30.2922, lng: -97.7398 }
    }
  ];

  const handleNurseChange = (e) => {
    setSelectedNurse(e.target.value);
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleRouteTypeChange = (e) => {
    setRouteType(e.target.value);
  };

  const handleGenerateRoute = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, we would call the GraphHopper API
      // For now, we'll simulate a response with a timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Example route points for demonstration
      const sampleRoute = {
        paths: [{
          distance: 15000,
          time: 1800000,
          points: "sample_encoded_polyline"
        }]
      };
      
      const formattedRoute = formatRouteForMap(sampleRoute);
      setRoute(formattedRoute);
    } catch (error) {
      console.error('Error generating route:', error);
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="route-optimizer">
      <div className="route-controls">
        <div className="filter-group">
          <label htmlFor="nurseSelector">Nurse:</label>
          <select 
            id="nurseSelector" 
            value={selectedNurse} 
            onChange={handleNurseChange}
            className="control-select"
          >
            <option value="">All Nurses</option>
            {nurseOptions.map(nurse => (
              <option key={nurse.id} value={nurse.id}>
                {nurse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="dateSelector">Date:</label>
          <input 
            type="date" 
            id="dateSelector" 
            value={selectedDate} 
            onChange={handleDateChange}
            className="control-date"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="routeTypeSelector">Route Type:</label>
          <select 
            id="routeTypeSelector" 
            value={routeType} 
            onChange={handleRouteTypeChange}
            className="control-select"
          >
            <option value="fastest">Fastest</option>
            <option value="shortest">Shortest</option>
            <option value="optimized">Optimized</option>
          </select>
        </div>

        <button 
          className="generate-button"
          onClick={handleGenerateRoute}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Route'}
        </button>
      </div>

      <div className="map-wrapper">
        <MapView
          nurseLocations={sampleNurseLocations}
          patientLocations={samplePatientLocations}
          routes={route ? [route] : []}
        />
        
        {route && (
          <div className="route-info">
            <h4>Route Information</h4>
            <div className="route-info-item">
              <span className="route-info-label">Distance:</span>
              <span className="route-info-value">
                {(route.distance / 1000).toFixed(1)} km
              </span>
            </div>
            <div className="route-info-item">
              <span className="route-info-label">Time:</span>
              <span className="route-info-value">
                {Math.floor(route.time / 3600000)}h {Math.floor((route.time % 3600000) / 60000)}m
              </span>
            </div>
            <div className="route-info-item">
              <span className="route-info-label">Patients:</span>
              <span className="route-info-value">{samplePatientLocations.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteOptimizer;