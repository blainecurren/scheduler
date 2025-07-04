import React, { useState } from "react";
import MapView from "../maps/MapView";
import "./RouteOptimizer.css";

const RouteOptimizer = () => {
  const [selectedNurse, setSelectedNurse] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [routeType, setRouteType] = useState("optimized");
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(null);

  // Dummy data - would be fetched from API in a real implementation
  const nurseOptions = [
    { id: "nurse1", name: "Jane Smith" },
    { id: "nurse2", name: "John Doe" },
    { id: "nurse3", name: "Sarah Johnson" },
  ];

  // Example dummy data for map demonstration

  const sampleNurseLocations = [
    {
      id: "nurse1",
      name: "Jane Smith",
      title: "RN",
      address: "123 Main St, Dallas, TX",
      location: { lat: 32.7767, lng: -96.797 },
    },
  ];

  const samplePatientLocations = [
    {
      id: "patient1",
      name: "Bob Johnson",
      appointmentTime: "09:00 AM",
      address: "456 Oak St, Fort Worth, TX",
      location: { lat: 32.7555, lng: -97.3308 },
    },
    {
      id: "patient2",
      name: "Sarah Miller",
      appointmentTime: "10:30 AM",
      address: "789 Pine St, Arlington, TX",
      location: { lat: 32.7357, lng: -97.1081 },
    },
    {
      id: "patient3",
      name: "David Wilson",
      appointmentTime: "01:15 PM",
      address: "101 Maple Ave, Irving, TX",
      location: { lat: 32.814, lng: -96.9489 },
    },
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

      // In a real implementation, we would call an API
      // For now, we'll simulate a response with a timeout
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Example route for demonstration
      const sampleRoute = {
        points: [
          { lat: 32.7767, lng: -96.797 }, // Start (nurse location - Dallas)
          { lat: 32.7555, lng: -97.3308 }, // Patient 1 - Fort Worth
          { lat: 32.7357, lng: -97.1081 }, // Patient 2 - Arlington
          { lat: 32.814, lng: -96.9489 }, // Patient 3 - Irving
          { lat: 32.7767, lng: -96.797 }, // Back to start - Dallas
        ],
        distance: 15000, // 15 km in meters
        time: 1800000, // 30 minutes in milliseconds
      };
      setRoute(sampleRoute);
    } catch (error) {
      console.error("Error generating route:", error);
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
            {nurseOptions.map((nurse) => (
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
          {loading ? "Generating..." : "Generate Route"}
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
                {Math.floor(route.time / 3600000)}h{" "}
                {Math.floor((route.time % 3600000) / 60000)}m
              </span>
            </div>
            <div className="route-info-item">
              <span className="route-info-label">Patients:</span>
              <span className="route-info-value">
                {samplePatientLocations.length}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteOptimizer;
