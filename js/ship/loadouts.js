import { createEngineModule } from "./modules/engine.js";
import { createFuelTankModule } from "./modules/fueltank.js";

// Ship loadouts separate from module registry.
export function createStarterLoadout() {
  const engine = createEngineModule({
    id: "engine-basic",
    name: "Basic Engine",
    mass: 320,
    thrustModifier: 1,
  });

  const fuel = createFuelTankModule({
    id: "tank-small",
    name: "Small Tank",
    mass: 120,
    fuelCapacity: 5000,
    visual: {
      color: "#6c7b88",
      width: 12,
      height: 10,
      offset: { x: 0, y: 0 },
    },
  });

  const modules = normalizeModules({
    engine,
    fuel,
    utility: null,
  });

  return {
    modules,
    cargo: [],
    fuelCapacity: getFuelCapacity(modules),
  };
}

export function createLoadout(name = "starter") {
  if (name === "starter") {
    return createStarterLoadout();
  }

  return createStarterLoadout();
}

function normalizeModules(modules) {
  return {
    engine: modules.engine || null,
    fuel: modules.fuel || null,
    utility: modules.utility || null,
  };
}

function getFuelCapacity(modules) {
  return [modules.engine, modules.fuel, modules.utility].reduce((total, module) => {
    if (!module || !module.fuelCapacity) {
      return total;
    }

    return total + module.fuelCapacity;
  }, 0);
}
