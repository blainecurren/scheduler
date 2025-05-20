import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

// Fix for Leaflet marker images
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapView = ({ 
  nurseLocations = [], 
  patientLocations = [], 
  routes = [],
  center = { lat: 30.2672, lng: -97.7431 }, // Default center (Austin, TX)
  zoom = 12
}) => {
  // Custom marker colors
  const nurseIcon = L.icon({
    ...DefaultIcon.options,
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const patientIcon = L.icon({
    ...DefaultIcon.options,
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return (
    <div className="map-container">
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
      >
        {/* Base map tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Nurse locations */}
        {nurseLocations.map((nurse, index) => (
          <Marker 
            key={`nurse-${index}`}
            position={[nurse.location.lat, nurse.location.lng]}
            icon={nurseIcon}
          >
            <Popup>
              <div>
                <h3>{nurse.name}</h3>
                <p>{nurse.title}</p>
                <p>{nurse.address}</p>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Patient locations */}
        {patientLocations.map((patient, index) => (
          <Marker 
            key={`patient-${index}`}
            position={[patient.location.lat, patient.location.lng]}
            icon={patientIcon}
          >
            <Popup>
              <div>
                <h3>{patient.name}</h3>
                <p>Appointment: {patient.appointmentTime}</p>
                <p>{patient.address}</p>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Routes as polylines */}
        {routes.map((route, index) => (
          <Polyline 
            key={`route-${index}`}
            positions={route.points.map(point => [point.lat, point.lng])}
            color="#0078d4"
            weight={4}
            opacity={0.7}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;