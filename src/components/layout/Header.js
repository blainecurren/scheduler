import React from "react";
import { NavLink } from "react-router-dom";
import "./Header.css";

const Header = () => {
  return (
    <header className="app-header">
      <div className="logo-container">
        <NavLink to="/" className="logo">
          <h1>Nurse Scheduler</h1>
        </NavLink>
      </div>
      <nav className="main-nav">
        <ul>
          <li>
            <NavLink
              to="/"
              className={({ isActive }) => (isActive ? "active" : "")}
              end
            >
              Schedule
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/nurses"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Nurses
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/patients"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Patients
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/appointments"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Appointments
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/map"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Map
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/routes"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Routes
            </NavLink>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;
