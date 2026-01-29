import { createModule } from "./module.js";

// Fuel tank module presets.
export function createFuelTankModule({
  id = "tank-standard",
  name = "Standard Tank",
  mass = 180,
  fuelCapacity = 8000,
  visual = {
    color: "#71808f",
    width: 16,
    height: 14,
    offset: { x: 0, y: 0 },
  },
} = {}) {
  return createModule({
    id,
    name,
    type: "fuel",
    mass,
    fuelCapacity,
    visual,
  });
}
