// src/contexts/NurseSelectionContext.js
import React, { createContext, useState, useContext } from "react";

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

  const updateSelectedNurses = (nurseIds) => {
    console.log("Context: Updating selected nurses:", nurseIds);
    setSelectedNurses(nurseIds);
  };

  const updateSelectedDate = (date) => {
    console.log("Context: Updating selected date:", date);
    setSelectedDate(date);
  };

  const value = {
    selectedNurses,
    selectedDate,
    updateSelectedNurses,
    updateSelectedDate,
  };

  return (
    <NurseSelectionContext.Provider value={value}>
      {children}
    </NurseSelectionContext.Provider>
  );
};
