import React, { useState, useEffect } from "react";
import { useNurseSelection } from "../../../contexts/NurseSelectionContext";
import "./Sidebar.css";

const Sidebar = () => {
  const { updateSelectedNurses, updateSelectedDate, updateSelectedStatus } =
    useNurseSelection();

  // Check if updateSelectedStatus is available (for backward compatibility)
  const hasStatusSupport = typeof updateSelectedStatus === "function";

  // Use today's date as the fixed date
  const todayDate = new Date().toISOString().split("T")[0];

  const [nurses, setNurses] = useState([]);
  const [selectedNurses, setSelectedNurses] = useState([]);
  const [showNurseDropdown, setShowNurseDropdown] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("booked"); // Default to "booked"
  const [availableStatuses, setAvailableStatuses] = useState([]);
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

      // Load nurses and statuses from filter options
      const options = await getFilterOptions();
      if (options?.nurses) {
        setNurses(options.nurses);
      }
      if (options?.statuses) {
        setAvailableStatuses(options.statuses);
        // If current selected status is not in available statuses, set to first available or "booked"
        if (!options.statuses.includes(selectedStatus)) {
          const defaultStatus = options.statuses.includes("booked")
            ? "booked"
            : options.statuses[0] || "booked";
          setSelectedStatus(defaultStatus);
          if (hasStatusSupport) {
            updateSelectedStatus(defaultStatus);
          }
        }
      }

      // Load overall stats
      const statsData = await getStats();
      setStats(statsData);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Handle nurse selection
  const handleNurseToggle = (nurseId) => {
    setSelectedNurses((prev) => {
      const updated = prev.includes(nurseId)
        ? prev.filter((id) => id !== nurseId)
        : [...prev, nurseId];
      updateSelectedNurses(updated);
      return updated;
    });
  };

  // Handle status change
  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setSelectedStatus(newStatus);
    if (hasStatusSupport) {
      updateSelectedStatus(newStatus);
    }
  };

  // Generate routes
  const handleGenerateRoutes = async () => {
    if (selectedNurses.length === 0) {
      alert("Please select at least one nurse");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        "http://localhost:3001/api/routing/optimize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nurseIds: selectedNurses,
            date: todayDate, // Always use today's date
            status: selectedStatus, // Include status filter
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate routes");
      }

      const result = await response.json();
      console.log("Routes generated:", result);
      alert(
        `Successfully generated ${result.successfulRoutes} optimized routes!`
      );
    } catch (err) {
      console.error("Error generating routes:", err);
      alert("Failed to generate routes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Full setup handler
  const handleFullSetup = async () => {
    setIsSetupRunning(true);
    setSetupLogs([]);
    setShowSetupLogs(true);

    const addLog = (message) => {
      setSetupLogs((prev) => [
        ...prev,
        `${new Date().toLocaleTimeString()}: ${message}`,
      ]);
    };

    try {
      // Step 1: Sync appointments
      addLog("Starting appointment sync from HCHB...");
      setSetupStatus("Syncing appointments...");

      const syncResponse = await fetch(
        "http://localhost:3001/api/appointments/sync",
        {
          method: "POST",
        }
      );

      if (!syncResponse.ok) {
        throw new Error("Failed to sync appointments");
      }

      const syncResult = await syncResponse.json();
      addLog(
        `✅ Synced ${syncResult.data?.totalAppointments || 0} appointments`
      );

      // Step 2: Geocode addresses
      addLog("Starting geocoding of nurse addresses...");
      setSetupStatus("Geocoding addresses...");

      const geocodeResponse = await fetch(
        "http://localhost:3001/api/coordinates/geocode",
        {
          method: "POST",
        }
      );

      if (!geocodeResponse.ok) {
        throw new Error("Failed to geocode addresses");
      }

      const geocodeResult = await geocodeResponse.json();
      addLog(`✅ Geocoded ${geocodeResult.data?.totalGeocoded || 0} addresses`);

      // Step 3: Reload data
      addLog("Reloading filter options and stats...");
      setSetupStatus("Loading updated data...");
      await loadData();

      addLog("✅ Setup completed successfully!");
      setSetupStatus("Setup complete!");

      setTimeout(() => {
        setSetupStatus("");
      }, 3000);
    } catch (error) {
      console.error("Setup error:", error);
      addLog(`❌ Error: ${error.message}`);
      setSetupStatus("Setup failed");
    } finally {
      setIsSetupRunning(false);
    }
  };

  return (
    <div className="sidebar">
      <h2>Route Planning</h2>
      <p className="today-date">
        Today:{" "}
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={clearError}>×</button>
        </div>
      )}

      {/* Nurse Selection */}
      <div className="sidebar-section">
        <h3>Select Nurses ({selectedNurses.length})</h3>
        <div className="nurse-dropdown">
          <button
            className="dropdown-toggle"
            onClick={() => setShowNurseDropdown(!showNurseDropdown)}
          >
            {selectedNurses.length === 0
              ? "Choose nurses..."
              : `${selectedNurses.length} selected`}
          </button>
          {showNurseDropdown && (
            <div className="dropdown-content">
              {nurses.map((nurse) => (
                <label key={nurse.id} className="nurse-option">
                  <input
                    type="checkbox"
                    checked={selectedNurses.includes(nurse.id)}
                    onChange={() => handleNurseToggle(nurse.id)}
                  />
                  <span>{nurse.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Filter */}
      <div className="sidebar-section">
        <h3>Appointment Status</h3>
        <select
          value={selectedStatus}
          onChange={handleStatusChange}
          className="status-select"
        >
          {availableStatuses.length > 0 ? (
            availableStatuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))
          ) : (
            <option value="booked">Booked</option>
          )}
        </select>
      </div>

      {/* Generate Routes Button */}
      <button
        className={`generate-btn ${loading ? "loading" : ""}`}
        onClick={handleGenerateRoutes}
        disabled={loading || selectedNurses.length === 0}
      >
        {loading ? "Generating..." : "Generate Optimized Routes"}
      </button>

      {/* Stats Section */}
      <div className="sidebar-section stats-section">
        <h3>Statistics</h3>
        <div className="stats">
          <div className="stat-item">
            <span className="stat-label">Total Appointments:</span>
            <span className="stat-value">{stats.total || 0}</span>
          </div>
          {stats.byStatus &&
            Array.isArray(stats.byStatus) &&
            stats.byStatus.map((item) => (
              <div key={item.status} className="stat-item">
                <span className="stat-label">{item.status || "Unknown"}:</span>
                <span className="stat-value">{item.count || 0}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Setup Section */}
      <div className="sidebar-section setup-section">
        <h3>Setup & Sync</h3>
        <button
          className="setup-btn"
          onClick={handleFullSetup}
          disabled={isSetupRunning}
        >
          {isSetupRunning ? setupStatus : "Run Full Setup"}
        </button>

        {showSetupLogs && (
          <div className="setup-logs">
            <div className="logs-header">
              <span>Setup Logs</span>
              <button onClick={() => setShowSetupLogs(false)}>×</button>
            </div>
            <div className="logs-content">
              {setupLogs.map((log, index) => (
                <div key={index} className="log-entry">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
