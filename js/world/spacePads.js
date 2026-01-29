// Space pad data and queries (pure world data, no economy or ship logic).
export function createSpacePads({ worldWidth = 5000, pads = null } = {}) {
  const normalizedPads = normalizePads(pads || getDefaultPads(worldWidth), worldWidth);

  function getPads() {
    return normalizedPads.map((pad) => ({ ...pad }));
  }

  function getPadAt(x) {
    const wrappedX = wrapX(x, worldWidth);

    for (const pad of normalizedPads) {
      const distance = shortestWrappedDistance(wrappedX, pad.x, worldWidth);
      if (Math.abs(distance) <= pad.width / 2) {
        return pad;
      }
    }

    return null;
  }

  function getNearestPad(x) {
    if (normalizedPads.length === 0) {
      return null;
    }

    const wrappedX = wrapX(x, worldWidth);
    let best = null;

    for (const pad of normalizedPads) {
      const distance = Math.abs(shortestWrappedDistance(wrappedX, pad.x, worldWidth));
      if (!best || distance < best.distance) {
        best = { pad, distance };
      }
    }

    return best;
  }

  return {
    getPads,
    getPadAt,
    getNearestPad,
  };
}

function normalizePads(pads, worldWidth) {
  return pads.map((pad, index) => {
    const width = Math.max(1, pad.width || 100);
    const height = typeof pad.height === "number" ? pad.height : 120;
    const lineWidth = typeof pad.lineWidth === "number" ? pad.lineWidth : 4;
    const surfaceOffset =
      typeof pad.surfaceOffset === "number" ? pad.surfaceOffset : lineWidth / 2;

    return {
      id: pad.id || `pad-${index + 1}`,
      type: pad.type || "colony",
      x: wrapX(pad.x || 0, worldWidth),
      width,
      height,
      lineWidth,
      surfaceOffset,
    };
  });
}

function getDefaultPads(worldWidth) {
  return [
    { id: "colony", type: "colony", x: 0, width: 160, height: 140 },
    { id: "mine", type: "industrial", x: worldWidth * 0.25, width: 130, height: 120 },
    { id: "colony-2", type: "colony", x: worldWidth * 0.6, width: 140, height: 110 },
  ];
}

function wrapX(x, width) {
  const wrapped = x % width;
  return wrapped < 0 ? wrapped + width : wrapped;
}

function shortestWrappedDistance(a, b, width) {
  const delta = a - b;
  const wrapped = ((delta + width / 2) % width) - width / 2;
  return wrapped < -width / 2 ? wrapped + width : wrapped;
}
