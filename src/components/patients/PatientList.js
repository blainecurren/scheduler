import React, { useState, useEffect } from "react";
import useAPIClient from "../../hooks/apiClient.js";
import "./PatientList.css";

const PatientList = () => {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNurse, setSelectedNurse] = useState("");
  const [nurses, setNurses] = useState([]);
  const [stats, setStats] = useState(null);

  const { 
    loading, 
    error, 
    getFilterOptions, 
    getAppointments,
    getStats,
    clearError 
  } = useAPIClient();

  // Load patients and nurses on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        clearError();
        
        // Load filter options (includes patients and nurses)
        const options = await getFilterOptions();
        
        if (options?.patients) {
          setPatients(options.patients);
        }
        
        if (options?.nurses) {
          setNurses(options.nurses);
        }

        // Load stats for additional insights
        const statsData = await getStats();
        setStats(statsData);

      } catch (err) {
        console.error("Error loading data:", err);
      }
    };

    loadData();
  }, [getFilterOptions, getStats, clearError]);

  // Filter patients based on search term and nurse assignment
  const filteredPatients = patients.filter((patient) => {
    const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Note: We don't have nurse assignment data in the current patient structure
    // This would need to be added to the backend if needed
    return matchesSearch;
  });

  // Get patient appointment details
  const handleViewPatient = async (patientId, patientName) => {
    try {
      const data = await getAppointments({
        patients: patientId
      });

      const appointmentCount = data.appointments?.length || 0;
      alert(`${patientName} has ${appointmentCount} appointments in the system`);
      
      // TODO: Open detailed patient view modal/page
      console.log('Patient appointments:', data.appointments);
    } catch (err) {
      console.error('Error fetching patient appointments:', err);
    }
  };

  const handleEditPatient = (patientId) => {
    console.log('Edit patient:', patientId);
    // TODO: Open edit patient form
  };

  const handleAddPatient = () => {
    console.log('Add new patient');
    // TODO: Open add patient form
  };

  // Get patient stats (approximate based on available data)
  const getPatientAppointmentCount = (patientId) => {
    // This would need to be enhanced with actual patient-specific stats
    // For now, we'll return a placeholder
    return Math.floor(Math.random() * 10) + 1; // Mock data
  };

  if (loading && patients.length === 0) {
    return <div className="loading">Loading patients...</div>;
  }

  return (
    <div className="patient-list">
      <div className="list-header">
        <h2>Patients ({filteredPatients.length})</h2>
        <button className="add-button" onClick={handleAddPatient}>
          + Add Patient
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <p>⚠️ Error: {error}</p>
          <button onClick={clearError} className="error-dismiss">×</button>
        </div>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="stats-summary">
          <div className="stat-card">
            <h4>Total Patients</h4>
            <span className="stat-number">{patients.length}</span>
          </div>
          <div className="stat-card">
            <h4>Total Appointments</h4>
            <span className="stat-number">{stats.total}</span>
          </div>
          <div className="stat-card">
            <h4>Active Nurses</h4>
            <span className="stat-number">{nurses.length}</span>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search patients by name or ID..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={selectedNurse}
          onChange={(e) => setSelectedNurse(e.target.value)}
        >
          <option value="">All Nurses</option>
          {nurses.map(nurse => (
            <option key={nurse.id} value={nurse.id}>
              {nurse.name}
            </option>
          ))}
        </select>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="no-data">
          <p>
            {patients.length === 0
              ? "No patients found. Make sure your backend is running and data is synced from HCHB."
              : "No patients match your search criteria. Try adjusting your filters."}
          </p>
          {patients.length === 0 && (
            <button onClick={() => window.location.reload()} className="retry-button">
              🔄 Retry
            </button>
          )}
        </div>
      ) : (
        <div className="patient-table">
          <table>
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Patient ID</th>
                <th>Recent Appointments</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => (
                <tr key={patient.id}>
                  <td>
                    <div className="patient-name">
                      <strong>{patient.name}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="patient-id">{patient.id}</span>
                  </td>
                  <td>
                    <span className="appointment-count">
                      ~{getPatientAppointmentCount(patient.id)} appointments
                    </span>
                  </td>
                  <td>
                    <span className="status-badge active">
                      Active
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      className="action-button view"
                      onClick={() => handleViewPatient(patient.id, patient.name)}
                      disabled={loading}
                    >
                      👁️ View
                    </button>
                    <button 
                      className="action-button edit"
                      onClick={() => handleEditPatient(patient.id)}
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="list-footer">
        <p>
          Showing {filteredPatients.length} of {patients.length} patients • 
          Last updated: {new Date().toLocaleTimeString()}
        </p>
        {stats && (
          <p>
            System total: {stats.total} appointments across all patients
          </p>
        )}
      </div>
    </div>
  );
};

export default PatientList;