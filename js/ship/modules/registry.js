import { createEngineModule } from "./engine.js";
import { createFuelTankModule } from "./fueltank.js";

const SLOTS = [
  {
    id: "engine",
    type: "engine",
    mount: { x: 0, y: 10 },
  },
  {
    id: "fuel",
    type: "fuel",
    mount: { x: 0, y: -2 },
  },
  {
    id: "utility",
    type: "utility",
    mount: { x: 0, y: -14 },
  },
];

// Example loadouts (hardcoded until upgrade UI exists).
const LOADOUT_FACTORIES = {
  starter() {
    return {
      engine: createEngineModule(),
      fuel: createFuelTankModule(),
      utility: createFuelTankModule({
        id: "tank-compact",
        name: "Compact Tank",
        mass: 120,
        fuelCapacity: 420,
        visual: {
          color: "#6c7b88",
          width: 12,
          height: 10,
          offset: { x: 0, y: -2 },
        },
      }),
    };
  },
  heavy() {
    return {
      engine: createEngineModule({
        id: "engine-boost",
        name: "Boost Engine",
        mass: 400,
        thrustModifier: 1.2,
        visual: {
          color: "#4d5c6b",
          width: 20,
          height: 12,
          offset: { x: 0, y: 6 },
        },
      }),
      fuel: createFuelTankModule({
        id: "tank-large",
        name: "Large Tank",
        mass: 260,
        fuelCapacity: 1400,
        visual: {
          color: "#7a8794",
          width: 18,
          height: 16,
          offset: { x: 0, y: 0 },
        },
      }),
      utility: null,
    };
  },
};

export function getSlots() {
  return SLOTS.map((slot) => ({
    id: slot.id,
    type: slot.type,
    mount: { x: slot.mount.x, y: slot.mount.y },
  }));
}

export function createLoadout(name = "starter") {
  const factory = LOADOUT_FACTORIES[name] || LOADOUT_FACTORIES.starter;
  const modules = factory();

  return normalizeLoadout(modules);
}

export function calculateShipStats(baseMass, modules) {
  const slots = getSlots();

  let totalMass = baseMass;
  let totalFuelCapacity = 0;
  let thrustModifier = 1;

  slots.forEach((slot) => {
    const module = modules[slot.id];
    if (!module) {
      return;
    }

    totalMass += module.mass;
    totalFuelCapacity += module.fuelCapacity || 0;
    thrustModifier *= module.thrustModifier || 1;
  });

  return {
    mass: totalMass,
    fuelCapacity: totalFuelCapacity,
    thrustModifier,
  };
}

export function getModuleVisuals(modules) {
  const slots = getSlots();
  const visuals = [];

  slots.forEach((slot) => {
    const module = modules[slot.id];
    if (!module || !module.visual) {
      return;
    }

    visuals.push({
      id: module.id,
      slotId: slot.id,
      color: module.visual.color,
      width: module.visual.width,
      height: module.visual.height,
      position: {
        x: slot.mount.x + module.visual.offset.x,
        y: slot.mount.y + module.visual.offset.y,
      },
    });
  });

  return visuals;
}

function normalizeLoadout(modules) {
  const normalized = {};

  getSlots().forEach((slot) => {
    normalized[slot.id] = modules[slot.id] || null;
  });

  return normalized;
}
