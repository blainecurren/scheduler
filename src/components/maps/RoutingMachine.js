import L from "leaflet";
import { createControlComponent } from "@react-leaflet/core";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const createRoutineMachineLayer = (props) => {
  const {
    waypoints = [],
    lineOptions = {
      styles: [{ color: "#0078d4", weight: 4, opacity: 0.8 }],
    },
    showAlternatives = false,
    fitSelectedRoutes = true,
    show = false,
    addWaypoints = true,
    routeWhileDragging = false,
    draggableWaypoints = false,
    createMarker = null,
  } = props;

  // Convert waypoints to Leaflet LatLng objects
  const leafletWaypoints = waypoints.map((point) =>
    L.latLng(point[0], point[1])
  );

  const instance = L.Routing.control({
    waypoints: leafletWaypoints,
    lineOptions,
    show,
    addWaypoints,
    routeWhileDragging,
    draggableWaypoints,
    fitSelectedRoutes,
    showAlternatives,
    createMarker:
      createMarker ||
      function () {
        return null;
      }, // Hide markers by default
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1",
      profile: "driving",
    }),
  });

  return instance;
};

const RoutingMachine = createControlComponent(createRoutineMachineLayer);

export default RoutingMachine;
