// Base module factory used by all ship modules.
export function createModule({
  id,
  name,
  type = "generic",
  mass,
  fuelCapacity = 0,
  thrustModifier = 1,
  visual = null,
} = {}) {
  if (!id || !name || typeof mass !== "number") {
    throw new Error("Module requires id, name, and mass.");
  }

  return {
    id,
    name,
    type,
    mass,
    fuelCapacity,
    thrustModifier,
    visual,
  };
}
