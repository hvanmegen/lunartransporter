// Ship model loader for JSON-defined parts and ships.
const partCache = new Map();

export async function loadShipModel(name = "default") {
  const shipDef = await fetchJson(new URL(`../ships/${name}.json`, import.meta.url));
  const parts = await Promise.all(
    (shipDef.parts || []).map(async (entry, index) => {
      const part = await loadPart(entry.partId);
      return {
        id: entry.partId,
        offset: normalizeOffset(entry.offset),
        zIndex: index,
        data: part,
        mass: normalizeMass(part.mass),
        cargoCapacity: normalizeCapacity(part.cargoCapacity),
        center: normalizeCenter(part.center),
      };
    })
  );

  const { centerOfMass, totalMass, cargoCapacity } = computeMassProperties(parts);
  const bounds = computeBounds(parts, centerOfMass);

  return {
    id: shipDef.id || name,
    name: shipDef.name || name,
    parts,
    bounds,
    collisionBottom: bounds.maxY,
    mass: totalMass,
    cargoCapacity,
    centerOfMass,
    thrusters: shipDef.thrusters || {},
  };
}

async function loadPart(partId) {
  if (!partId) {
    return { id: "", shapes: [], lines: [] };
  }

  if (partCache.has(partId)) {
    return partCache.get(partId);
  }

  const part = await fetchJson(new URL(`../ship-parts/${partId}.json`, import.meta.url));
  partCache.set(partId, part);
  return part;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

function normalizeOffset(offset) {
  if (!Array.isArray(offset) || offset.length < 2) {
    return { x: 0, y: 0 };
  }

  return { x: Number(offset[0]) || 0, y: Number(offset[1]) || 0 };
}

function normalizeCenter(center) {
  if (!Array.isArray(center) || center.length < 2) {
    return { x: 0, y: 0 };
  }

  return { x: Number(center[0]) || 0, y: Number(center[1]) || 0 };
}

function normalizeMass(mass) {
  if (typeof mass !== "number" || !Number.isFinite(mass)) {
    return 0;
  }

  return mass;
}

function normalizeCapacity(capacity) {
  if (typeof capacity !== "number" || !Number.isFinite(capacity)) {
    return 0;
  }

  return capacity;
}

function computeMassProperties(parts) {
  let totalMass = 0;
  let sumX = 0;
  let sumY = 0;
  let cargoCapacity = 0;

  parts.forEach((partEntry) => {
    const mass = partEntry.mass || 0;
    totalMass += mass;
    sumX += partEntry.offset.x * mass;
    sumY += partEntry.offset.y * mass;
    cargoCapacity += partEntry.cargoCapacity || 0;
  });

  if (totalMass <= 0) {
    return { totalMass: 0, centerOfMass: { x: 0, y: 0 }, cargoCapacity };
  }

  return {
    totalMass,
    centerOfMass: { x: sumX / totalMass, y: sumY / totalMass },
    cargoCapacity,
  };
}

function computeBounds(parts, centerOfMass) {
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  const com = centerOfMass || { x: 0, y: 0 };

  parts.forEach((partEntry) => {
    const offset = partEntry.offset;
    const center = partEntry.center || { x: 0, y: 0 };
    const part = partEntry.data || {};
    const linePadding = 0;
    const shiftX = offset.x - center.x - com.x;
    const shiftY = offset.y - center.y - com.y;

    (part.shapes || []).forEach((shape) => {
      const width = (shape.lineWidth || linePadding) / 2;
      if (shape.kind === "polygon") {
        (shape.points || []).forEach((point) => {
          addPoint(bounds, point[0] + shiftX, point[1] + shiftY, width);
        });
      } else if (shape.kind === "circle") {
        const center = shape.center || [0, 0];
        const radius = shape.radius || 0;
        addPoint(bounds, center[0] + shiftX + radius, center[1] + shiftY + radius, width);
        addPoint(bounds, center[0] + shiftX - radius, center[1] + shiftY - radius, width);
      } else if (shape.kind === "rect") {
        const x = shape.x || 0;
        const y = shape.y || 0;
        const w = shape.width || 0;
        const h = shape.height || 0;
        addPoint(bounds, x + shiftX, y + shiftY, width);
        addPoint(bounds, x + shiftX + w, y + shiftY + h, width);
      }
    });

    (part.lines || []).forEach((line) => {
      const width = (line.lineWidth || 0) / 2;
      (line.points || []).forEach((point) => {
        addPoint(bounds, point[0] + shiftX, point[1] + shiftY, width);
      });
    });
  });

  if (!Number.isFinite(bounds.minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return bounds;
}

function addPoint(bounds, x, y, padding = 0) {
  bounds.minX = Math.min(bounds.minX, x - padding);
  bounds.minY = Math.min(bounds.minY, y - padding);
  bounds.maxX = Math.max(bounds.maxX, x + padding);
  bounds.maxY = Math.max(bounds.maxY, y + padding);
}
