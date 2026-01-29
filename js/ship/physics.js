// Physics integration for the ship (no rendering or input).
export function createShipPhysics({
  mass,
  gravity,
  maxThrust,
  maxRetroThrust,
  fuelBurnRate,
}) {
  let thrustInput = 0;
  const baseMass = mass;
  let gravityValue = gravity;
  let maxThrustValue = maxThrust;
  let maxRetroThrustValue = maxRetroThrust;
  let fuelBurnRateValue = fuelBurnRate;

  function applyThrust(amount) {
    thrustInput = clamp(amount, -1, 1);
  }

  function update(state, dt) {
    const thrustForce = getThrustForce(thrustInput, maxThrustValue, maxRetroThrustValue);
    const { adjustedThrust, fuelUsed } = consumeFuel(
      state.fuel,
      thrustInput,
      fuelBurnRateValue,
      thrustForce,
      dt
    );

    state.fuel -= fuelUsed;
    state.thrustForce = adjustedThrust;
    state.thrustInput = thrustInput;

    const massValue = typeof state.mass === "number" ? state.mass : baseMass;
    const acceleration = getAcceleration(state.rotation, adjustedThrust, massValue, gravityValue);

    state.velocity.x += acceleration.x * dt;
    state.velocity.y += acceleration.y * dt;

    state.position.x += state.velocity.x * dt;
    state.position.y += state.velocity.y * dt;
  }

  return {
    applyThrust,
    update,
    setGravity(nextGravity) {
      gravityValue = Number.isFinite(nextGravity) ? nextGravity : gravityValue;
    },
    setFuelBurnRate(nextRate) {
      fuelBurnRateValue = Number.isFinite(nextRate) ? nextRate : fuelBurnRateValue;
    },
    setMaxThrust(nextMax) {
      maxThrustValue = Number.isFinite(nextMax) ? nextMax : maxThrustValue;
    },
    setMaxRetroThrust(nextMax) {
      maxRetroThrustValue = Number.isFinite(nextMax) ? nextMax : maxRetroThrustValue;
    },
  };
}

function getThrustForce(thrustInput, maxThrust, maxRetroThrust) {
  if (thrustInput >= 0) {
    return thrustInput * maxThrust;
  }

  return thrustInput * maxRetroThrust;
}

function consumeFuel(fuel, thrustInput, fuelBurnRate, thrustForce, dt) {
  if (fuel <= 0 || thrustInput === 0) {
    return { adjustedThrust: 0, fuelUsed: 0 };
  }

  const burn = Math.abs(thrustInput) * fuelBurnRate * dt;
  if (burn <= fuel) {
    return { adjustedThrust: thrustForce, fuelUsed: burn };
  }

  const scale = fuel / burn;
  return { adjustedThrust: thrustForce * scale, fuelUsed: fuel };
}

function getAcceleration(rotation, thrustForce, mass, gravity) {
  // Rotation of 0 points upward; gravity accelerates downward.
  const ax = (Math.sin(rotation) * thrustForce) / mass;
  const ay = (-Math.cos(rotation) * thrustForce) / mass + gravity;

  return { x: ax, y: ay };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
