import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header = () => {
  return (
    <header className="app-header">
      <div className="logo-container">
        <Link to="/" className="logo">
          <h1>Nurse Scheduler</h1>
        </Link>
      </div>
      <nav className="main-nav">
        <ul>
          <li>
            <Link to="/">Schedule</Link>
          </li>
          <li>
            <Link to="/nurses">Nurses</Link>
          </li>
          <li>
            <Link to="/patients">Patients</Link>
          </li>
          <li>
            <Link to="/appointments">Appointments</Link>
          </li>
          <li>
            <Link to="/map" className="active">Map</Link>
          </li>
          <li>
            <Link to="/routes">Routes</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;