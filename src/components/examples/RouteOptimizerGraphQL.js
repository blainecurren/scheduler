// src/components/examples/RouteOptimizerGraphQL.js
import React, { useState, useEffect } from "react";
import useGraphQL from "../../hooks/useGraphQL";
import MapView from "../maps/MapView";

const RouteOptimizerGraphQL = () => {
  const [selectedNurse, setSelectedNurse] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [routeType, setRouteType] = useState("time"); // 'time' or 'distance'
  const [nurses, setNurses] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const { loading, error, query } = useGraphQL();

  // Fetch nurses on component mount
  useEffect(() => {
    const fetchNurses = async () => {
      try {
        const data = await query("GET_NURSES");
        if (data?.nurses) {
          setNurses(data.nurses);
          // Auto-select the first nurse if available
          if (data.nurses.length > 0 && !selectedNurse) {
            setSelectedNurse(data.nurses[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching nurses:", err);
      }
    };

    fetchNurses();
  }, [query, selectedNurse]);

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
    if (!selectedNurse || !selectedDate) {
      alert("Please select a nurse and date");
      return;
    }

    try {
      const data = await query("OPTIMIZE_ROUTE", {
        nurseId: selectedNurse,
        date: selectedDate,
        routeType,
      });

      if (data?.optimizeRoute) {
        setOptimizedRoute(data.optimizeRoute);
      }
    } catch (err) {
      console.error("Error optimizing route:", err);
      alert(`Error optimizing route: ${err.message}`);
    }
  };

  // Prepare data for MapView
  const getMapData = () => {
    if (!optimizedRoute)
      return { nurseLocations: [], patientLocations: [], routes: [] };

    // Get the nurse location
    const nurseLocation = optimizedRoute.routePoints.find(
      (point) => point.stopType === "START"
    );

    // Format nurse location for map
    const nurseLocations = nurseLocation
      ? [
          {
            id: optimizedRoute.nurse.id,
            name: optimizedRoute.nurse.name,
            title: "RN",
            address: nurseLocation.location.address || "Office",
            location: {
              lat: nurseLocation.location.lat,
              lng: nurseLocation.location.lng,
            },
          },
        ]
      : [];

    // Get patient locations from appointments
    const patientLocations = optimizedRoute.appointments
      .map((appointment) => {
        // Find corresponding route point
        const routePoint = optimizedRoute.routePoints.find(
          (point) => point.appointmentId === appointment.id
        );

        return {
          id: appointment.patient.id,
          name: appointment.patient.name,
          appointmentTime: new Date(appointment.startTime).toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          ),
          address: routePoint?.location.address || "Home",
          location:
            appointment.patient.location ||
            (routePoint
              ? {
                  lat: routePoint.location.lat,
                  lng: routePoint.location.lng,
                }
              : null),
        };
      })
      .filter((location) => location.location);

    // Format route for map
    const routes = optimizedRoute
      ? [
          {
            id: optimizedRoute.id,
            points: optimizedRoute.routePoints
              .sort((a, b) => a.order - b.order)
              .map((point) => ({
                lat: point.location.lat,
                lng: point.location.lng,
              })),
            distance: optimizedRoute.totalDistance,
            time: optimizedRoute.totalTime,
          },
        ]
      : [];

    return { nurseLocations, patientLocations, routes };
  };

  const { nurseLocations, patientLocations, routes } = getMapData();

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
            <option value="">Select Nurse</option>
            {nurses.map((nurse) => (
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
            <option value="time">Fastest Route</option>
            <option value="distance">Shortest Distance</option>
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
          nurseLocations={nurseLocations}
          patientLocations={patientLocations}
          routes={routes}
        />

        {optimizedRoute && (
          <div className="route-info">
            <h4>Route Information</h4>
            <div className="route-info-item">
              <span className="route-info-label">Distance:</span>
              <span className="route-info-value">
                {(optimizedRoute.totalDistance / 1000).toFixed(1)} km
              </span>
            </div>
            <div className="route-info-item">
              <span className="route-info-label">Time:</span>
              <span className="route-info-value">
                {Math.floor(optimizedRoute.totalTime / 3600000)}h{" "}
                {Math.floor((optimizedRoute.totalTime % 3600000) / 60000)}m
              </span>
            </div>
            <div className="route-info-item">
              <span className="route-info-label">Patients:</span>
              <span className="route-info-value">
                {optimizedRoute.appointments.length}
              </span>
            </div>
            <div className="route-info-item">
              <span className="route-info-label">Status:</span>
              <span className="route-info-value">{optimizedRoute.status}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteOptimizerGraphQL;
