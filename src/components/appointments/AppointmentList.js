import React, { useState, useEffect } from 'react';
import './AppointmentList.css';

const AppointmentList = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterNurse, setFilterNurse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Mock nurses data for filter dropdown
  const nurseOptions = [
    { id: 'nurse1', name: 'Jane Smith' },
    { id: 'nurse2', name: 'John Doe' },
    { id: 'nurse3', name: 'Sarah Johnson' },
  ];
  
  // Mock appointments data (in a real app, this would come from an API)
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockAppointments = [
        {
          id: 'appt1',
          patientId: 'patient1',
          patientName: 'Robert Johnson',
          nurseId: 'nurse1',
          nurseName: 'Jane Smith',
          startTime: '2023-08-15T09:00:00-05:00',
          endTime: '2023-08-15T09:30:00-05:00',
          status: 'SCHEDULED',
          notes: 'Regular blood pressure check and medication review',
          careServices: ['Medication Administration'],
          location: {
            address: '101 E 15th St, Austin, TX 78701'
          }
        },
        {
          id: 'appt2',
          patientId: 'patient2',
          patientName: 'Sarah Miller',
          nurseId: 'nurse1',
          nurseName: 'Jane Smith',
          startTime: '2023-08-15T10:30:00-05:00',
          endTime: '2023-08-15T11:15:00-05:00',
          status: 'SCHEDULED',
          notes: 'Post-surgical wound dressing change and assessment',
          careServices: ['Wound Care'],
          location: {
            address: '4501 Spicewood Springs Rd, Austin, TX 78759'
          }
        },
        {
          id: 'appt3',
          patientId: 'patient3',
          patientName: 'David Wilson',
          nurseId: 'nurse1',
          nurseName: 'Jane Smith',
          startTime: '2023-08-15T13:00:00-05:00',
          endTime: '2023-08-15T13:45:00-05:00',
          status: 'SCHEDULED',
          notes: 'Insulin administration and blood glucose monitoring',
          careServices: ['Diabetes Management'],
          location: {
            address: '1000 W 45th St, Austin, TX 78756'
          }
        }
      ];
      
      setAppointments(mockAppointments);
      setLoading(false);
    }, 1000);
  }, []);
  
  // Filter appointments based on criteria
  const filteredAppointments = appointments.filter(appointment => {
    // Date filter
    const appointmentDate = new Date(appointment.startTime).toISOString().split('T')[0];
    if (filterDate && appointmentDate !== filterDate) {
      return false;
    }
    
    // Nurse filter
    if (filterNurse && appointment.nurseId !== filterNurse) {
      return false;
    }
    
    // Status filter
    if (filterStatus && appointment.status !== filterStatus) {
      return false;
    }
    
    return true;
  });
  
  // Format time for display
  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Handle appointment operations
  const handleViewDetails = (appointmentId) => {
    console.log('View details for appointment:', appointmentId);
    // This would open a modal or navigate to a detail page
  };
  
  const handleEditAppointment = (appointmentId) => {
    console.log('Edit appointment:', appointmentId);
    // This would open an edit form
  };
  
  const handleCancelAppointment = (appointmentId) => {
    console.log('Cancel appointment:', appointmentId);
    // This would show a confirmation dialog and then update the status
  };
  
  const handleCompleteAppointment = (appointmentId) => {
    console.log('Complete appointment:', appointmentId);
    // This would show a form for entering completion notes
  };
  
  if (loading) return <div className="loading">Loading appointments...</div>;
  
  if (error) return <div className="error">Error: {error}</div>;
  
  return (
    <div className="appointment-list-container">
      <div className="list-header">
        <h2>Appointments</h2>
        <button className="btn btn-primary">+ New Appointment</button>
      </div>
      
      <div className="filters-container">
        <div className="filter-group">
          <label htmlFor="dateFilter">Date:</label>
          <input
            type="date"
            id="dateFilter"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="filter-control"
          />
        </div>
        
        <div className="filter-group">
          <label htmlFor="nurseFilter">Nurse:</label>
          <select
            id="nurseFilter"
            value={filterNurse}
            onChange={(e) => setFilterNurse(e.target.value)}
            className="filter-control"
          >
            <option value="">All Nurses</option>
            {nurseOptions.map(nurse => (
              <option key={nurse.id} value={nurse.id}>{nurse.name}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="statusFilter">Status:</label>
          <select
            id="statusFilter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-control"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="MISSED">Missed</option>
          </select>
        </div>
      </div>
      
      {filteredAppointments.length === 0 ? (
        <div className="no-results">
          <p>No appointments found for the selected filters.</p>
        </div>
      ) : (
        <div className="appointment-table-container">
          <table className="appointment-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Nurse</th>
                <th>Services</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map(appointment => (
                <tr key={appointment.id} className={`status-${appointment.status.toLowerCase()}`}>
                  <td className="appointment-time">
                    {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                  </td>
                  <td>{appointment.patientName}</td>
                  <td>{appointment.nurseName}</td>
                  <td>{appointment.careServices.join(', ')}</td>
                  <td className="appointment-location">{appointment.location.address}</td>
                  <td className="appointment-status">
                    <span className={`status-badge ${appointment.status.toLowerCase()}`}>
                      {appointment.status}
                    </span>
                  </td>
                  <td className="appointment-actions">
                    <button 
                      onClick={() => handleViewDetails(appointment.id)}
                      className="action-btn view"
                      title="View Details"
                    >
                      View
                    </button>
                    <button 
                      onClick={() => handleEditAppointment(appointment.id)}
                      className="action-btn edit"
                      title="Edit Appointment"
                    >
                      Edit
                    </button>
                    {appointment.status === 'SCHEDULED' && (
                      <>
                        <button 
                          onClick={() => handleCancelAppointment(appointment.id)}
                          className="action-btn cancel"
                          title="Cancel Appointment"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleCompleteAppointment(appointment.id)}
                          className="action-btn complete"
                          title="Complete Appointment"
                        >
                          Complete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AppointmentList;