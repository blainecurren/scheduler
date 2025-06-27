import React, { useState, useEffect } from 'react';
import useAPIClient from '../../hooks/apiClient.js';
import './AppointmentList.css';

const AppointmentList = () => {
  const [appointments, setAppointments] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    nurses: [],
    patients: [],
    statuses: []
  });
  const [filters, setFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0],
    nurses: '',
    statuses: 'fulfilled'
  });
  
  const { 
    loading, 
    error, 
    getAppointments, 
    getFilterOptions,
    clearError 
  } = useAPIClient();

  // Load filter options on component mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const options = await getFilterOptions();
        setFilterOptions(options);
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    };

    loadFilterOptions();
  }, [getFilterOptions]);

  // Load appointments when filters change
  useEffect(() => {
    const loadAppointments = async () => {
      try {
        clearError();
        
        // Build filter parameters
        const filterParams = {};
        
        if (filters.dateFrom) {
          filterParams.dateFrom = filters.dateFrom;
          filterParams.dateTo = filters.dateFrom; // Same day
        }
        
        if (filters.nurses) {
          filterParams.nurses = filters.nurses;
        }
        
        if (filters.statuses) {
          filterParams.statuses = filters.statuses;
        }

        const data = await getAppointments(filterParams);
        setAppointments(data.appointments || []);
      } catch (err) {
        console.error('Error loading appointments:', err);
      }
    };

    loadAppointments();
  }, [filters, getAppointments, clearError]);

  // Handle filter changes
  const handleDateChange = (e) => {
    setFilters(prev => ({ ...prev, dateFrom: e.target.value }));
  };

  const handleNurseChange = (e) => {
    setFilters(prev => ({ ...prev, nurses: e.target.value }));
  };

  const handleStatusChange = (e) => {
    setFilters(prev => ({ ...prev, statuses: e.target.value }));
  };

  // Format time for display
  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      // Handle different date formats from HCHB
      let date;
      if (dateString.includes('/')) {
        // Format: "06/27/2025 10:30:00" 
        date = new Date(dateString);
      } else {
        // ISO format
        date = new Date(dateString);
      }
      
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return dateString;
    }
  };

  // Handle appointment actions
  const handleViewDetails = (appointmentId) => {
    console.log('View details for appointment:', appointmentId);
    // TODO: Open appointment details modal
  };

  const handleEditAppointment = (appointmentId) => {
    console.log('Edit appointment:', appointmentId);
    // TODO: Open edit appointment form
  };

  const handleGenerateRoute = () => {
    console.log('Generate route for selected appointments');
    // TODO: Navigate to route planning page
  };

  if (loading) return <div className="loading">Loading appointments...</div>;

  return (
    <div className="appointment-list-container">
      <div className="list-header">
        <h2>Appointments ({appointments.length})</h2>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleGenerateRoute}>
            🗺️ Generate Route
          </button>
          <button className="btn btn-primary">+ New Appointment</button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <p>⚠️ Error: {error}</p>
          <button onClick={clearError} className="error-dismiss">×</button>
        </div>
      )}

      <div className="filters-container">
        <div className="filter-group">
          <label htmlFor="dateFilter">Date:</label>
          <input
            type="date"
            id="dateFilter"
            value={filters.dateFrom}
            onChange={handleDateChange}
            className="filter-control"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="nurseFilter">Nurse:</label>
          <select
            id="nurseFilter"
            value={filters.nurses}
            onChange={handleNurseChange}
            className="filter-control"
          >
            <option value="">All Nurses</option>
            {filterOptions.nurses.map(nurse => (
              <option key={nurse.id} value={nurse.id}>
                {nurse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="statusFilter">Status:</label>
          <select
            id="statusFilter"
            value={filters.statuses}
            onChange={handleStatusChange}
            className="filter-control"
          >
            <option value="">All Statuses</option>
            {filterOptions.statuses.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className="no-results">
          <p>No appointments found for the selected filters.</p>
          <p>Try adjusting your filters or sync data from HCHB.</p>
        </div>
      ) : (
        <div className="appointment-table-container">
          <table className="appointment-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Nurse</th>
                <th>Service</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(appointment => (
                <tr key={appointment.id} className={`status-${appointment.status?.toLowerCase()}`}>
                  <td className="appointment-time">
                    {formatTime(appointment.startDate)}
                  </td>
                  <td>
                    <div className="patient-info">
                      <strong>{appointment.patientName || 'Unknown Patient'}</strong>
                      <small>{appointment.patientId}</small>
                    </div>
                  </td>
                  <td>
                    <div className="nurse-info">
                      <strong>{appointment.nurseName || 'Unassigned'}</strong>
                      <small>{appointment.nurseId}</small>
                    </div>
                  </td>
                  <td>
                    <div className="service-info">
                      <strong>{appointment.serviceType}</strong>
                      <small>{appointment.serviceCode}</small>
                    </div>
                  </td>
                  <td className="appointment-location">
                    <div className="location-info">
                      <strong>{appointment.locationName}</strong>
                      <small>{appointment.locationAddress}</small>
                    </div>
                  </td>
                  <td className="appointment-status">
                    <span className={`status-badge ${appointment.status?.toLowerCase()}`}>
                      {appointment.status}
                    </span>
                  </td>
                  <td className="appointment-actions">
                    <button 
                      onClick={() => handleViewDetails(appointment.id)}
                      className="action-btn view"
                      title="View Details"
                    >
                      👁️
                    </button>
                    <button 
                      onClick={() => handleEditAppointment(appointment.id)}
                      className="action-btn edit"
                      title="Edit Appointment"
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="list-footer">
        <p>Showing {appointments.length} appointments</p>
        <p>Last updated: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
};

export default AppointmentList;