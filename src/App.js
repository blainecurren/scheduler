import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import SchedulerCalendar from "./components/scheduler/SchedulerCalendar";
import NurseList from "./components/nurses/NurseList/NurseList";
import PatientList from "./components/patients/PatientList";
import AppointmentList from "./components/appointments/AppointmentList";
import MapView from "./components/maps/MapView";
import RouteOptimizer from "./components/routes/RouteOptimizer";
import NurseLocationMap from "./components/nurses/NurseLocation/NurseLocationMap";
import {
  NurseSelectionProvider,
  useNurseSelection,
} from "./contexts/NurseSelectionContext";
import "./App.css";
import MapWithNurses from "./components/maps/MapWithNurses";

// Create a wrapper component for the map that uses the context
const MapWithNurseData = () => {
  const { nurseLocations, patientLocations, getMapCenter, loading } =
    useNurseSelection();

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        Loading map data...
      </div>
    );
  }

  return (
    <MapView
      nurseLocations={nurseLocations}
      patientLocations={patientLocations}
      routes={[]}
      center={getMapCenter()}
      zoom={nurseLocations.length > 0 ? 11 : 10}
    />
  );
};

function App() {
  return (
    <Router>
      <NurseSelectionProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<SchedulerCalendar />} />
            <Route path="/nurses" element={<NurseList />} />
            <Route path="/patients" element={<PatientList />} />
            <Route path="/appointments" element={<AppointmentList />} />
            <Route path="/map" element={<MapWithNurses />} />
            <Route path="/routes" element={<RouteOptimizer />} />
            <Route path="/nurse-map" element={<NurseLocationMap />} />
          </Routes>
        </Layout>
      </NurseSelectionProvider>
    </Router>
  );
}

export default App;
