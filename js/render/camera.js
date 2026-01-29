// 2D camera with smooth follow and altitude-based zoom.
export function createCamera({
  x = 0,
  y = 0,
  zoom = 1,
  smoothTime = 0.15,
  minZoom = 0.6,
  maxZoom = 1.4,
  altitudeRange = [0, 2000],
  viewport = { width: 0, height: 0 },
} = {}) {
  let position = { x, y };
  let target = { x, y };
  let currentZoom = zoom;
  let targetZoom = zoom;

  function setViewport(width, height) {
    viewport.width = width;
    viewport.height = height;
  }

  function setTarget(nextTarget) {
    target = { x: nextTarget.x, y: nextTarget.y };
  }

  function setZoom(nextZoom) {
    targetZoom = clamp(nextZoom, minZoom, maxZoom);
  }

  function update(dt, altitude = altitudeRange[0]) {
    if (smoothTime <= 0) {
      position = { x: target.x, y: target.y };
      currentZoom = targetZoom;
      return;
    }

    const t = 1 - Math.exp(-dt / smoothTime);
    position = {
      x: lerp(position.x, target.x, t),
      y: lerp(position.y, target.y, t),
    };

    const zoomFromAltitude = mapRange(
      altitude,
      altitudeRange[0],
      altitudeRange[1],
      maxZoom,
      minZoom
    );

    targetZoom = clamp(zoomFromAltitude, minZoom, maxZoom);
    currentZoom = lerp(currentZoom, targetZoom, t);
  }

  function begin(ctx) {
    ctx.save();
    ctx.translate(viewport.width / 2, viewport.height / 2);
    ctx.scale(currentZoom, currentZoom);
    ctx.translate(-position.x, -position.y);
  }

  function end(ctx) {
    ctx.restore();
  }

  function getPosition() {
    return { x: position.x, y: position.y };
  }

  function getZoom() {
    return currentZoom;
  }

  return {
    setViewport,
    setTarget,
    setZoom,
    update,
    begin,
    end,
    getPosition,
    getZoom,
  };
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) {
    return outMin;
  }

  const t = (value - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * t;
}
