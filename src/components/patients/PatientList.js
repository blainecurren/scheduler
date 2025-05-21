import React, { useState, useEffect } from "react";
import "./PatientList.css";

const PatientList = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mock patients data (in a real app, this would come from an API)
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockPatients = [
        {
          id: "patient1",
          name: "Robert Johnson",
          phoneNumber: "512-555-1111",
          email: "robert.johnson@example.com",
          careNeeds: ["Medication Management", "Blood Pressure Monitoring"],
          medicalNotes:
            "Patient has history of hypertension and requires regular BP monitoring.",
          address: "101 E 15th St, Austin, TX 78701",
        },
        {
          id: "patient2",
          name: "Sarah Miller",
          phoneNumber: "512-555-2222",
          email: "sarah.miller@example.com",
          careNeeds: ["Wound Care", "Physical Therapy"],
          medicalNotes:
            "Patient recovering from hip replacement surgery. Needs assistance with wound care and physical therapy.",
          address: "4501 Spicewood Springs Rd, Austin, TX 78759",
        },
        {
          id: "patient3",
          name: "David Wilson",
          phoneNumber: "512-555-3333",
          email: "david.wilson@example.com",
          careNeeds: ["Diabetes Management", "Insulin Administration"],
          medicalNotes:
            "Patient has Type 1 diabetes and requires insulin administration. Also needs help with glucose monitoring.",
          address: "1000 W 45th St, Austin, TX 78756",
        },
      ];

      setPatients(mockPatients);
      setLoading(false);
    }, 1000);
  }, []);

  // Handler for selecting a patient to view more details
  const handleViewDetails = (patientId) => {
    console.log("View details for patient:", patientId);
    // This would open a modal or navigate to a detail page
  };

  if (loading) return <div className="loading">Loading patients...</div>;

  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="patient-list-container">
      <div className="list-header">
        <h2>Patients</h2>
        <button className="btn btn-primary">+ Add Patient</button>
      </div>

      {patients.length === 0 ? (
        <p>No patients found</p>
      ) : (
        <div className="patient-list">
          {patients.map((patient) => (
            <div key={patient.id} className="patient-card">
              <div className="patient-card-header">
                <h3>{patient.name}</h3>
              </div>
              <div className="patient-card-body">
                <div className="patient-contact">
                  <p>
                    <strong>Email:</strong> {patient.email}
                  </p>
                  <p>
                    <strong>Phone:</strong> {patient.phoneNumber}
                  </p>
                  <p>
                    <strong>Address:</strong> {patient.address}
                  </p>
                </div>
                <div className="patient-medical">
                  <h4>Care Needs</h4>
                  <ul className="care-needs-list">
                    {patient.careNeeds.map((need, index) => (
                      <li key={index}>{need}</li>
                    ))}
                  </ul>
                  <h4>Medical Notes</h4>
                  <p className="medical-notes">{patient.medicalNotes}</p>
                </div>
              </div>
              <div className="patient-card-actions">
                <button
                  onClick={() => handleViewDetails(patient.id)}
                  className="btn btn-secondary"
                >
                  View Details
                </button>
                <button className="btn btn-primary">
                  Schedule Appointment
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientList;
