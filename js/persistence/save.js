// Local storage persistence for game state.
const STORAGE_KEY = "lunartransporter.save.v2";
const SAVE_VERSION = 1;

export function saveGame(gameModel) {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    const payload = JSON.stringify(normalizeSave(gameModel));
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch (_error) {
    return false;
  }
}

export function loadGame() {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw);
    return normalizeSave(data);
  } catch (_error) {
    return null;
  }
}

export function hasSave() {
  if (!isStorageAvailable()) {
    return false;
  }

  return Boolean(localStorage.getItem(STORAGE_KEY));
}

export function deleteSave() {
  if (!isStorageAvailable()) {
    return false;
  }

  localStorage.removeItem(STORAGE_KEY);
  return true;
}

function normalizeSave(data) {
  const base = getDefaultSave();
  if (!data || typeof data !== "object") {
    return base;
  }

  const legacyRun = data.runState && typeof data.runState === "object" ? data.runState : null;

  const shipSource = data.ship || (legacyRun ? legacyRun.ship : null);
  const worldSource = data.world || null;

  return {
    version: SAVE_VERSION,
    money: normalizeNumber(data.money ?? (legacyRun ? legacyRun.money : undefined), base.money),
    activePadId: typeof data.activePadId === "string" ? data.activePadId : base.activePadId,
    spawnPadId: typeof data.spawnPadId === "string" ? data.spawnPadId : base.spawnPadId,
    ship: normalizeShip(shipSource, base.ship),
    world: normalizeWorld(worldSource, legacyRun, base.world),
    currentState: normalizeState(data.currentState ?? data.state ?? (legacyRun ? legacyRun.lastState : undefined)),
    music: normalizeMusic(data.music, base.music),
  };
}

function getDefaultSave() {
  return {
    version: SAVE_VERSION,
    money: 0,
    activePadId: "",
    spawnPadId: "",
    ship: {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      fuel: 0,
      hullHP: 100,
      thrusterHeat: { main: 0, retro: 0 },
      modules: {},
      cargo: [],
      cargoCapacity: 0,
      cargoMass: 0,
      dryMass: 0,
      mass: 0,
    },
    world: {
      width: 5000,
      seed: 0,
      pads: [],
    },
    currentState: "flight",
    music: {
      track: "",
      time: 0,
    },
  };
}

function normalizeShip(ship, defaults) {
  if (!ship || typeof ship !== "object") {
    return { ...defaults };
  }

  return {
    position: normalizeVector(ship.position, defaults.position),
    velocity: normalizeVector(ship.velocity, defaults.velocity),
    rotation: normalizeNumber(ship.rotation, defaults.rotation),
    fuel: normalizeNumber(ship.fuel, defaults.fuel),
    hullHP: normalizeNumber(ship.hullHP ?? ship.health ?? ship.hp, defaults.hullHP),
    thrusterHeat: normalizeThrusterHeat(ship.thrusterHeat, defaults.thrusterHeat),
    modules: normalizeModules(ship.modules, defaults.modules),
    cargo: normalizeCargo(ship.cargo, defaults.cargo),
    cargoCapacity: normalizeNumber(ship.cargoCapacity, defaults.cargoCapacity),
    cargoMass: normalizeNumber(ship.cargoMass, defaults.cargoMass),
    dryMass: normalizeNumber(ship.dryMass, defaults.dryMass),
    mass: normalizeNumber(ship.mass, defaults.mass),
  };
}

function normalizeWorld(world, legacyRun, defaults) {
  if (world && typeof world === "object") {
    return {
      width: normalizeNumber(world.width, defaults.width),
      seed: normalizeNumber(world.seed, defaults.seed),
      pads: normalizePads(world.pads, defaults.pads),
    };
  }

  if (legacyRun && legacyRun.spawnPad) {
    return {
      width: defaults.width,
      seed: defaults.seed,
      pads: normalizePads([legacyRun.spawnPad], defaults.pads),
    };
  }

  return { ...defaults };
}

function normalizeState(state) {
  const normalized = String(state || "").toLowerCase();
  if (normalized === "flight" || normalized === "landed") {
    return normalized;
  }

  if (normalized === "flight_state" || normalized === "flying" || normalized === "air") {
    return "flight";
  }

  return "flight";
}

function normalizeMusic(music, fallback) {
  if (!music || typeof music !== "object") {
    return { ...fallback };
  }

  return {
    track: typeof music.track === "string" ? music.track : fallback.track,
    time: normalizeNumber(music.time, fallback.time),
  };
}

function normalizeVector(value, fallback) {
  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  return {
    x: normalizeNumber(value.x, fallback.x),
    y: normalizeNumber(value.y, fallback.y),
  };
}

function normalizeNumber(value, fallback) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function normalizeThrusterHeat(value, fallback) {
  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  return {
    main: normalizeNumber(value.main, fallback.main),
    retro: normalizeNumber(value.retro, fallback.retro),
  };
}

function normalizeModules(modules, fallback) {
  if (modules && typeof modules === "object" && !Array.isArray(modules)) {
    return { ...modules };
  }

  return { ...fallback };
}

function normalizeCargo(cargo, fallback) {
  if (!Array.isArray(cargo)) {
    return [...fallback];
  }

  return cargo.map((item) => (item ? { ...item } : item));
}

function normalizePads(pads, fallback) {
  if (!Array.isArray(pads)) {
    return [...fallback];
  }

  return pads.map((pad) => ({ ...pad }));
}

function isStorageAvailable() {
  try {
    const testKey = "__storage_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch (_error) {
    return false;
  }
}
