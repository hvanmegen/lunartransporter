// Thruster heat model for main/retro engines.
export function createThrusterHeatState() {
  return {
    main: 0,
    retro: 0,
  };
}

export function updateThrusterHeat(state, inputs, dt, config) {
  const heatState = state || createThrusterHeatState();
  const riseRate = getNumber(config && config.thrusterHeatRise, 1.1);
  const baseCool = getNumber(config && config.thrusterHeatCool, 0.12);
  const coolRateActive = getNumber(config && config.thrusterHeatCoolActive, 0.4);
  const coolRateIdle = getNumber(config && config.thrusterHeatCoolIdle, baseCool);
  const maxHeat = getNumber(config && config.thrusterHeatMax, 1);

  const mainInput = clamp(getNumber(inputs && inputs.main, 0), 0, 1);
  const retroInput = clamp(getNumber(inputs && inputs.retro, 0), 0, 1);

  heatState.main = updateHeatValue(heatState.main, mainInput, dt, riseRate, coolRateActive, coolRateIdle, maxHeat);
  heatState.retro = updateHeatValue(heatState.retro, retroInput, dt, riseRate, coolRateActive, coolRateIdle, maxHeat);

  return heatState;
}

function updateHeatValue(value, input, dt, riseRate, coolRateActive, coolRateIdle, maxHeat) {
  let next = value || 0;
  if (input > 0) {
    next += input * riseRate * dt;
    next -= coolRateActive * (1 - input) * dt;
  } else {
    next -= coolRateIdle * dt;
  }

  return clamp(next, 0, maxHeat);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
