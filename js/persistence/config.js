// Global config persisted in localStorage.
const STORAGE_KEY = "lunartransporter.config.v1";

const DEFAULT_CONFIG = Object.freeze({
  debug: true,
  crashLandFuelLossChance: 0.2,
  towingCost: 800,
  thrusterHeatRise: 1.1,
  thrusterHeatCool: 0.032,
  thrusterHeatCoolActive: 1,
  thrusterHeatCoolIdle: 0.032,
  thrusterHeatCoolScale: 0.85,
  thrusterHeatMax: 1,
  thrusterHeatTickThreshold: 0.3,
  thrusterHeatTickMinDelay: 0.35,
  thrusterHeatTickMaxDelay: 1.2,
  thrusterHeatTickGain: 0.35,
  thrusterHeatMinTempK: 300,
  thrusterHeatMaxTempK: 2200,
  refuelRate: 200,
  refuelDingInterval: 200,
  fuelCostPer50Kg: 10,
  cargoHe3CostMultiplier: 4,
  cargoHe3SellMultiplier: 6,
  cargoTransferRate: 500,
  repairRate: 6,
  autoPadMinSpacing: 10000,
  autoPadCountDivisor: 24000,
  autoPadMinCount: 3,
  uiPadPromptY: 0.66,
  uiCrashMessageY: 0.33,
  lowFuelWarningThreshold: 0.2,
  lowFuelWarningInterval: 0.9,
  dustAltitude: 100,
  dustMaxParticles: 400,
  dustSpawnRate: 280,
  dustBaseSpeed: 12,
  dustLift: 12,
  dustSpread: 24,
  dustSize: 1.3,
  dustLife: 1.6,
  worldUnitMeters: 0.25,
  worldWidth: 10000,
});

export function loadConfig() {
  if (!isStorageAvailable()) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const config = { ...DEFAULT_CONFIG };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      return config;
    }

    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  } catch (_error) {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config) {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    const payload = JSON.stringify(normalizeConfig(config));
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch (_error) {
    return false;
  }
}

export function setDebug(enabled) {
  const config = loadConfig();
  config.debug = Boolean(enabled);
  saveConfig(config);
  return config.debug;
}

