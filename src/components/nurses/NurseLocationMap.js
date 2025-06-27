import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import useAPIClient from "../../hooks/apiClient";
import "./NurseLocationMap.css";

// Fix for Leaflet marker images
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom marker colors
const nurseIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const patientIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const NurseLocationMap = () => {
  const [nurses, setNurses] = useState([]);
  const [selectedNurse, setSelectedNurse] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [mappableAppointments, setMappableAppointments] = useState([]);
  const [showAppointments, setShowAppointments] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 30.2672, lng: -97.7431 }); // Default to Austin, TX
  const [zoomLevel, setZoomLevel] = useState(12);

  const { 
    loading, 
    error, 
    getFilterOptions, 
    getMappableAppointments,
    clearError 
  } = useAPIClient();

  // Load nurses from filter options on component mount
  useEffect(() => {
    const fetchNurses = async () => {
      try {
        const options = await getFilterOptions();
        if (options?.nurses) {
          setNurses(options.nurses);
        }
      } catch (err) {
        console.error("Error fetching nurses:", err);
      }
    };

    fetchNurses();
  }, [getFilterOptions]);

  // Fetch mappable appointments when parameters change
  useEffect(() => {
    if (!showAppointments) {
      setMappableAppointments([]);
      return;
    }

    const fetchMappableAppointments = async () => {
      try {
        clearError();
        
        const filters = {
          date: selectedDate,
          hasCoordinates: 'true'
        };

        // Add nurse filter if specific nurse selected
        if (selectedNurse) {
          filters.nurses = selectedNurse;
        }

        const data = await getMappableAppointments(filters);
        
        if (data?.allAppointments) {
          setMappableAppointments(data.allAppointments);
          
          // Auto-center map on first appointment if available
          if (data.allAppointments.length > 0 && data.allAppointments[0].latitude) {
            setMapCenter({
              lat: parseFloat(data.allAppointments[0].latitude),
              lng: parseFloat(data.allAppointments[0].longitude),
            });
            setZoomLevel(13);
          }
        }
      } catch (err) {
        console.error("Error fetching mappable appointments:", err);
      }
    };

    fetchMappableAppointments();
  }, [selectedNurse, selectedDate, showAppointments, getMappableAppointments, clearError]);

  const handleNurseChange = (e) => {
    setSelectedNurse(e.target.value);
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const toggleShowAppointments = () => {
    setShowAppointments(!showAppointments);
  };

  // Format time for display
  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      let date;
      if (dateString.includes('/')) {
        // Format: "06/27/2025 10:30:00" 
        date = new Date(dateString);
      } else {
        // ISO format
        date = new Date(dateString);
      }
      
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (err) {
      return dateString;
    }
  };

  // Find selected nurse data
  const selectedNurseData = nurses.find((nurse) => nurse.id === selectedNurse);

  // Filter appointments for selected nurse (if any)
  const nurseAppointments = selectedNurse
    ? mappableAppointments.filter(apt => apt.nurseId === selectedNurse)
    : mappableAppointments;

  if (loading && nurses.length === 0) {
    return <div className="loading-container">Loading nurses data...</div>;
  }

  return (
    <div className="nurse-map-container">
      <div className="map-controls">
        <div className="control-group">
          <label htmlFor="nurseSelect">Select Nurse:</label>
          <select
            id="nurseSelect"
            value={selectedNurse}
            onChange={handleNurseChange}
            className="nurse-select"
          >
            <option value="">-- All Nurses --</option>
            {nurses.map((nurse) => (
              <option key={nurse.id} value={nurse.id}>
                {nurse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="dateSelect">Date:</label>
          <input
            type="date"
            id="dateSelect"
            value={selectedDate}
            onChange={handleDateChange}
            className="date-select"
          />
        </div>

        <div className="control-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={showAppointments}
              onChange={toggleShowAppointments}
            />
            Show Patient Appointments ({mappableAppointments.length})
          </label>
        </div>

        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
            <button onClick={clearError} className="error-dismiss">×</button>
          </div>
        )}
      </div>

      <div className="map-wrapper">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={zoomLevel}
          className="nurse-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Patient appointment markers */}
          {showAppointments && nurseAppointments.map((appointment, index) => {
            // Only show appointments with valid coordinates
            if (!appointment.latitude || !appointment.longitude) return null;
            
            const lat = parseFloat(appointment.latitude);
            const lng = parseFloat(appointment.longitude);
            
            if (isNaN(lat) || isNaN(lng)) return null;

            return (
              <Marker
                key={`appointment-${appointment.id}-${index}`}
                position={[lat, lng]}
                icon={patientIcon}
              >
                <Popup>
                  <div className="marker-popup">
                    <h3>{appointment.patientName}</h3>
                    <p><strong>Time:</strong> {formatTime(appointment.startDate)}</p>
                    <p><strong>Nurse:</strong> {appointment.nurseName}</p>
                    <p><strong>Service:</strong> {appointment.serviceType}</p>
                    <p><strong>Location:</strong> {appointment.locationName}</p>
                    <p><strong>Address:</strong> {appointment.locationAddress}</p>
                    <p><strong>Status:</strong> 
                      <span className={`status-badge ${appointment.status?.toLowerCase()}`}>
                        {appointment.status}
                      </span>
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Information Panel */}
      <div className="map-info-panel">
        {selectedNurseData ? (
          <div className="nurse-info">
            <h3>{selectedNurseData.name}</h3>
            <p><strong>ID:</strong> {selectedNurseData.id}</p>
          </div>
        ) : (
          <div className="nurse-info">
            <h3>All Nurses</h3>
            <p>Select a specific nurse to focus on their appointments</p>
          </div>
        )}

        {showAppointments && (
          <div className="appointments-summary">
            <h4>Appointments for {selectedDate}</h4>
            {loading && <p>Loading appointments...</p>}
            {!loading && nurseAppointments.length === 0 && (
              <p>No appointments with coordinates found for this date.</p>
            )}
            {!loading && nurseAppointments.length > 0 && (
              <div>
                <p><strong>{nurseAppointments.length}</strong> appointments with coordinates</p>
                <ul className="appointments-list">
                  {nurseAppointments.slice(0, 5).map((appointment) => (
                    <li key={appointment.id} className="appointment-item">
                      <p>
                        <strong>{formatTime(appointment.startDate)}</strong> - {appointment.patientName}
                      </p>
                      <p className="appointment-location">
                        📍 {appointment.locationName}
                      </p>
                    </li>
                  ))}
                  {nurseAppointments.length > 5 && (
                    <li className="more-items">
                      ... and {nurseAppointments.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NurseLocationMap;