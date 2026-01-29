import {
  FUEL_MASS_PER_UNIT,
  SHIP_COLLISION_RADIUS,
  SHIP_MASS,
  SHIP_TARGET_TOTAL_MASS,
} from "../core/constants.js";
import { GameState } from "../core/state.js";
import { createSpacePads } from "../world/spacePads.js";
import { createTerrain } from "../world/terrain.js";
import { createStarterLoadout } from "../ship/loadouts.js";
import { calculateShipStats } from "../ship/modules/registry.js";

// Build a new game model with a landed starter ship.
export function createNewGame({ worldWidth = 5000, seed = 0, shipModel = null, config = null } = {}) {
  const baseTerrain = createTerrain({
    worldWidth,
    seed,
  });
  const pads = buildPads({ worldWidth, seed, terrain: baseTerrain, config });
  const spacePads = createSpacePads({ worldWidth, pads });
  const colonyPad = selectColonyPad(pads);

  const terrain = createTerrain({
    worldWidth,
    seed,
    spacePads,
  });

  const loadout = createStarterLoadout();
  const baseMass =
    shipModel && typeof shipModel.mass === "number" && Number.isFinite(shipModel.mass)
      ? shipModel.mass
      : SHIP_MASS;
  const stats = calculateShipStats(baseMass, loadout.modules);

  const collisionBottom =
    shipModel && typeof shipModel.collisionBottom === "number"
      ? shipModel.collisionBottom
      : shipModel && shipModel.bounds
        ? shipModel.bounds.maxY
        : SHIP_COLLISION_RADIUS;
  const fuelMass = stats.fuelCapacity * FUEL_MASS_PER_UNIT;
  const targetTotal = SHIP_TARGET_TOTAL_MASS;
  const dryMass = Math.max(0, targetTotal - fuelMass);

  const cargoCapacity = shipModel && typeof shipModel.cargoCapacity === "number" ? shipModel.cargoCapacity : 0;
  const ship = {
    position: {
      x: colonyPad ? colonyPad.x : 0,
      y: colonyPad ? colonyPad.height - collisionBottom : 0,
    },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    angularVelocity: 0,
    fuel: stats.fuelCapacity,
    fuelCapacity: stats.fuelCapacity,
    cargoCapacity,
    cargoMass: 0,
    dryMass,
    mass: dryMass + fuelMass,
    hullHP: 100,
    modules: loadout.modules,
    cargo: [],
    landed: true,
    model: shipModel,
    collisionBottom,
  };

  return {
    world: {
      width: worldWidth,
      seed,
      terrain,
      spacePads,
      pads,
    },
    ship,
    currentState: GameState.LANDED,
    spawnPad: colonyPad || null,
  };
}

function selectColonyPad(pads) {
  if (!pads || pads.length === 0) {
    return null;
  }

  const colony = pads.find((pad) => pad.type === "colony" || pad.id === "colony");
  return colony || pads[0];
}

function buildPads({ worldWidth, seed, terrain, config }) {
  const basePads = [
    { id: "colony", type: "colony", x: 0, width: 160 },
    { id: "mine", type: "industrial", x: worldWidth * 0.25, width: 130 },
    { id: "colony-2", type: "colony", x: worldWidth * 0.6, width: 140 },
  ].map((pad) => ({
    ...pad,
    height: terrain ? terrain.getHeightAt(pad.x) : 120,
  }));

  const autoPads = generateAutoPads({ worldWidth, seed, terrain, existingPads: basePads, config });
  return [...basePads, ...autoPads];
}

function generateAutoPads({ worldWidth, seed, terrain, existingPads, config }) {
  if (!terrain) {
    return [];
  }

  const countDivisor =
    config && typeof config.autoPadCountDivisor === "number" ? config.autoPadCountDivisor : 1200;
  const minCount = config && typeof config.autoPadMinCount === "number" ? config.autoPadMinCount : 3;
  const count = Math.max(minCount, Math.floor(worldWidth / Math.max(200, countDivisor)));
  const minSpacing =
    config && typeof config.autoPadMinSpacing === "number" ? config.autoPadMinSpacing : 500;
  const pads = [];
  const random = createRandom(seed + 1337);

  let attempts = 0;
  while (pads.length < count && attempts < count * 30) {
    attempts += 1;
    const x = random() * worldWidth;
    if (!isPadSpacingClear(x, existingPads, pads, minSpacing, worldWidth)) {
      continue;
    }

    const width = 90 + random() * 70;
    pads.push({
      id: `pad-${pads.length + 1}`,
      type: "industrial",
      x,
      width,
      height: terrain.getHeightAt(x),
    });
  }

  return pads;
}

function isPadSpacingClear(x, basePads, pads, minSpacing, worldWidth) {
  const list = [...basePads, ...pads];
  for (const pad of list) {
    const distance = wrappedDistance(x, pad.x, worldWidth);
    if (Math.abs(distance) < minSpacing + (pad.width || 0) * 0.5) {
      return false;
    }
  }

  return true;
}

function wrappedDistance(a, b, width) {
  if (!width) {
    return a - b;
  }

  const delta = a - b;
  const wrapped = ((delta + width / 2) % width) - width / 2;
  return wrapped < -width / 2 ? wrapped + width : wrapped;
}

function createRandom(seed) {
  let state = seed || 1;
  return function random() {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}
