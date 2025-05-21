import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import useGraphQL from "../../hooks/useGraphQL";
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
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [nurseAppointments, setNurseAppointments] = useState([]);
  const [showAppointments, setShowAppointments] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 30.2672, lng: -97.7431 }); // Default to Austin, TX
  const [zoomLevel, setZoomLevel] = useState(12);

  const { loading, error, query } = useGraphQL();

  // Fetch nurses on component mount
  useEffect(() => {
    const fetchNurses = async () => {
      try {
        const data = await query("GET_NURSES");
        if (data?.nurses) {
          setNurses(data.nurses);
        }
      } catch (err) {
        console.error("Error fetching nurses:", err);
      }
    };

    fetchNurses();
  }, [query]);

  // Fetch nurse details when a nurse is selected
  useEffect(() => {
    if (!selectedNurse) return;

    const fetchNurseDetails = async () => {
      try {
        const data = await query("GET_NURSE", { id: selectedNurse });
        if (data?.nurse?.location) {
          // If nurse has a location, center the map on it
          setMapCenter({
            lat: data.nurse.location.lat,
            lng: data.nurse.location.lng,
          });
          setZoomLevel(14);
        }
      } catch (err) {
        console.error("Error fetching nurse details:", err);
      }
    };

    fetchNurseDetails();
  }, [selectedNurse, query]);

  // Fetch appointments when nurse and show appointments are selected
  useEffect(() => {
    if (!selectedNurse || !showAppointments) {
      setNurseAppointments([]);
      return;
    }

    const fetchAppointments = async () => {
      try {
        const data = await query("GET_APPOINTMENTS", {
          nurseId: selectedNurse,
          date: selectedDate,
        });

        if (data?.appointments) {
          // Fetch patient details for each appointment
          const appointmentsWithDetails = await Promise.all(
            data.appointments.map(async (appointment) => {
              // The patient should already be included in the appointment response
              // as we requested it in our GET_APPOINTMENTS query
              return appointment;
            })
          );

          setNurseAppointments(appointmentsWithDetails);
        }
      } catch (err) {
        console.error("Error fetching appointments:", err);
      }
    };

    fetchAppointments();
  }, [selectedNurse, selectedDate, showAppointments, query]);

  const handleNurseChange = (e) => {
    setSelectedNurse(e.target.value);
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const toggleShowAppointments = () => {
    setShowAppointments(!showAppointments);
  };

  // Find selected nurse data
  const selectedNurseData = nurses.find((nurse) => nurse.id === selectedNurse);

  // Prepare markers for map
  const nurseMarkers = [];
  const patientMarkers = [];

  // Add selected nurse marker if they have a location
  if (selectedNurseData && selectedNurseData.location) {
    nurseMarkers.push({
      id: selectedNurseData.id,
      name: selectedNurseData.name,
      title: selectedNurseData.title || "Nurse",
      location: selectedNurseData.location,
      address: selectedNurseData.location.address || "No address available",
    });
  }

  // Add patient markers if showing appointments
  if (showAppointments && nurseAppointments.length > 0) {
    nurseAppointments.forEach((appointment) => {
      if (appointment.patient && appointment.patient.location) {
        patientMarkers.push({
          id: appointment.patient.id,
          name: appointment.patient.name,
          appointmentTime: new Date(appointment.startTime).toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          ),
          location: appointment.patient.location,
          address:
            appointment.patient.location.address || "No address available",
        });
      }
    });
  }

  if (loading)
    return <div className="loading-container">Loading nurses data...</div>;

  if (error)
    return <div className="error-container">Error loading data: {error}</div>;

  return (
    <div className="nurse-map-container">
      <div className="map-controls">
        <div className="control-group">
          <label htmlFor="nurseSelect">Select Nurse:</label>
          <select
            id="nurseSelect"
            value={selectedNurse || ""}
            onChange={handleNurseChange}
            className="nurse-select"
          >
            <option value="">-- Select a Nurse --</option>
            {nurses.map((nurse) => (
              <option key={nurse.id} value={nurse.id}>
                {nurse.name} - {nurse.specialty || "General"}
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
            Show Patient Appointments
          </label>
        </div>
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

          {/* Nurse markers */}
          {nurseMarkers.map((nurse) => (
            <Marker
              key={`nurse-${nurse.id}`}
              position={[nurse.location.lat, nurse.location.lng]}
              icon={nurseIcon}
            >
              <Popup>
                <div className="marker-popup">
                  <h3>{nurse.name}</h3>
                  <p>{nurse.title}</p>
                  <p>{nurse.address}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Patient markers */}
          {patientMarkers.map((patient, index) => (
            <Marker
              key={`patient-${patient.id}-${index}`}
              position={[patient.location.lat, patient.location.lng]}
              icon={patientIcon}
            >
              <Popup>
                <div className="marker-popup">
                  <h3>{patient.name}</h3>
                  <p>Appointment: {patient.appointmentTime}</p>
                  <p>{patient.address}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {selectedNurseData && (
        <div className="nurse-info-panel">
          <h3>{selectedNurseData.name}</h3>
          <p>
            <strong>Specialty:</strong>{" "}
            {selectedNurseData.specialty || "General"}
          </p>
          <p>
            <strong>Email:</strong> {selectedNurseData.email}
          </p>
          <p>
            <strong>Phone:</strong> {selectedNurseData.phoneNumber}
          </p>

          {showAppointments && (
            <div className="appointments-list">
              <h4>Appointments for {selectedDate}</h4>
              {nurseAppointments.length === 0 ? (
                <p>No appointments scheduled for this date.</p>
              ) : (
                <ul>
                  {nurseAppointments.map((appointment) => (
                    <li key={appointment.id}>
                      <p>
                        <strong>
                          {new Date(appointment.startTime).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </strong>{" "}
                        - {appointment.patient?.name || "Unknown Patient"}
                      </p>
                      <p className="appointment-services">
                        {appointment.careServices?.join(", ") || "General care"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NurseLocationMap;
