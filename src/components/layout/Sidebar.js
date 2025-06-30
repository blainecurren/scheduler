import React, { useState, useEffect } from "react";
import useAPIClient from "../../hooks/apiClient";
import "./Sidebar.css";

const Sidebar = () => {
  const [nurses, setNurses] = useState([]);
  const [selectedNurse, setSelectedNurse] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [routeOption, setRouteOption] = useState("optimized");
  const [stats, setStats] = useState({
    total: 0,
    byStatus: {},
    byNurse: [],
  });

  const { loading, error, getFilterOptions, getStats, clearError } =
    useAPIClient();

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
        if (statsData) {
          setStats(statsData);
        }
      } catch (err) {
        console.error("Error loading sidebar data:", err);
      }
    };

    loadData();
  }, [getFilterOptions, getStats, clearError]);

  // Calculate statistics for the selected date and nurse
  const calculateStats = () => {
    // Default values
    let totalVisits = 0;
    let totalDistance = 0;
    let estimatedTime = 0;

    // If a nurse is selected, show their stats
    if (selectedNurse && stats.byNurse) {
      const nurseStats = stats.byNurse.find((n) => n.nurseId === selectedNurse);
      if (nurseStats) {
        totalVisits = nurseStats.count || 0;
      }
    } else {
      // Show total stats for all nurses
      totalVisits = stats.total || 0;
    }

    // TODO: These would come from route optimization service
    // For now, we'll estimate based on visit count
    totalDistance = (totalVisits * 5.2).toFixed(1); // Estimate 5.2 miles per visit
    estimatedTime = totalVisits * 45; // Estimate 45 minutes per visit

    return {
      totalVisits,
      totalDistance,
      estimatedTime,
    };
  };

  const handleApplyFilters = () => {
    // Emit an event or call a callback to update the main view
    // This would typically be handled by a state management solution
    // or passed as a prop from the parent component
    console.log("Apply filters:", {
      nurse: selectedNurse,
      date: selectedDate,
      routeOption,
    });

    // You might want to trigger a refresh of the main content here
    // by calling a callback prop or using context/state management
  };

  const handleReset = () => {
    setSelectedNurse("");
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setRouteOption("optimized");
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const { totalVisits, totalDistance, estimatedTime } = calculateStats();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-section">
        <h3>Filter Options</h3>

        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
            <button onClick={clearError} className="error-dismiss">
              ×
            </button>
          </div>
        )}

        <div className="filter-section">
          <label htmlFor="nurseSelect">Select Nurse:</label>
          <select
            id="nurseSelect"
            className="select-dropdown"
            value={selectedNurse}
            onChange={(e) => setSelectedNurse(e.target.value)}
            disabled={loading}
          >
            <option value="">All Nurses</option>
            {nurses.map((nurse) => (
              <option key={nurse.id} value={nurse.id}>
                {nurse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-section">
          <label htmlFor="dateSelect">Select Date:</label>
          <input
            type="date"
            id="dateSelect"
            className="date-picker"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="filter-section">
          <label htmlFor="routeSelect">Route Options:</label>
          <select
            id="routeSelect"
            className="select-dropdown"
            value={routeOption}
            onChange={(e) => setRouteOption(e.target.value)}
          >
            <option value="optimized">Optimized Schedule</option>
            <option value="fastest">Fastest Route</option>
            <option value="shortest">Shortest Distance</option>
          </select>
        </div>

        <div className="filter-section actions">
          <button
            className="btn btn-primary"
            onClick={handleApplyFilters}
            disabled={loading}
          >
            Apply Filters
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Statistics</h3>
        {loading ? (
          <div className="loading-stats">Loading stats...</div>
        ) : (
          <>
            <div className="stat-item">
              <span className="stat-label">Total Visits:</span>
              <span className="stat-value">{totalVisits}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Distance:</span>
              <span className="stat-value">{totalDistance} miles</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Estimated Time:</span>
              <span className="stat-value">{formatTime(estimatedTime)}</span>
            </div>
            {selectedNurse && (
              <div className="stat-item">
                <span className="stat-label">Status:</span>
                <span className="stat-value">
                  {stats.byStatus?.fulfilled || 0} completed
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Additional stats section */}
      {stats.total > 0 && (
        <div className="sidebar-section">
          <h3>Quick Stats</h3>
          <div className="stat-item">
            <span className="stat-label">Total Appointments:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          {stats.byStatus && Array.isArray(stats.byStatus) ? (
            <>
              {stats.byStatus.map((statusItem) => (
                <div key={statusItem.status} className="stat-item">
                  <span className="stat-label">{statusItem.status}:</span>
                  <span className="stat-value">{statusItem.count}</span>
                </div>
              ))}
            </>
          ) : stats.byStatus && typeof stats.byStatus === "object" ? (
            <>
              {Object.entries(stats.byStatus).map(([status, value]) => (
                <div key={status} className="stat-item">
                  <span className="stat-label">{status}:</span>
                  <span className="stat-value">
                    {typeof value === "object" ? value.count : value}
                  </span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
