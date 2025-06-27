import React, { useState, useEffect } from "react";
import useAPIClient from "../../hooks/apiClient";
import "./NurseList.css";

const NurseList = () => {
  const [nurses, setNurses] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const { 
    loading, 
    error, 
    getFilterOptions, 
    getStats,
    getAppointments,
    clearError 
  } = useAPIClient();

  // Load nurses and stats on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        clearError();
        
        // Load nurses from filter options
        const options = await getFilterOptions();
        if (options?.nurses) {
          setNurses(options.nurses);
        }

        // Load overall stats
        const statsData = await getStats();
        setStats(statsData);

      } catch (err) {
        console.error("Error loading data:", err);
      }
    };

    loadData();
  }, [getFilterOptions, getStats, clearError]);

  // Get nurse schedule for selected date
  const handleViewSchedule = async (nurseId, nurseName) => {
    try {
      const data = await getAppointments({
        nurses: nurseId,
        dateFrom: selectedDate,
        dateTo: selectedDate
      });

      const appointmentCount = data.appointments?.length || 0;
      alert(`${nurseName} has ${appointmentCount} appointments on ${selectedDate}`);
      
      // TODO: Open detailed schedule modal/page
      console.log('Schedule data:', data.appointments);
    } catch (err) {
      console.error('Error fetching nurse schedule:', err);
    }
  };

  const handleEditNurse = (nurseId) => {
    console.log('Edit nurse:', nurseId);
    // TODO: Open edit nurse form
  };

  const handleAddNurse = () => {
    console.log('Add new nurse');
    // TODO: Open add nurse form
  };

  // Get nurse stats from overall stats
  const getNurseStats = (nurseId) => {
    if (!stats?.byNurse) return { count: 0 };
    
    const nurseStats = stats.byNurse.find(n => n.nurseId === nurseId);
    return nurseStats || { count: 0 };
  };

  if (loading && nurses.length === 0) {
    return <div className="loading">Loading nurses...</div>;
  }

  return (
    <div className="nurse-list">
      <div className="list-header">
        <h2>Nurses ({nurses.length})</h2>
        <div className="header-actions">
          <div className="date-selector">
            <label htmlFor="scheduleDate">View Schedule for:</label>
            <input
              type="date"
              id="scheduleDate"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
          </div>
          <button className="add-button" onClick={handleAddNurse}>
            + Add Nurse
          </button>
        </div>
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
            <h4>Total Appointments</h4>
            <span className="stat-number">{stats.total}</span>
          </div>
          <div className="stat-card">
            <h4>Active Nurses</h4>
            <span className="stat-number">{stats.byNurse?.length || 0}</span>
          </div>
          <div className="stat-card">
            <h4>Service Types</h4>
            <span className="stat-number">{stats.byServiceType?.length || 0}</span>
          </div>
        </div>
      )}

      <div className="nurse-grid">
        {nurses.length === 0 ? (
          <div className="no-data">
            <p>
              No nurses found. Make sure your backend is running and data is synced from HCHB.
            </p>
            <button onClick={() => window.location.reload()} className="retry-button">
              🔄 Retry
            </button>
          </div>
        ) : (
          nurses.map((nurse) => {
            const nurseStats = getNurseStats(nurse.id);
            
            return (
              <div key={nurse.id} className="nurse-card">
                <div className="nurse-header">
                  <h3>{nurse.name}</h3>
                  <span className="nurse-id">ID: {nurse.id}</span>
                </div>
                
                <div className="nurse-info">
                  <div className="appointment-stats">
                    <p className="stat-item">
                      <strong>Total Appointments:</strong> {nurseStats.count}
                    </p>
                    <p className="stat-item">
                      <strong>Nurse ID:</strong> {nurse.id}
                    </p>
                  </div>
                </div>

                <div className="nurse-actions">
                  <button 
                    className="view-schedule"
                    onClick={() => handleViewSchedule(nurse.id, nurse.name)}
                    disabled={loading}
                  >
                    {loading ? '...' : `📅 Schedule (${selectedDate})`}
                  </button>
                  <button 
                    className="edit-button"
                    onClick={() => handleEditNurse(nurse.id)}
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Top Nurses by Appointment Count */}
      {stats?.byNurse && stats.byNurse.length > 0 && (
        <div className="top-nurses-section">
          <h3>Top Nurses by Appointment Count</h3>
          <div className="top-nurses-list">
            {stats.byNurse.slice(0, 5).map((nurseStats, index) => (
              <div key={nurseStats.nurseId} className="top-nurse-item">
                <span className="rank">#{index + 1}</span>
                <span className="nurse-name">{nurseStats.nurseName}</span>
                <span className="appointment-count">{nurseStats.count} appointments</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="list-footer">
        <p>
          Showing {nurses.length} nurses • 
          Last updated: {new Date().toLocaleTimeString()}
        </p>
        {stats && (
          <p>
            Total system appointments: {stats.total}
          </p>
        )}
      </div>
    </div>
  );
};

export default NurseList;