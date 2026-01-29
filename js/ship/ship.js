import {
  LUNAR_GRAVITY,
  SHIP_FUEL_CAPACITY,
  SHIP_FUEL_BURN_RATE,
  SHIP_MASS,
  SHIP_MAX_RETRO_THRUST,
  SHIP_MAX_THRUST,
} from "../core/constants.js";
import { createShipPhysics } from "./physics.js";

// Ship state container and physics integration.
export function createShip({
  position = { x: 0, y: 0 },
  velocity = { x: 0, y: 0 },
  rotation = 0,
} = {}) {
  const physics = createShipPhysics({
    mass: SHIP_MASS,
    gravity: LUNAR_GRAVITY,
    maxThrust: SHIP_MAX_THRUST,
    maxRetroThrust: SHIP_MAX_RETRO_THRUST,
    fuelBurnRate: SHIP_FUEL_BURN_RATE,
  });

  const state = {
    position: { x: position.x, y: position.y },
    velocity: { x: velocity.x, y: velocity.y },
    rotation,
    fuel: SHIP_FUEL_CAPACITY,
    mass: SHIP_MASS,
  };

  function applyThrust(amount) {
    physics.applyThrust(amount);
  }

  function update(dt) {
    physics.update(state, dt);
  }

  function setRotation(angle) {
    state.rotation = angle;
  }

  function getState() {
    return {
      position: { x: state.position.x, y: state.position.y },
      velocity: { x: state.velocity.x, y: state.velocity.y },
      rotation: state.rotation,
      fuel: state.fuel,
      mass: state.mass,
    };
  }

  return {
    applyThrust,
    update,
    setRotation,
    getState,
  };
}
