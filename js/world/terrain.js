// Wrapped 1D heightmap terrain.
export function createTerrain({
  worldWidth = 5000,
  sampleCount = 512,
  minHeight = 40,
  maxHeight = 220,
  seed = 0,
  spacePads = null,
} = {}) {
  const heights = generateHeights(sampleCount, minHeight, maxHeight, seed);
  const sampleSpacing = worldWidth / sampleCount;

  function getHeightAt(x) {
    const pad = getPadAt(spacePads, x, worldWidth);
    if (pad) {
      return pad.height - (pad.surfaceOffset || 0);
    }

    return getBaseHeightAt(x);
  }

  function getSlopeAt(x) {
    const pad = getPadAt(spacePads, x, worldWidth);
    if (pad) {
      return 0;
    }

    const dx = sampleSpacing;
    const left = getBaseHeightAt(x - dx);
    const right = getBaseHeightAt(x + dx);

    return (right - left) / (2 * dx);
  }

  function getBaseHeightAt(x) {
    const wrappedX = wrapX(x, worldWidth);
    const sampleIndex = wrappedX / sampleSpacing;
    const baseIndex = Math.floor(sampleIndex);
    const nextIndex = (baseIndex + 1) % sampleCount;
    const t = sampleIndex - baseIndex;

    return lerp(heights[baseIndex], heights[nextIndex], t);
  }

  function draw(ctx, cameraXOrOptions, viewportWidth, baselineY = 0) {
    const options =
      cameraXOrOptions && typeof cameraXOrOptions === "object"
        ? cameraXOrOptions
        : {
            cameraX: cameraXOrOptions,
            viewportWidth,
            baselineY,
            worldSpace: false,
          };

    const startX = options.startX ?? options.cameraX - options.viewportWidth / 2;
    const endX = options.endX ?? options.cameraX + options.viewportWidth / 2;
    const span = endX - startX;
    const worldSpace = Boolean(options.worldSpace);

    if (!Number.isFinite(span) || span <= 0) {
      return;
    }

    ctx.beginPath();

    if (worldSpace) {
      const step = sampleSpacing;
      const firstX = Math.floor(startX / step) * step;
      const lastX = endX + step;
      let isFirst = true;
      let firstPointX = firstX;
      let lastPointX = firstX;

      for (let worldX = firstX; worldX <= lastX; worldX += step) {
        const height = getHeightAt(worldX);
        const drawY = (options.baselineY ?? baselineY) + height;

        if (isFirst) {
          ctx.moveTo(worldX, drawY);
          firstPointX = worldX;
          isFirst = false;
        } else {
          ctx.lineTo(worldX, drawY);
        }

        lastPointX = worldX;
      }

      if (Number.isFinite(options.fillToY)) {
        ctx.lineTo(lastPointX, options.fillToY);
        ctx.lineTo(firstPointX, options.fillToY);
        ctx.closePath();
      }

      return;
    }

    const stepCount = Math.max(2, Math.floor(span / sampleSpacing));
    const step = span / stepCount;

    let firstScreenX = 0;
    let lastScreenX = 0;

    for (let i = 0; i <= stepCount; i += 1) {
      const worldX = startX + i * step;
      const height = getHeightAt(worldX);
      const drawX = worldX - startX;
      const drawY = (options.baselineY ?? baselineY) + height;

      if (i === 0) {
        ctx.moveTo(drawX, drawY);
        firstScreenX = drawX;
      } else {
        ctx.lineTo(drawX, drawY);
      }

      lastScreenX = drawX;
    }

    if (Number.isFinite(options.fillToY)) {
      ctx.lineTo(lastScreenX, options.fillToY);
      ctx.lineTo(firstScreenX, options.fillToY);
      ctx.closePath();
    }
  }

  return {
    getHeightAt,
    getSlopeAt,
    draw,
  };
}

function generateHeights(sampleCount, minHeight, maxHeight, seed) {
  const random = createRandom(seed);
  const heights = new Array(sampleCount);

  let current = lerp(minHeight, maxHeight, random());
  for (let i = 0; i < sampleCount; i += 1) {
    const delta = (random() - 0.5) * (maxHeight - minHeight) * 0.2;
    current = clamp(current + delta, minHeight, maxHeight);
    heights[i] = current;
  }

  return heights;
}

function createRandom(seed) {
  let state = seed || 1;

  return function random() {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function wrapX(x, width) {
  const wrapped = x % width;
  return wrapped < 0 ? wrapped + width : wrapped;
}

function getPadAt(spacePads, x, worldWidth) {
  if (!spacePads) {
    return null;
  }

  if (typeof spacePads.getPadAt === "function") {
    return spacePads.getPadAt(x);
  }

  if (Array.isArray(spacePads)) {
    const wrappedX = wrapX(x, worldWidth);
    for (const pad of spacePads) {
      const distance = shortestWrappedDistance(wrappedX, pad.x, worldWidth);
      if (Math.abs(distance) <= pad.width / 2) {
        return pad;
      }
    }
  }

  return null;
}

function shortestWrappedDistance(a, b, width) {
  const delta = a - b;
  const wrapped = ((delta + width / 2) % width) - width / 2;
  return wrapped < -width / 2 ? wrapped + width : wrapped;
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
