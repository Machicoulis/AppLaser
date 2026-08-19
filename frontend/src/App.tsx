import { useState } from "react";
import { AreaPreview } from "./features/area-preview/AreaPreview";
import { LayerConfigurator } from "./features/layers/LayerConfigurator";
import type { LayerLines, WayCategory } from "./features/layers/layerStyles";
import { MapAreaSelector, type AreaSelection } from "./features/map-selection/MapAreaSelector";

type Step = { name: "select" } | { name: "preview"; selection: AreaSelection } | { name: "layers"; selection: AreaSelection; layers: LayerLines; widthsMm: Record<WayCategory, number> };

function App() {
  const [step, setStep] = useState<Step>({ name: "select" });

  if (step.name === "preview") {
    return (
      <AreaPreview
        selection={step.selection}
        onBack={() => setStep({ name: "select" })}
        onContinue={(layers, widthsMm) => setStep({ name: "layers", selection: step.selection, layers, widthsMm })}
      />
    );
  }

  if (step.name === "layers") {
    return (
      <LayerConfigurator
        selection={step.selection}
        layers={step.layers}
        initialWidthsMm={step.widthsMm}
        onBack={() => setStep({ name: "preview", selection: step.selection })}
      />
    );
  }

  return <MapAreaSelector onConfirm={(selection) => setStep({ name: "preview", selection })} />;
}

export default App;
