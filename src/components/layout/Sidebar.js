import React from 'react';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-section">
        <h3>Filter Options</h3>
        <div className="filter-section">
          <label htmlFor="nurseSelect">Select Nurse:</label>
          <select id="nurseSelect" className="select-dropdown">
            <option value="">All Nurses</option>
            <option value="nurse1">Jane Smith</option>
            <option value="nurse2">John Doe</option>
            <option value="nurse3">Sarah Johnson</option>
          </select>
        </div>
        
        <div className="filter-section">
          <label htmlFor="dateSelect">Select Date:</label>
          <input 
            type="date" 
            id="dateSelect" 
            className="date-picker"
            defaultValue={new Date().toISOString().split('T')[0]}
          />
        </div>
        
        <div className="filter-section">
          <label htmlFor="routeSelect">Route Options:</label>
          <select id="routeSelect" className="select-dropdown">
            <option value="fastest">Fastest Route</option>
            <option value="shortest">Shortest Distance</option>
            <option value="optimized">Optimized Schedule</option>
          </select>
        </div>
        
        <div className="filter-section actions">
          <button className="btn btn-primary">Apply Filters</button>
          <button className="btn btn-secondary">Reset</button>
        </div>
      </div>
      
      <div className="sidebar-section">
        <h3>Statistics</h3>
        <div className="stat-item">
          <span className="stat-label">Total Visits:</span>
          <span className="stat-value">24</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Distance:</span>
          <span className="stat-value">45.3 miles</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Estimated Time:</span>
          <span className="stat-value">4h 30m</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;