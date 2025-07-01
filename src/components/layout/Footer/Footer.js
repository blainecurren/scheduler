import React from "react";
import "./Footer.css";

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p>
          &copy; {new Date().getFullYear()} Nurse Scheduler - Optimize nurse
          visit schedules
        </p>
      </div>
    </footer>
  );
};

export default Footer;
