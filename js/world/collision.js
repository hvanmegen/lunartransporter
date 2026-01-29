import {
  SHIP_COLLISION_RADIUS,
} from "../core/constants.js";

// Terrain collision and landing evaluation.
export function createCollisionSystem({ terrain, spacePads } = {}) {
  function update(shipState) {
    if (!terrain || !shipState) {
      return null;
    }

    const terrainHeight = terrain.getHeightAt(shipState.position.x);
    const bottomOffset = getCollisionBottom(shipState);
    const shipBottom = shipState.position.y + bottomOffset;

    if (shipBottom < terrainHeight) {
      return { collided: false, landed: false, damage: 0 };
    }

    const pad = spacePads ? spacePads.getPadAt(shipState.position.x) : null;
    const speed = getSpeed(shipState.velocity);
    const lateralSpeed = Math.abs(shipState.velocity.x);
    const verticalSpeed = Math.abs(shipState.velocity.y);
    const rotationSpeed = Math.abs(shipState.angularVelocity || 0);

    alignShipToTerrain(shipState, terrainHeight);

    return {
      collided: true,
      onPad: Boolean(pad),
      pad,
      speed,
      lateralSpeed,
      verticalSpeed,
      rotationSpeed,
    };
  }

  return {
    update,
  };
}

function getSpeed(velocity) {
  return Math.hypot(velocity.x, velocity.y);
}

function alignShipToTerrain(shipState, terrainHeight) {
  const bottomOffset = getCollisionBottom(shipState);
  shipState.position.y = terrainHeight - bottomOffset;
}

function getCollisionBottom(shipState) {
  if (typeof shipState.collisionBottom === "number") {
    return shipState.collisionBottom;
  }

  return SHIP_COLLISION_RADIUS;
}
