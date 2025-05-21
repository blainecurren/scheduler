import React, { useState, useEffect } from 'react';
import './NurseList.css';

const NurseList = () => {
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Mock nurses data (in a real app, this would come from an API)
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockNurses = [
        {
          id: 'nurse1',
          name: 'Jane Smith',
          title: 'Registered Nurse',
          specialty: 'Cardiology',
          phoneNumber: '512-555-1234',
          email: 'jane.smith@example.com',
        },
        {
          id: 'nurse2',
          name: 'John Doe',
          title: 'Registered Nurse',
          specialty: 'Geriatrics',
          phoneNumber: '512-555-5678',
          email: 'john.doe@example.com',
        },
        {
          id: 'nurse3',
          name: 'Sarah Johnson',
          title: 'Registered Nurse',
          specialty: 'Pediatrics',
          phoneNumber: '512-555-9012',
          email: 'sarah.johnson@example.com',
        }
      ];
      
      setNurses(mockNurses);
      setLoading(false);
    }, 1000);
  }, []);
  
  // Handler for selecting a nurse to view more details
  const handleViewDetails = (nurseId) => {
    console.log('View details for nurse:', nurseId);
    // This would open a modal or navigate to a detail page
  };
  
  if (loading) return <div className="loading">Loading nurses...</div>;
  
  if (error) return <div className="error">Error: {error}</div>;
  
  return (
    <div className="nurse-list-container">
      <div className="list-header">
        <h2>Nurses</h2>
        <button className="btn btn-primary">+ Add Nurse</button>
      </div>
      
      {nurses.length === 0 ? (
        <p>No nurses found</p>
      ) : (
        <div className="nurse-grid">
          {nurses.map(nurse => (
            <div key={nurse.id} className="nurse-card">
              <div className="nurse-card-content">
                <h3>{nurse.name}</h3>
                <p className="nurse-title">{nurse.title}</p>
                <p><strong>Specialty:</strong> {nurse.specialty}</p>
                <p><strong>Email:</strong> {nurse.email}</p>
                <p><strong>Phone:</strong> {nurse.phoneNumber}</p>
              </div>
              <div className="nurse-card-actions">
                <button 
                  onClick={() => handleViewDetails(nurse.id)}
                  className="btn btn-secondary"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NurseList;
