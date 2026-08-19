import { useState } from "react";
import { AreaPreview, type WidthSettings } from "./features/area-preview/AreaPreview";
import { LayerConfigurator } from "./features/layers/LayerConfigurator";
import type { MapDataResponse, RoadLayer } from "./features/layers/layerStyles";
import { MapAreaSelector, type AreaSelection } from "./features/map-selection/MapAreaSelector";

type Step =
  | { name: "select" }
  | { name: "preview"; selection: AreaSelection }
  | {
      name: "layers";
      selection: AreaSelection;
      data: MapDataResponse;
      roadAssignment: Record<string, RoadLayer>;
      widthsMm: WidthSettings;
    };

function App() {
  const [step, setStep] = useState<Step>({ name: "select" });

  if (step.name === "preview") {
    return (
      <AreaPreview
        selection={step.selection}
        onBack={() => setStep({ name: "select" })}
        onContinue={(data, roadAssignment, widthsMm) =>
          setStep({ name: "layers", selection: step.selection, data, roadAssignment, widthsMm })
        }
      />
    );
  }

  if (step.name === "layers") {
    return (
      <LayerConfigurator
        selection={step.selection}
        data={step.data}
        roadAssignment={step.roadAssignment}
        initialWidthsMm={step.widthsMm}
        onBack={() => setStep({ name: "preview", selection: step.selection })}
      />
    );
  }

  return <MapAreaSelector onConfirm={(selection) => setStep({ name: "preview", selection })} />;
}

export default App;
