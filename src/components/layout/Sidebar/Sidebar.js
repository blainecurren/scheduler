import React, { useState, useEffect } from "react";
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

  // Setup button states
  const [isSetupRunning, setIsSetupRunning] = useState(false);
  const [setupStatus, setSetupStatus] = useState("");
  const [showSetupLogs, setShowSetupLogs] = useState(false);
  const [setupLogs, setSetupLogs] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // API helper functions
  const getFilterOptions = async () => {
    try {
      const response = await fetch(
        "http://localhost:3001/api/appointments/options"
      );
      if (!response.ok) throw new Error("Failed to fetch options");
      return await response.json();
    } catch (err) {
      throw err;
    }
  };

  const getStats = async () => {
    try {
      const response = await fetch(
        "http://localhost:3001/api/appointments/stats"
      );
      if (!response.ok) throw new Error("Failed to fetch stats");
      return await response.json();
    } catch (err) {
      throw err;
    }
  };

  const clearError = () => setError(null);

  // Function to load data
  const loadData = async () => {
    try {
      setLoading(true);
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load nurses and stats on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Setup functions
  const addSetupLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setSetupLogs((prev) => [...prev, { message, type, timestamp }]);
  };

  const runFullSetup = async () => {
    setIsSetupRunning(true);
    setSetupLogs([]);
    setShowSetupLogs(true);

    try {
      // Step 1: Sync appointments from HCHB
      addSetupLog("Starting HCHB appointment sync...", "info");
      setSetupStatus("Syncing appointments...");

      const syncResponse = await fetch(
        "http://localhost:3001/api/appointments/sync",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!syncResponse.ok) {
        throw new Error(`Sync failed: ${syncResponse.statusText}`);
      }

      const syncResult = await syncResponse.json();

      if (syncResult.success) {
        addSetupLog(
          `✅ Synced ${syncResult.appointmentCount} appointments`,
          "success"
        );
      } else {
        throw new Error(syncResult.error || "Sync failed");
      }

      // Brief pause between steps
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 2: Geocode nurse addresses
      addSetupLog("Starting nurse address geocoding...", "info");
      setSetupStatus("Geocoding addresses...");

      const geocodeResponse = await fetch(
        "http://localhost:3001/api/coordinates/geocode",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!geocodeResponse.ok) {
        throw new Error(`Geocoding failed: ${geocodeResponse.statusText}`);
      }

      const geocodeResult = await geocodeResponse.json();

      if (geocodeResult.success) {
        addSetupLog(
          `✅ Geocoded ${geocodeResult.data.successCount} addresses`,
          "success"
        );
        if (geocodeResult.data.failedCount > 0) {
          addSetupLog(
            `⚠️ Failed to geocode ${geocodeResult.data.failedCount} addresses`,
            "warning"
          );
        }
      } else {
        throw new Error(geocodeResult.error || "Geocoding failed");
      }

      addSetupLog("🎉 Setup complete! Ready for routing.", "success");
      setSetupStatus("Setup complete!");

      // Reload data after setup
      await loadData();
    } catch (err) {
      console.error("Setup error:", err);
      addSetupLog(`❌ Error: ${err.message}`, "error");
      setSetupStatus("Setup failed");
    } finally {
      setIsSetupRunning(false);
    }
  };

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

      {/* System Setup Section */}
      <div className="sidebar-section">
        <h3>System Setup</h3>
        <div className="setup-container">
          <button
            className={`btn btn-setup ${isSetupRunning ? "running" : ""}`}
            onClick={runFullSetup}
            disabled={isSetupRunning}
          >
            {isSetupRunning ? "⏳ Running Setup..." : "🚀 Run Initial Setup"}
          </button>

          {setupStatus && <div className="setup-status">{setupStatus}</div>}

          {showSetupLogs && setupLogs.length > 0 && (
            <div className="setup-logs">
              {setupLogs.map((log, index) => (
                <div key={index} className={`log-entry log-${log.type}`}>
                  <span className="log-timestamp">[{log.timestamp}]</span>{" "}
                  {log.message}
                </div>
              ))}
            </div>
          )}

          <p className="setup-info">
            This will sync appointments from HCHB and geocode nurse addresses.
            Required before route optimization.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