function normalizeConfig(config) {
  if (!config || typeof config !== "object") {
    return { ...DEFAULT_CONFIG };
  }

  return {
    debug: Boolean(config.debug),
    crashLandFuelLossChance:
      typeof config.crashLandFuelLossChance === "number"
        ? Math.min(Math.max(config.crashLandFuelLossChance, 0), 1)
        : DEFAULT_CONFIG.crashLandFuelLossChance,
    towingCost:
      typeof config.towingCost === "number"
        ? Math.max(0, Math.round(config.towingCost))
        : DEFAULT_CONFIG.towingCost,
    thrusterHeatRise: clampNumber(config.thrusterHeatRise, DEFAULT_CONFIG.thrusterHeatRise, 0, 10),
    thrusterHeatCool: clampNumber(config.thrusterHeatCool, DEFAULT_CONFIG.thrusterHeatCool, 0, 10),
    thrusterHeatCoolActive: clampNumber(
      config.thrusterHeatCoolActive,
      DEFAULT_CONFIG.thrusterHeatCoolActive,
      0,
      10
    ),
    thrusterHeatCoolIdle: clampNumber(
      config.thrusterHeatCoolIdle,
      DEFAULT_CONFIG.thrusterHeatCoolIdle,
      0,
      10
    ),
    thrusterHeatCoolScale: clampNumber(
      config.thrusterHeatCoolScale,
      DEFAULT_CONFIG.thrusterHeatCoolScale,
      0.1,
      3
    ),
    thrusterHeatMax: clampNumber(config.thrusterHeatMax, DEFAULT_CONFIG.thrusterHeatMax, 0.2, 5),
    thrusterHeatTickThreshold: clampNumber(
      config.thrusterHeatTickThreshold,
      DEFAULT_CONFIG.thrusterHeatTickThreshold,
      0,
      1
    ),
    thrusterHeatTickMinDelay: clampNumber(
      config.thrusterHeatTickMinDelay,
      DEFAULT_CONFIG.thrusterHeatTickMinDelay,
      0.05,
      10
    ),
    thrusterHeatTickMaxDelay: clampNumber(
      config.thrusterHeatTickMaxDelay,
      DEFAULT_CONFIG.thrusterHeatTickMaxDelay,
      0.1,
      12
    ),
    thrusterHeatTickGain: clampNumber(
      config.thrusterHeatTickGain,
      DEFAULT_CONFIG.thrusterHeatTickGain,
      0,
      2
    ),
    thrusterHeatMinTempK: clampNumber(
      config.thrusterHeatMinTempK,
      DEFAULT_CONFIG.thrusterHeatMinTempK,
      200,
      4000
    ),
    thrusterHeatMaxTempK: clampNumber(
      config.thrusterHeatMaxTempK,
      DEFAULT_CONFIG.thrusterHeatMaxTempK,
      400,
      6000
    ),
    refuelRate: clampNumber(config.refuelRate, DEFAULT_CONFIG.refuelRate, 10, 2000),
    refuelDingInterval: clampNumber(
      config.refuelDingInterval,
      DEFAULT_CONFIG.refuelDingInterval,
      10,
      2000
    ),
    fuelCostPer50Kg: clampNumber(
      config.fuelCostPer50Kg,
      DEFAULT_CONFIG.fuelCostPer50Kg,
      0,
      1000
    ),
    cargoHe3CostMultiplier: clampNumber(
      config.cargoHe3CostMultiplier,
      DEFAULT_CONFIG.cargoHe3CostMultiplier,
      0,
      20
    ),
    cargoHe3SellMultiplier: clampNumber(
      config.cargoHe3SellMultiplier,
      DEFAULT_CONFIG.cargoHe3SellMultiplier,
      0,
      20
    ),
    cargoTransferRate: clampNumber(
      config.cargoTransferRate,
      DEFAULT_CONFIG.cargoTransferRate,
      10,
      5000
    ),
    repairRate: clampNumber(config.repairRate, DEFAULT_CONFIG.repairRate, 0, 100),
    autoPadMinSpacing: Math.max(
      clampNumber(config.autoPadMinSpacing, DEFAULT_CONFIG.autoPadMinSpacing, 100, 10000),
      DEFAULT_CONFIG.autoPadMinSpacing
    ),
    autoPadCountDivisor: Math.max(
      clampNumber(config.autoPadCountDivisor, DEFAULT_CONFIG.autoPadCountDivisor, 200, 10000),
      DEFAULT_CONFIG.autoPadCountDivisor
    ),
    autoPadMinCount: clampNumber(
      config.autoPadMinCount,
      DEFAULT_CONFIG.autoPadMinCount,
      0,
      50
    ),
    uiPadPromptY: clampNumber(config.uiPadPromptY, DEFAULT_CONFIG.uiPadPromptY, 0.1, 0.9),
    uiCrashMessageY: clampNumber(config.uiCrashMessageY, DEFAULT_CONFIG.uiCrashMessageY, 0.1, 0.9),
    lowFuelWarningThreshold: clampNumber(
      config.lowFuelWarningThreshold,
      DEFAULT_CONFIG.lowFuelWarningThreshold,
      0.01,
      1
    ),
    lowFuelWarningInterval: clampNumber(
      config.lowFuelWarningInterval,
      DEFAULT_CONFIG.lowFuelWarningInterval,
      0.2,
      5
    ),
    dustAltitude: clampNumber(config.dustAltitude, DEFAULT_CONFIG.dustAltitude, 5, 400),
    dustMaxParticles: Math.round(
      clampNumber(config.dustMaxParticles, DEFAULT_CONFIG.dustMaxParticles, 20, 600)
    ),
    dustSpawnRate: clampNumber(
      config.dustSpawnRate,
      DEFAULT_CONFIG.dustSpawnRate,
      5,
      400
    ),
    dustBaseSpeed: clampNumber(
      config.dustBaseSpeed,
      DEFAULT_CONFIG.dustBaseSpeed,
      1,
      60
    ),
    dustLift: clampNumber(config.dustLift, DEFAULT_CONFIG.dustLift, 1, 60),
    dustSpread: clampNumber(config.dustSpread, DEFAULT_CONFIG.dustSpread, 2, 120),
    dustSize: clampNumber(config.dustSize, DEFAULT_CONFIG.dustSize, 0.5, 6),
    dustLife: clampNumber(config.dustLife, DEFAULT_CONFIG.dustLife, 0.1, 3),
    worldUnitMeters: clampNumber(
      config.worldUnitMeters,
      DEFAULT_CONFIG.worldUnitMeters,
      0.01,
      10
    ),
    worldWidth: clampNumber(config.worldWidth, DEFAULT_CONFIG.worldWidth, 1000, 50000),
  };
}

function clampNumber(value, fallback, min, max) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function isStorageAvailable() {
  try {
    const testKey = "__config_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch (_error) {
    return false;
  }
}
