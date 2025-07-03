// src/components/maps/MapWithNurses.js
import React, { useState, useEffect } from "react";
import MapView from "./MapView";
import { useNurseSelection } from "../../contexts/NurseSelectionContext";

const MapWithNurses = () => {
  const { selectedNurses, selectedDate } = useNurseSelection();
  const [nurseLocations, setNurseLocations] = useState([]);
  const [patientLocations, setPatientLocations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);

  useEffect(() => {
    console.log("MapWithNurses: Selected nurses changed:", selectedNurses);
    if (selectedNurses.length > 0) {
      fetchNurseLocations();
      fetchRoutes();
    } else {
      setNurseLocations([]);
      setPatientLocations([]);
      setRoutes([]);
    }
  }, [selectedNurses, selectedDate]);

  const fetchNurseLocations = async () => {
    setLoading(true);
    console.log("Fetching locations for nurses:", selectedNurses);

    try {
      // Fetch appointments to get nurse location data
      const nurseIds = selectedNurses.join(",");
      const url = `http://localhost:3001/api/appointments/filter?nurses=${nurseIds}&date=${selectedDate}`;
      console.log("Fetching from:", url);

      const response = await fetch(url);
      const data = await response.json();
      console.log("API Response:", data);

      if (data.appointments) {
        // Extract unique nurse locations
        const nurseMap = {};
        const patientMap = {};

        data.appointments.forEach((apt) => {
          // Add nurse location
          if (
            apt.nurseId &&
            !nurseMap[apt.nurseId] &&
            apt.nurseLocationLatitude &&
            apt.nurseLocationLongitude
          ) {
            nurseMap[apt.nurseId] = {
              id: apt.nurseId,
              name: apt.nurseName,
              title: "RN",
              address: apt.nurseLocationAddress || "No address available",
              location: {
                lat: parseFloat(apt.nurseLocationLatitude),
                lng: parseFloat(apt.nurseLocationLongitude),
              },
            };
          }

          // Add patient location
          if (apt.latitude && apt.longitude) {
            const patientKey = `${apt.patientId}-${apt.startDate}`;
            if (!patientMap[patientKey]) {
              patientMap[patientKey] = {
                id: patientKey,
                patientId: apt.patientId,
                name: apt.patientName,
                address:
                  apt.locationAddress || apt.locationName || "No address",
                appointmentTime: new Date(apt.startDate).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                ),
                location: {
                  lat: parseFloat(apt.latitude),
                  lng: parseFloat(apt.longitude),
                },
                nurseId: apt.nurseId,
                nurseName: apt.nurseName,
              };
            }
          }
        });

        const locations = Object.values(nurseMap);
        const patients = Object.values(patientMap);
        console.log("Final nurse locations:", locations);
        console.log("Patient locations:", patients);
        setNurseLocations(locations);
        setPatientLocations(patients);
      }
    } catch (error) {
      console.error("Error fetching nurse locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    if (selectedNurses.length === 0) return;

    setRoutesLoading(true);
    console.log("Fetching routes for nurses:", selectedNurses);

    try {
      const response = await fetch(
        "http://localhost:3001/api/routing/optimize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nurseIds: selectedNurses,
            date: selectedDate,
          }),
        }
      );

      const data = await response.json();
      console.log("Routes API response:", data);

      if (data.success && data.data?.routes) {
        const formattedRoutes = [];

        data.data.routes.forEach((routeData) => {
          if (routeData.leafletData?.polylines) {
            routeData.leafletData.polylines.forEach((polyline) => {
              if (polyline.points && polyline.points.length > 0) {
                formattedRoutes.push({
                  id: `${routeData.nurseInfo.id}-${polyline.id || 0}`,
                  nurseId: routeData.nurseInfo.id,
                  nurseName: routeData.nurseInfo.name,
                  points: polyline.points.map((point) => ({
                    lat: point[0],
                    lng: point[1],
                  })),
                  color: polyline.color || "#0078d4",
                });
              }
            });
          }
        });

        console.log("Formatted routes:", formattedRoutes);
        setRoutes(formattedRoutes);
      }
    } catch (error) {
      console.error("Error fetching routes:", error);
    } finally {
      setRoutesLoading(false);
    }
  };

  // Calculate center
  const getCenter = () => {
    if (nurseLocations.length > 0) {
      const avgLat =
        nurseLocations.reduce((sum, n) => sum + n.location.lat, 0) /
        nurseLocations.length;
      const avgLng =
        nurseLocations.reduce((sum, n) => sum + n.location.lng, 0) /
        nurseLocations.length;
      return [avgLat, avgLng];
    }
    return [32.75, -97.03]; // Default to DFW area
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        Loading nurse locations...
      </div>
    );
  }

  return (
    <div style={{ height: "100%" }}>
      <div
        style={{
          padding: "10px",
          backgroundColor: "#f0f0f0",
          borderBottom: "1px solid #ddd",
          fontSize: "14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          {selectedNurses.length === 0
            ? 'Select nurses from the sidebar and click "Apply Filters" to see their locations'
            : `Showing ${nurseLocations.length} nurse(s) and ${patientLocations.length} patient visit(s) for ${selectedDate}`}
        </div>
        {routesLoading && (
          <div style={{ fontSize: "12px", color: "#666" }}>
            Loading routes...
          </div>
        )}
      </div>
      <MapView
        nurseLocations={nurseLocations}
        patientLocations={patientLocations}
        routes={routes}
        center={getCenter()}
        zoom={nurseLocations.length > 0 ? 12 : 10}
      />
    </div>
  );
};

export default MapWithNurses;
