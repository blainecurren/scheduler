// src/components/maps/MapWithNurses.js
import React, { useState, useEffect } from "react";
import MapView from "./MapView";
import { useNurseSelection } from "../../contexts/NurseSelectionContext";

const MapWithNurses = () => {
  const { selectedNurses, selectedDate } = useNurseSelection();
  const [nurseLocations, setNurseLocations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("MapWithNurses: Selected nurses changed:", selectedNurses);
    if (selectedNurses.length > 0) {
      fetchNurseLocations();
    } else {
      setNurseLocations([]);
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

        data.appointments.forEach((apt) => {
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
            console.log("Added nurse location:", nurseMap[apt.nurseId]);
          }
        });

        const locations = Object.values(nurseMap);
        console.log("Final nurse locations:", locations);
        setNurseLocations(locations);
      }
    } catch (error) {
      console.error("Error fetching nurse locations:", error);
    } finally {
      setLoading(false);
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
      return { lat: avgLat, lng: avgLng };
    }
    return { lat: 32.75, lng: -97.03 }; // Default
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
        }}
      >
        {selectedNurses.length === 0
          ? 'Select nurses from the sidebar and click "Apply Filters" to see their locations'
          : `Showing ${nurseLocations.length} nurse location(s) for ${selectedDate}`}
      </div>
      <MapView
        nurseLocations={nurseLocations}
        patientLocations={[]} // Empty for now
        routes={[]}
        center={getCenter()}
        zoom={nurseLocations.length > 0 ? 12 : 10}
      />
    </div>
  );
};

export default MapWithNurses;
