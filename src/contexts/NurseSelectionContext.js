// src/contexts/NurseSelectionContext.js
import React, { createContext, useState, useContext, useEffect } from "react";

const NurseSelectionContext = createContext();

export const useNurseSelection = () => {
  const context = useContext(NurseSelectionContext);
  if (!context) {
    throw new Error(
      "useNurseSelection must be used within a NurseSelectionProvider"
    );
  }
  return context;
};

export const NurseSelectionProvider = ({ children }) => {
  const [selectedNurses, setSelectedNurses] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedStatus, setSelectedStatus] = useState("booked"); // New state for status

  // Ensure date is always today
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    if (selectedDate !== today) {
      setSelectedDate(today);
    }
  }, []);

  const updateSelectedNurses = (nurseIds) => {
    console.log("Context: Updating selected nurses:", nurseIds);
    setSelectedNurses(nurseIds);
  };

  const updateSelectedDate = (date) => {
    console.log("Context: Updating selected date:", date);
    setSelectedDate(date);
  };

  const updateSelectedStatus = (status) => {
    console.log("Context: Updating selected status:", status);
    setSelectedStatus(status);
  };

  const value = {
    selectedNurses,
    selectedDate,
    selectedStatus,
    updateSelectedNurses,
    updateSelectedDate,
    updateSelectedStatus,
  };

  return (
    <NurseSelectionContext.Provider value={value}>
      {children}
    </NurseSelectionContext.Provider>
  );
};
