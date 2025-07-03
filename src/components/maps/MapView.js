import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import RoutingMachine from "./RoutingMachine";
import "./MapView.css";

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom icons for nurses and patients
const nurseIcon = L.divIcon({
  className: "nurse-marker",
  html: `
    <div class="marker-content">
      <div class="marker-icon">👤</div>
      <div class="marker-label">Nurse</div>
    </div>
  `,
  iconSize: [60, 60],
  iconAnchor: [30, 50],
  popupAnchor: [0, -40],
});

const patientIcon = L.divIcon({
  className: "patient-marker",
  html: `
    <div class="marker-content">
      <div class="marker-icon">P</div>
      <div class="marker-label">Patient</div>
    </div>
  `,
  iconSize: [60, 60],
  iconAnchor: [30, 50],
  popupAnchor: [0, -40],
});

const MapView = ({
  nurseLocations = [],
  patientLocations = [],
  routes = [],
  center = [32.7767, -96.797], // Default to Dallas, TX
  zoom = 10,
}) => {
  // Handle different data structures for backward compatibility
  const processedNurseLocations = nurseLocations.map((nurse) => {
    // If location is nested under 'location' property
    if (nurse.location) {
      return {
        ...nurse,
        latitude: nurse.location.lat,
        longitude: nurse.location.lng,
      };
    }
    // If already has latitude/longitude at top level
    return nurse;
  });

  const processedPatientLocations = patientLocations.map((patient) => {
    // If location is nested under 'location' property
    if (patient.location) {
      return {
        ...patient,
        latitude: patient.location.lat,
        longitude: patient.location.lng,
      };
    }
    // If already has latitude/longitude at top level
    return patient;
  });
  const [selectedRoute, setSelectedRoute] = useState(null);

  // Process routes for the routing machine
  useEffect(() => {
    if (routes.length > 0 && routes[0].coordinates) {
      // Convert the first route to waypoints for the routing machine
      const waypoints = routes[0].coordinates.map((coord) => [
        coord.lat,
        coord.lng,
      ]);
      setSelectedRoute(waypoints);
    }
  }, [routes]);

  return (
    <div className="map-container">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        doubleClickZoom={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri"
        />

        {/* Nurse markers */}
        {processedNurseLocations.map((nurse) => {
          if (!nurse.latitude || !nurse.longitude) return null;

          return (
            <Marker
              key={nurse.id}
              position={[nurse.latitude, nurse.longitude]}
              icon={nurseIcon}
            >
              <Popup>
                <div className="popup-content">
                  <h3>{nurse.name}</h3>
                  <p>
                    <strong>ID:</strong> {nurse.id}
                  </p>
                  {nurse.address && (
                    <p>
                      <strong>Address:</strong> {nurse.address}
                    </p>
                  )}
                  <p className="marker-type">Nurse Location</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Patient markers */}
        {processedPatientLocations.map((patient, index) => {
          if (!patient.latitude || !patient.longitude) return null;

          return (
            <Marker
              key={patient.id || `patient-${index}`}
              position={[patient.latitude, patient.longitude]}
              icon={patientIcon}
            >
              <Popup>
                <div className="popup-content">
                  <h3>{patient.name || `Patient ${index + 1}`}</h3>
                  {patient.address && (
                    <p>
                      <strong>Address:</strong> {patient.address}
                    </p>
                  )}
                  {patient.appointmentTime && (
                    <p>
                      <strong>Appointment:</strong> {patient.appointmentTime}
                    </p>
                  )}
                  <p className="marker-type">Patient Location</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Routing Machine for displaying routes */}
        {routes &&
          routes.length > 0 &&
          routes.map((route, index) => {
            // Extract waypoints from route points
            const waypoints =
              route.points && route.points.length >= 2
                ? route.points.map((point) => [point.lat, point.lng])
                : null;

            if (!waypoints) return null;

            return (
              <RoutingMachine
                key={route.id || `route-${index}`}
                waypoints={waypoints}
                lineOptions={{
                  styles: [
                    {
                      color: route.color || "#0078d4",
                      weight: 4,
                      opacity: 0.8,
                    },
                  ],
                }}
                show={false}
                addWaypoints={false}
                routeWhileDragging={false}
                draggableWaypoints={false}
                fitSelectedRoutes={false}
                showAlternatives={false}
              />
            );
          })}
      </MapContainer>
    </div>
  );
};

export default MapView;
