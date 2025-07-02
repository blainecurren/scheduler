import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./MapView.css";

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
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

    // Add nurse markers
    nurseLocations.forEach((nurse) => {
      const nurseIcon = L.divIcon({
        className: "nurse-marker",
        html: `<div class="marker-content">
                 <div class="marker-icon">👩‍⚕️</div>
                 <div class="marker-label">Nurse</div>
               </div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50],
      });

      const marker = L.marker([nurse.location.lat, nurse.location.lng], {
        icon: nurseIcon,
      }).addTo(mapInstanceRef.current).bindPopup(`
          <div class="popup-content">
            <h3>${nurse.name}</h3>
            <p><strong>${nurse.title}</strong></p>
            <p>${nurse.address}</p>
            <p class="marker-type">Start/End Location</p>
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Add patient markers with visit order
    patientLocations.forEach((patient, index) => {
      const patientIcon = L.divIcon({
        className: "patient-marker",
        html: `<div class="marker-content">
                 <div class="marker-icon">${
                   patient.visitOrder || index + 1
                 }</div>
                 <div class="marker-label">Visit ${
                   patient.visitOrder || index + 1
                 }</div>
               </div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50],
      });

      const marker = L.marker([patient.location.lat, patient.location.lng], {
        icon: patientIcon,
      }).addTo(mapInstanceRef.current).bindPopup(`
          <div class="popup-content">
            <h3>${patient.name}</h3>
            <p><strong>Visit ${patient.visitOrder || index + 1}</strong></p>
            <p>${patient.appointmentTime}</p>
            <p>${patient.address}</p>
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Add route polylines
    routes.forEach((route, index) => {
      if (route.points && route.points.length > 0) {
        const latlngs = route.points.map((point) => [point.lat, point.lng]);

        const polyline = L.polyline(latlngs, {
          color: route.color || "#0078d4",
          weight: 4,
          opacity: 0.7,
          smoothFactor: 1,
        }).addTo(mapInstanceRef.current);

        // Add direction arrows
        const decorator = L.polylineDecorator(polyline, {
          patterns: [
            {
              offset: "50%",
              repeat: 100,
              symbol: L.Symbol.arrowHead({
                pixelSize: 12,
                polygon: false,
                pathOptions: {
                  stroke: true,
                  weight: 2,
                  color: route.color || "#0078d4",
                },
              }),
            },
          ],
        }).addTo(mapInstanceRef.current);

        polylinesRef.current.push(polyline);
        polylinesRef.current.push(decorator);
      }
    });

    // Fit map to show all markers and routes
    if (markersRef.current.length > 0 || routes.length > 0) {
      const group = new L.featureGroup([
        ...markersRef.current,
        ...polylinesRef.current,
      ]);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [nurseLocations, patientLocations, routes]);

  return (
    <div
      ref={mapRef}
      className="map-container"
      style={{ height: "100%", width: "100%" }}
    >
      {/* Map will be rendered here */}
    </div>
  );
};

export default MapView;
