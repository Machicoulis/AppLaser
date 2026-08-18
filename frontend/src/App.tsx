import { MapAreaSelector, type AreaSelection } from "./features/map-selection/MapAreaSelector";

function App() {
  function handleConfirm(selection: AreaSelection) {
    // TODO : brancher sur la récupération Overpass + le workflow de configuration par layer (section 4.1 du cahier des charges)
    console.log("Zone confirmée", selection);
  }

  return <MapAreaSelector onConfirm={handleConfirm} />;
}

export default App;
