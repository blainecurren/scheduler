// src/components/patients/PatientList.js
import React, { useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_ALL_PATIENTS } from "../../services/graphql/queries";
import "./PatientList.css";

const PatientList = () => {
  const { loading, error, data } = useQuery(GET_ALL_PATIENTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCareLevel, setFilterCareLevel] = useState("");

  if (loading) return <div className="loading">Loading patients...</div>;
  if (error)
    return <div className="error">Error loading patients: {error.message}</div>;

  const patients = data?.patients || [];

  // Filter patients based on search and care level
  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCareLevel =
      !filterCareLevel || patient.careLevel === filterCareLevel;
    return matchesSearch && matchesCareLevel;
  });

  return (
    <div className="patient-list">
      <div className="list-header">
        <h2>Patients ({filteredPatients.length})</h2>
        <button className="add-button">+ Add Patient</button>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search patients..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={filterCareLevel}
          onChange={(e) => setFilterCareLevel(e.target.value)}
        >
          <option value="">All Care Levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="no-data">
          <p>
            No patients found.{" "}
            {patients.length === 0
              ? "Make sure your GraphQL server is running and data is synced."
              : "Try adjusting your search filters."}
          </p>
        </div>
      ) : (
        <div className="patient-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Care Level</th>
                <th>Mobility</th>
                <th>Conditions</th>
                <th>Assigned Nurse</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => (
                <tr key={patient.id}>
                  <td>{patient.name}</td>
                  <td>{patient.address}</td>
                  <td>{patient.phone || "N/A"}</td>
                  <td>
                    <span
                      className={`care-level ${patient.careLevel || "medium"}`}
                    >
                      {patient.careLevel || "Medium"}
                    </span>
                  </td>
                  <td>{patient.mobilityLevel || "N/A"}</td>
                  <td>{patient.conditions?.join(", ") || "None"}</td>
                  <td>{patient.assignedNurseId || "Unassigned"}</td>
                  <td>
                    <button className="action-button">View</button>
                    <button className="action-button">Edit</button>
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

export default PatientList;
