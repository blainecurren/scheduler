// src/components/examples/NurseListGraphQL.js
import React, { useState, useEffect } from "react";
import useGraphQL from "../../hooks/useGraphQL";

const NurseListGraphQL = () => {
  const [nurses, setNurses] = useState([]);
  const { loading, error, query } = useGraphQL();

  useEffect(() => {
    // Fetch nurses when component mounts
    const fetchNurses = async () => {
      try {
        const data = await query("GET_NURSES");
        if (data?.nurses) {
          setNurses(data.nurses);
        }
      } catch (err) {
        console.error("Error fetching nurses:", err);
      }
    };

    fetchNurses();
  }, [query]);

  // Handler for selecting a nurse to view more details
  const handleViewDetails = async (nurseId) => {
    try {
      const data = await query("GET_NURSE", { id: nurseId });
      if (data?.nurse) {
        console.log("Nurse details:", data.nurse);
        // Here you could open a modal or navigate to a detail page
      }
    } catch (err) {
      console.error("Error fetching nurse details:", err);
    }
  };

  if (loading) return <div>Loading nurses...</div>;

  if (error) return <div>Error: {error}</div>;

  return (
    <div className="nurse-list">
      <h2>Nurses (via GraphQL)</h2>

      {nurses.length === 0 ? (
        <p>No nurses found</p>
      ) : (
        <ul className="nurse-items">
          {nurses.map((nurse) => (
            <li key={nurse.id} className="nurse-item">
              <div className="nurse-info">
                <h3>{nurse.name}</h3>
                <p>{nurse.title}</p>
                {nurse.specialty && <p>Specialty: {nurse.specialty}</p>}
                <p>Email: {nurse.email}</p>
                <p>Phone: {nurse.phoneNumber}</p>
              </div>
              <div className="nurse-actions">
                <button
                  onClick={() => handleViewDetails(nurse.id)}
                  className="btn btn-primary"
                >
                  View Details
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NurseListGraphQL;
