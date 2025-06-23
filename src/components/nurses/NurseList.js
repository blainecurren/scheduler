// src/components/nurses/NurseList.js
import React from "react";
import { useQuery } from "@apollo/client";
import { GET_ALL_NURSES } from "../../services/graphql/queries";
import "./NurseList.css";

const NurseList = () => {
  const { loading, error, data } = useQuery(GET_ALL_NURSES);

  if (loading) return <div className="loading">Loading nurses...</div>;
  if (error)
    return <div className="error">Error loading nurses: {error.message}</div>;

  const nurses = data?.nurses || [];

  return (
    <div className="nurse-list">
      <div className="list-header">
        <h2>Nurses ({nurses.length})</h2>
        <button className="add-button">+ Add Nurse</button>
      </div>

      <div className="nurse-grid">
        {nurses.length === 0 ? (
          <div className="no-data">
            <p>
              No nurses found. Make sure your GraphQL server is running and data
              is synced.
            </p>
          </div>
        ) : (
          nurses.map((nurse) => (
            <div key={nurse.id} className="nurse-card">
              <div className="nurse-header">
                <h3>{nurse.name}</h3>
                <span
                  className={`status ${nurse.available ? "available" : "busy"}`}
                >
                  {nurse.available ? "Available" : "Busy"}
                </span>
              </div>
              <div className="nurse-info">
                <p className="nurse-title">
                  {nurse.title || "Registered Nurse"}
                </p>
                <p className="nurse-specialty">
                  Specialty: {nurse.specialty || "General Care"}
                </p>
                <p className="patient-count">
                  Patients: {nurse.currentPatientCount || 0}/
                  {nurse.maxPatients || 10}
                </p>
                <div className="contact-info">
                  {nurse.email && <p>📧 {nurse.email}</p>}
                  {nurse.phone && <p>📱 {nurse.phone}</p>}
                  {nurse.address && <p>📍 {nurse.address}</p>}
                </div>
              </div>
              <div className="nurse-actions">
                <button className="view-schedule">View Schedule</button>
                <button className="edit-button">Edit</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NurseList;
