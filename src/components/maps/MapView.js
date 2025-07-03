import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const MapView = ({
  nurseLocations = [],
  patientLocations = [],
  routes = [],
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map instance centered on Texas
    mapInstanceRef.current = L.map(mapRef.current).setView(
      [32.7767, -96.797],
      10
    );

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers and routes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers and polylines
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    polylinesRef.current.forEach((polyline) => polyline.remove());
    polylinesRef.current = [];

    console.log("MapView received data:", {
      nurseLocations,
      patientLocations,
      routes,
    });

    // If routes contain markers, extract them as patient locations
    const routeMarkers = [];
    routes.forEach((route) => {
      if (route.markers) {
        route.markers.forEach((marker) => {
          // Skip nurse markers (type === 'nurse')
          if (marker.type !== "nurse") {
            routeMarkers.push({
              id: marker.id,
              name: marker.popup?.title || "Patient",
              appointmentTime: marker.popup?.scheduledTime
                ? new Date(marker.popup.scheduledTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null,
              address: marker.popup?.address || "",
              location: {
                lat: marker.position[0],
                lng: marker.position[1],
              },
              visitOrder: marker.visitOrder,
              nurseName: route.nurseInfo?.name || "",
            });
          }
        });
      }
    });

    // Combine route markers with patient locations
    const allPatientLocations = [...patientLocations, ...routeMarkers];

    // Add nurse markers
    nurseLocations.forEach((nurse) => {
      const nurseIcon = L.divIcon({
        className: "nurse-marker",
        html: `<div class="marker-content">
                 <div class="marker-icon" style="background-color: #0078d4; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 3px solid white;">👤</div>
                 <div class="marker-label" style="margin-top: 4px; font-size: 12px; font-weight: 600; color: #333; text-shadow: 1px 1px 2px white, -1px -1px 2px white;">Nurse</div>
               </div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50],
      });

      const position = nurse.location
        ? [nurse.location.lat, nurse.location.lng]
        : [nurse.latitude, nurse.longitude];

      const marker = L.marker(position, {
        icon: nurseIcon,
      }).addTo(mapInstanceRef.current).bindPopup(`
          <div class="popup-content">
            <h3>${nurse.name}</h3>
            <p><strong>Start/End Location</strong></p>
            ${nurse.address ? `<p>${nurse.address}</p>` : ""}
            <p style="font-style: italic; color: #888;">Nurse Location</p>
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Add patient markers with visit order
    allPatientLocations.forEach((patient, index) => {
      const visitOrder = patient.visitOrder || index + 1;

      // Create custom icon based on whether it's a regular patient or from route data
      const iconColor = patient.nurseName
        ? getColorForNurse(patient.nurseName)
        : "#40e0d0";

      const patientIcon = L.divIcon({
        className: "patient-marker",
        html: `<div class="marker-content">
                 <div class="marker-icon" style="background-color: ${iconColor}; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 3px solid white;">${visitOrder}</div>
                 <div class="marker-label" style="margin-top: 4px; font-size: 12px; font-weight: 600; color: #333; text-shadow: 1px 1px 2px white, -1px -1px 2px white; white-space: nowrap;">Stop ${visitOrder}</div>
               </div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50],
      });

      const position = patient.location
        ? [patient.location.lat, patient.location.lng]
        : [patient.latitude, patient.longitude];

      const marker = L.marker(position, {
        icon: patientIcon,
      }).addTo(mapInstanceRef.current).bindPopup(`
          <div class="popup-content">
            <h3>${patient.name || `Patient ${visitOrder}`}</h3>
            <p><strong>Visit ${visitOrder}</strong></p>
            ${
              patient.appointmentTime
                ? `<p><strong>Time:</strong> ${patient.appointmentTime}</p>`
                : ""
            }
            ${
              patient.address
                ? `<p><strong>Address:</strong> ${patient.address}</p>`
                : ""
            }
            ${
              patient.nurseName
                ? `<p><strong>Nurse:</strong> ${patient.nurseName}</p>`
                : ""
            }
            <p style="font-style: italic; color: #888;">Patient Visit</p>
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Add route polylines
    routes.forEach((route, routeIndex) => {
      if (route.points && route.points.length > 0) {
        const latlngs = route.points.map((point) => [point.lat, point.lng]);

        const polyline = L.polyline(latlngs, {
          color: route.color || getRouteColor(routeIndex),
          weight: 5,
          opacity: 0.7,
          smoothFactor: 1,
        }).addTo(mapInstanceRef.current);

        // Add popup to route showing summary
        if (route.summary) {
          polyline.bindPopup(`
            <div class="popup-content">
              <h3>Route Summary</h3>
              <p><strong>Total Distance:</strong> ${
                route.summary.totalDistanceMiles?.toFixed(1) || 0
              } miles</p>
              <p><strong>Total Time:</strong> ${
                route.summary.totalTimeMinutes?.toFixed(0) || 0
              } minutes</p>
              <p><strong>Visits:</strong> ${route.summary.visits || 0}</p>
            </div>
          `);
        }

        polylinesRef.current.push(polyline);
      }
    });

    // Fit map to show all markers and routes
    if (markersRef.current.length > 0 || routes.length > 0) {
      const group = new L.featureGroup([
        ...markersRef.current,
        ...polylinesRef.current.filter(
          (p) => p.getBounds && p.getBounds().isValid()
        ),
      ]);

      if (group.getBounds().isValid()) {
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [nurseLocations, patientLocations, routes]);

  // Helper function to get color for a specific nurse
  const getColorForNurse = (nurseName) => {
    // Simple hash function to consistently assign colors to nurse names
    let hash = 0;
    for (let i = 0; i < nurseName.length; i++) {
      hash = nurseName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      "#0078d4",
      "#d13438",
      "#107c10",
      "#ff8c00",
      "#8764b8",
      "#00bcf2",
      "#e81123",
      "#00cc6a",
      "#ffb900",
      "#c239b3",
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  // Helper function to get route colors
  const getRouteColor = (index) => {
    const colors = [
      "#0078d4",
      "#d13438",
      "#107c10",
      "#ff8c00",
      "#8764b8",
      "#00bcf2",
      "#e81123",
      "#00cc6a",
      "#ffb900",
      "#c239b3",
    ];
    return colors[index % colors.length];
  };

  return (
    <div
      ref={mapRef}
      className="map-container"
      style={{ height: "100%", width: "100%", position: "relative" }}
    >
      {/* Map will be rendered here */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "white",
          padding: "10px",
          borderRadius: "4px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          zIndex: 1000,
          fontSize: "12px",
        }}
      >
        <div style={{ marginBottom: "5px" }}>
          <span
            style={{
              display: "inline-block",
              width: "20px",
              height: "12px",
              backgroundColor: "#0078d4",
              marginRight: "5px",
            }}
          ></span>
          Nurse Start/End
        </div>
        <div>
          <span
            style={{
              display: "inline-block",
              width: "20px",
              height: "12px",
              backgroundColor: "#40e0d0",
              marginRight: "5px",
            }}
          ></span>
          Patient Visits
        </div>
      </div>
    </div>
  );
};

export default MapView;
