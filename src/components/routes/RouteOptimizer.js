import React, { useState, useEffect } from "react";
import MapView from "../maps/MapView";
import "./RouteOptimizer.css";

const RouteOptimizer = () => {
  const [selectedNurse, setSelectedNurse] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(null); // Single route for individual nurse
  const [routes, setRoutes] = useState([]); // Multiple routes for all nurses
  const [displayMode, setDisplayMode] = useState("single"); // "single" or "multiple"
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
    setRoute(null); // Clear existing single route when nurse changes
    setDisplayMode("single"); // Switch back to single mode
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setRoute(null); // Clear existing routes when date changes
    setRoutes([]);
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
        console.log("Raw route data:", routeData);
        console.log("Leaflet data:", routeData.leafletData);

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
          setDisplayMode("single");
          console.log("Formatted single route set:", formattedRoute);
          console.log("Markers:", formattedRoute.markers);
          console.log("Polylines:", formattedRoute.polylines);
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

      console.log(
        "Generating routes for all nurses:",
        nurseIds,
        "on date:",
        selectedDate
      );

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
      console.log("All routes API response:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate routes");
      }

      // Process multiple routes for display
      if (data.data && data.data.routes && data.data.routes.length > 0) {
        const formattedRoutes = data.data.routes
          .map((routeData, index) => {
            if (routeData.leafletData) {
              return {
                id: routeData.nurseInfo.id,
                nurseInfo: routeData.nurseInfo,
                markers: routeData.leafletData.markers,
                polylines: routeData.leafletData.polylines.map((polyline) => ({
                  ...polyline,
                  color: getRouteColor(index), // Assign different colors to each route
                })),
                summary: routeData.summary,
                appointments: routeData.optimizedOrder,
                visible: true, // All routes visible by default
              };
            }
            return null;
          })
          .filter(Boolean);

        setRoutes(formattedRoutes);
        setDisplayMode("multiple");
        setRoute(null); // Clear single route

        console.log("Formatted multiple routes set:", formattedRoutes);
        console.log("Sample route markers:", formattedRoutes[0]?.markers);
        console.log("Sample route polylines:", formattedRoutes[0]?.polylines);
        setError(
          `Successfully generated ${formattedRoutes.length} routes for ${data.data.successfulRoutes} nurses`
        );
      } else {
        throw new Error("No route data returned");
      }
    } catch (error) {
      console.error("Error generating routes:", error);
      setError(error.message || "Failed to generate routes");
    } finally {
      setLoading(false);
    }
  };

  // Generate different colors for each route
  const getRouteColor = (index) => {
    const colors = [
      "#0078d4", // Blue
      "#d13438", // Red
      "#107c10", // Green
      "#ff8c00", // Orange
      "#8764b8", // Purple
      "#00bcf2", // Cyan
      "#e81123", // Crimson
      "#00cc6a", // Lime
      "#ffb900", // Yellow
      "#c239b3", // Magenta
    ];
    return colors[index % colors.length];
  };

  // Toggle individual route visibility
  const toggleRouteVisibility = (routeId) => {
    setRoutes((prevRoutes) =>
      prevRoutes.map((route) =>
        route.id === routeId ? { ...route, visible: !route.visible } : route
      )
    );
  };

  // Extract locations for map display - Single route mode
  const getNurseLocations = () => {
    console.log("getNurseLocations called, displayMode:", displayMode);

    if (displayMode === "single" && route && route.markers) {
      console.log("Single route markers:", route.markers);
      const nurseMarker = route.markers.find((m) => m.type === "nurse");
      console.log("Found nurse marker:", nurseMarker);

      if (!nurseMarker) return [];

      const result = [
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
      console.log("Nurse locations result:", result);
      return result;
    }

    // Multiple routes mode - get all nurse locations
    if (displayMode === "multiple" && routes.length > 0) {
      console.log("Multiple routes mode, routes:", routes.length);
      const result = routes
        .filter((route) => route.visible)
        .map((route) => {
          console.log("Processing route:", route.id, "markers:", route.markers);
          const nurseMarker = route.markers.find((m) => m.type === "nurse");
          if (!nurseMarker) return null;

          return {
            id: nurseMarker.id,
            name: route.nurseInfo.name,
            title: "RN",
            address: route.nurseInfo.address,
            location: {
              lat: nurseMarker.position[0],
              lng: nurseMarker.position[1],
            },
          };
        })
        .filter(Boolean);
      console.log("Multiple nurse locations result:", result);
      return result;
    }

    console.log("No nurse locations found");
    return [];
  };

  const getPatientLocations = () => {
    console.log("getPatientLocations called, displayMode:", displayMode);

    if (displayMode === "single" && route && route.markers) {
      console.log(
        "Single route patient markers:",
        route.markers.filter((m) => m.type === "patient")
      );
      const result = route.markers
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
      console.log("Single patient locations result:", result);
      return result;
    }

    // Multiple routes mode - get all patient locations
    if (displayMode === "multiple" && routes.length > 0) {
      console.log("Multiple routes patient processing");
      const allPatients = [];
      routes
        .filter((route) => route.visible)
        .forEach((route) => {
          console.log("Processing route patients:", route.id);
          if (route.markers) {
            route.markers
              .filter((m) => m.type === "patient")
              .forEach((marker) => {
                allPatients.push({
                  id: `${route.id}-${marker.id}`, // Unique ID combining route and marker
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
                  nurseName: route.nurseInfo.name, // Add nurse name for identification
                });
              });
          }
        });
      console.log("Multiple patient locations result:", allPatients);
      return allPatients;
    }

    console.log("No patient locations found");
    return [];
  };

  const getRoutePolylines = () => {
    console.log("getRoutePolylines called, displayMode:", displayMode);

    if (displayMode === "single" && route && route.polylines) {
      console.log("Single route polylines:", route.polylines);
      const result = route.polylines.map((polyline) => ({
        points: polyline.points.map((point) => ({
          lat: point[0],
          lng: point[1],
        })),
        color: polyline.color || "#0078d4",
      }));
      console.log("Single route polylines result:", result);
      return result;
    }

    // Multiple routes mode - get all visible polylines
    if (displayMode === "multiple" && routes.length > 0) {
      console.log("Multiple routes polylines processing");
      const allPolylines = [];
      routes
        .filter((route) => route.visible)
        .forEach((route) => {
          console.log(
            "Processing route polylines:",
            route.id,
            "polylines:",
            route.polylines
          );
          if (route.polylines) {
            route.polylines.forEach((polyline) => {
              allPolylines.push({
                points: polyline.points.map((point) => ({
                  lat: point[0],
                  lng: point[1],
                })),
                color: polyline.color || "#0078d4",
              });
            });
          }
        });
      console.log("Multiple route polylines result:", allPolylines);
      return allPolylines;
    }

    console.log("No route polylines found");
    return [];
  };

  // Calculate summary stats for multiple routes
  const getMultipleRoutesSummary = () => {
    if (displayMode !== "multiple" || routes.length === 0) return null;

    const visibleRoutes = routes.filter((route) => route.visible);

    const totalDistance = visibleRoutes.reduce(
      (sum, route) => sum + (route.summary?.totalDistanceMiles || 0),
      0
    );
    const totalTime = visibleRoutes.reduce(
      (sum, route) => sum + (route.summary?.totalTimeMinutes || 0),
      0
    );
    const totalFuelCost = visibleRoutes.reduce(
      (sum, route) => sum + (route.summary?.estimatedFuelCost || 0),
      0
    );
    const totalVisits = visibleRoutes.reduce(
      (sum, route) => sum + (route.summary?.visits || 0),
      0
    );

    const formatTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    return {
      totalDistance: totalDistance.toFixed(1),
      totalTime: formatTime(totalTime),
      totalFuelCost: totalFuelCost.toFixed(2),
      totalVisits,
      routeCount: visibleRoutes.length,
    };
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

        {displayMode === "multiple" && routes.length > 0 && (
          <div className="display-mode-info">
            <span>
              Showing {routes.filter((r) => r.visible).length} of{" "}
              {routes.length} routes
            </span>
          </div>
        )}
      </div>

      {error && (
        <div
          className="error-message"
          style={{
            padding: "10px",
            margin: "10px 0",
            backgroundColor: error.includes("Successfully")
              ? "#d4edda"
              : "#fee",
            border: `1px solid ${
              error.includes("Successfully") ? "#c3e6cb" : "#fcc"
            }`,
            borderRadius: "4px",
            color: error.includes("Successfully") ? "#155724" : "#c00",
          }}
        >
          {error}
        </div>
      )}

      {/* Route visibility controls for multiple routes */}
      {displayMode === "multiple" && routes.length > 0 && (
        <div className="route-list-controls">
          <h4>Route Visibility Controls:</h4>
          <div className="route-toggles">
            {routes.map((routeItem) => (
              <label key={routeItem.id} className="route-toggle">
                <input
                  type="checkbox"
                  checked={routeItem.visible}
                  onChange={() => toggleRouteVisibility(routeItem.id)}
                />
                <span
                  className="route-color-indicator"
                  style={{
                    backgroundColor: routeItem.polylines[0]?.color || "#0078d4",
                    width: "12px",
                    height: "12px",
                    display: "inline-block",
                    marginRight: "5px",
                    borderRadius: "2px",
                  }}
                ></span>
                {routeItem.nurseInfo.name}
                <span className="route-stats">
                  ({routeItem.summary?.visits || 0} visits,{" "}
                  {routeItem.summary?.totalDistanceMiles?.toFixed(1) || 0} mi)
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="map-wrapper">
        <MapView
          nurseLocations={getNurseLocations()}
          patientLocations={getPatientLocations()}
          routes={getRoutePolylines()}
        />

        {/* Single route info */}
        {displayMode === "single" && route && route.summary && (
          <div className="route-info">
            <h4>Route Information - {route.nurseInfo.name}</h4>
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

        {/* Multiple routes summary */}
        {displayMode === "multiple" &&
          routes.length > 0 &&
          (() => {
            const summary = getMultipleRoutesSummary();
            return summary ? (
              <div className="route-info">
                <h4>All Routes Summary</h4>
                <div className="route-info-item">
                  <span className="route-info-label">Routes:</span>
                  <span className="route-info-value">{summary.routeCount}</span>
                </div>
                <div className="route-info-item">
                  <span className="route-info-label">Total Distance:</span>
                  <span className="route-info-value">
                    {summary.totalDistance} miles
                  </span>
                </div>
                <div className="route-info-item">
                  <span className="route-info-label">Total Time:</span>
                  <span className="route-info-value">{summary.totalTime}</span>
                </div>
                <div className="route-info-item">
                  <span className="route-info-label">Total Visits:</span>
                  <span className="route-info-value">
                    {summary.totalVisits}
                  </span>
                </div>
                <div className="route-info-item">
                  <span className="route-info-label">Total Fuel Cost:</span>
                  <span className="route-info-value">
                    ${summary.totalFuelCost}
                  </span>
                </div>
              </div>
            ) : null;
          })()}
      </div>
    </div>
  );
};

export default RouteOptimizer;
