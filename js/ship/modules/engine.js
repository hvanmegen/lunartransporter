import { createModule } from "./module.js";

// Engine module presets.
export function createEngineModule({
  id = "engine-basic",
  name = "Microraptor",
  mass = 320,
  thrustModifier = 1,
  visual = {
    color: "#5c6f80",
    width: 18,
    height: 10,
    offset: { x: 0, y: 6 },
  },
} = {}) {
  return createModule({
    id,
    name,
    type: "engine",
    mass,
    thrustModifier,
    visual,
  });
}
