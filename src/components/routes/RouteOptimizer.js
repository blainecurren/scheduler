import React, { useState, useEffect } from "react";
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
  const [nurseOptions, setNurseOptions] = useState([]);
  const [error, setError] = useState(null);

  // Fetch available nurses with routes for the selected date
  useEffect(() => {
    fetchAvailableNurses();
  }, [selectedDate]);

  const fetchAvailableNurses = async () => {
    try {
      console.log("Fetching nurses for date:", selectedDate);
      const response = await fetch(
        `http://localhost:3001/api/routing/nurses-with-routes/${selectedDate}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch nurses");
      }

      const data = await response.json();
      console.log("Nurses API response:", data);

      if (data.success && data.data.nurses) {
        const nurses = data.data.nurses.map((nurse) => ({
          id: nurse.nurseId,
          name: nurse.nurseName,
        }));
        console.log("Processed nurses:", nurses);
        setNurseOptions(nurses);
      }
    } catch (error) {
      console.error("Error fetching nurses:", error);
      setError("Failed to load available nurses");
    }
  };

  const handleNurseChange = (e) => {
    setSelectedNurse(e.target.value);
    setRoute(null); // Clear existing route when nurse changes
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setRoute(null); // Clear existing route when date changes
  };

  const handleRouteTypeChange = (e) => {
    setRouteType(e.target.value);
  };

  const handleGenerateRoute = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!selectedNurse) {
        setError("Please select a nurse");
        return;
      }

      console.log(
        "Generating route for nurse:",
        selectedNurse,
        "on date:",
        selectedDate
      );

      // Call the actual API endpoint
      const response = await fetch(
        "http://localhost:3001/api/routing/optimize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nurseIds: [selectedNurse], // Note: optimize expects an array
            date: selectedDate,
          }),
        }
      );

      const data = await response.json();
      console.log("Route API response:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate route");
      }

      // Process the route data for display
      if (data.data && data.data.routes && data.data.routes.length > 0) {
        const routeData = data.data.routes[0]; // Get the first (and only) route
        console.log("Route data:", routeData);

        if (routeData.leafletData) {
          // Format the route for MapView component
          const formattedRoute = {
            nurseInfo: routeData.nurseInfo,
            markers: routeData.leafletData.markers,
            polylines: routeData.leafletData.polylines,
            summary: routeData.summary,
            appointments: routeData.optimizedOrder,
          };

          setRoute(formattedRoute);
          console.log("Formatted route set:", formattedRoute);
        }
      } else {
        throw new Error("No route data returned");
      }
    } catch (error) {
      console.error("Error generating route:", error);
      setError(error.message || "Failed to generate route");
    } finally {
      setLoading(false);
    }
  };

  // Generate all nurses' routes for the selected date
  const handleGenerateAllRoutes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all nurse IDs
      const nurseIds = nurseOptions.map((nurse) => nurse.id);

      if (nurseIds.length === 0) {
        setError("No nurses available for routing");
        return;
      }

      // Call the API endpoint for multiple nurses
      const response = await fetch(
        "http://localhost:3001/api/routing/optimize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nurseIds: nurseIds,
            date: selectedDate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate routes");
      }

      // For multiple routes, we'd need to update the display logic
      // For now, show a success message
      if (data.data && data.data.routes) {
        setError(
          `Successfully generated routes for ${data.data.successfulRoutes} nurses`
        );
        // You could extend this to show all routes on the map
      }
    } catch (error) {
      console.error("Error generating routes:", error);
      setError(error.message || "Failed to generate routes");
    } finally {
      setLoading(false);
    }
  };

  // Extract locations for map display
  const getNurseLocations = () => {
    if (!route || !route.markers) return [];

    const nurseMarker = route.markers.find((m) => m.type === "nurse");
    if (!nurseMarker) return [];

    return [
      {
        id: nurseMarker.id,
        name: route.nurseInfo.name,
        title: "RN",
        address: route.nurseInfo.address,
        location: {
          lat: nurseMarker.position[0],
          lng: nurseMarker.position[1],
        },
      },
    ];
  };

  const getPatientLocations = () => {
    if (!route || !route.markers) return [];

    return route.markers
      .filter((m) => m.type === "patient")
      .map((marker) => ({
        id: marker.id,
        name: marker.popup.title,
        appointmentTime: new Date(
          marker.popup.scheduledTime
        ).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        address: marker.popup.address,
        location: {
          lat: marker.position[0],
          lng: marker.position[1],
        },
        visitOrder: marker.visitOrder,
      }));
  };

  const getRoutePolylines = () => {
    if (!route || !route.polylines) return [];

    return route.polylines.map((polyline) => ({
      points: polyline.points.map((point) => ({
        lat: point[0],
        lng: point[1],
      })),
      color: polyline.color || "#0078d4",
    }));
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
            <option value="">Select a Nurse</option>
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

        <button
          className="generate-button"
          onClick={handleGenerateRoute}
          disabled={loading || !selectedNurse}
        >
          {loading ? "Generating..." : "Generate Route"}
        </button>

        <button
          className="generate-button"
          onClick={handleGenerateAllRoutes}
          disabled={loading}
          style={{ marginLeft: "10px" }}
        >
          {loading ? "Generating..." : "Generate All Routes"}
        </button>
      </div>

      {error && (
        <div
          className="error-message"
          style={{
            padding: "10px",
            margin: "10px 0",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            color: "#c00",
          }}
        >
          {error}
        </div>
      )}

      <div className="map-wrapper">
        <MapView
          nurseLocations={getNurseLocations()}
          patientLocations={getPatientLocations()}
          routes={getRoutePolylines()}
        />

        {route && route.summary && (
          <div className="route-info">
            <h4>Route Information</h4>
            <div className="route-info-item">
              <span className="route-info-label">Distance:</span>
              <span className="route-info-value">
                {route.summary.totalDistanceMiles.toFixed(1)} miles
              </span>
            </div>
            <div className="route-info-item">
              <span className="route-info-label">Time:</span>
              <span className="route-info-value">
                {route.summary.totalTimeFormatted}
              </span>
            </div>
            <div className="route-info-item">
              <span className="route-info-label">Visits:</span>
              <span className="route-info-value">{route.summary.visits}</span>
            </div>
            <div className="route-info-item">
              <span className="route-info-label">Fuel Cost:</span>
              <span className="route-info-value">
                ${route.summary.estimatedFuelCost.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteOptimizer;
