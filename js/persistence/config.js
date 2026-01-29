// Global config persisted in localStorage.
const STORAGE_KEY = "lunartrucker.config.v1";

const DEFAULT_CONFIG = Object.freeze({
  debug: true,
  crashLandFuelLossChance: 0.2,
  towingCost: 800,
  thrusterHeatRise: 1.1,
  thrusterHeatCool: 0.032,
  thrusterHeatCoolActive: 1,
  thrusterHeatCoolIdle: 0.032,
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
  autoPadMinSpacing: 500,
  autoPadCountDivisor: 1200,
  autoPadMinCount: 3,
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
    autoPadMinSpacing: clampNumber(
      config.autoPadMinSpacing,
      DEFAULT_CONFIG.autoPadMinSpacing,
      100,
      5000
    ),
    autoPadCountDivisor: clampNumber(
      config.autoPadCountDivisor,
      DEFAULT_CONFIG.autoPadCountDivisor,
      200,
      10000
    ),
    autoPadMinCount: clampNumber(
      config.autoPadMinCount,
      DEFAULT_CONFIG.autoPadMinCount,
      0,
      50
    ),
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
