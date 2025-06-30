import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import SchedulerCalendar from "./components/scheduler/SchedulerCalendar";
import NurseList from "./components/nurses/NurseList";
import PatientList from "./components/patients/PatientList";
import AppointmentList from "./components/appointments/AppointmentList";
import MapView from "./components/maps/MapView";
import RouteOptimizer from "./components/routes/RouteOptimizer";
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
          <Route
            path="/map"
            element={
              <MapView
                nurseLocations={[
                  {
                    id: "nurse1",
                    name: "Jane Smith",
                    title: "RN",
                    address: "123 Main St, Dallas, TX",
                    location: { lat: 32.7767, lng: -96.797 },
                  },
                ]}
                patientLocations={[
                  {
                    id: "patient1",
                    name: "Robert Johnson",
                    appointmentTime: "09:00 AM",
                    address: "456 Oak St, Fort Worth, TX",
                    location: { lat: 32.7555, lng: -97.3308 },
                  },
                  {
                    id: "patient2",
                    name: "Sarah Miller",
                    appointmentTime: "10:30 AM",
                    address: "789 Pine St, Arlington, TX",
                    location: { lat: 32.7357, lng: -97.1081 },
                  },
                ]}
                routes={[]}
                center={{ lat: 32.75, lng: -97.03 }}
                zoom={11}
              />
            }
          />

          <Route path="/routes" element={<RouteOptimizer />} />
          <Route path="/nurse-map" element={<NurseLocationMap />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
