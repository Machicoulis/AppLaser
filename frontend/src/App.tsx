import { useState } from "react";
import { AreaPreview } from "./features/area-preview/AreaPreview";
import { MapAreaSelector, type AreaSelection } from "./features/map-selection/MapAreaSelector";

function App() {
  const [selection, setSelection] = useState<AreaSelection | null>(null);

  if (selection) {
    return <AreaPreview selection={selection} onBack={() => setSelection(null)} />;
  }

  return <MapAreaSelector onConfirm={setSelection} />;
}

export default App;
