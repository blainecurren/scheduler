import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import SchedulerCalendar from "./components/scheduler/SchedulerCalendar";
import NurseList from "./components/nurses/NurseList";
import PatientList from "./components/patients/PatientList";
import AppointmentList from "./components/appointments/AppointmentList";
import MapView from "./components/maps/MapView";
import RouteOptimizer from "./components/routes/RouteOptimizer";
// Import the new component - make sure the path is correct
import NurseLocationMap from "./components/nurses/NurseLocationMap";
import "./App.css";

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<SchedulerCalendar />} />
          <Route path="/nurses" element={<NurseList />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/appointments" element={<AppointmentList />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/routes" element={<RouteOptimizer />} />
          <Route path="/nurse-map" element={<NurseLocationMap />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
