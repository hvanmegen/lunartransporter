// Procedural ship rendering (no physics or camera logic).
export function drawShip(
  ctx,
  shipState,
  thrustInput = 0,
  rotationInput = 0,
  debug = false,
  rotationEnabled = true,
  thrusterHeat = null
) {
  const { position, rotation } = shipState;
  const model = shipState.model;

  if (!model) {
    return;
  }

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(rotation);

  drawParts(ctx, model.parts || [], model.centerOfMass || { x: 0, y: 0 });
  drawThrusters(ctx, thrustInput, model.thrusters || {}, thrusterHeat);
  drawRotationThrusters(ctx, rotationInput, model, rotationEnabled);
  if (debug) {
    drawDebugVectors(ctx, shipState, model);
  }

  ctx.restore();
}

function drawParts(ctx, parts, centerOfMass) {
  const com = centerOfMass || { x: 0, y: 0 };

  parts.forEach((partEntry) => {
    const part = partEntry.data || {};
    const offset = partEntry.offset || { x: 0, y: 0 };
    const center = partEntry.center || { x: 0, y: 0 };

    ctx.save();
    ctx.translate(offset.x - center.x - com.x, offset.y - center.y - com.y);
    drawShapes(ctx, part.shapes || []);
    drawLines(ctx, part.lines || []);
    ctx.restore();
  });
}

function drawShapes(ctx, shapes) {
  shapes.forEach((shape) => {
    ctx.save();
    if (shape.lineWidth) {
      ctx.lineWidth = shape.lineWidth;
    }
    if (shape.lineCap) {
      ctx.lineCap = shape.lineCap;
    }
    if (shape.fill) {
      ctx.fillStyle = shape.fill;
    }
    if (shape.stroke) {
      ctx.strokeStyle = shape.stroke;
    }

    if (shape.kind === "polygon") {
      const points = shape.points || [];
      if (points.length === 0) {
        ctx.restore();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.closePath();
      if (shape.fill) {
        ctx.fill();
      }
      if (shape.stroke) {
        ctx.stroke();
      }
    } else if (shape.kind === "circle") {
      const center = shape.center || [0, 0];
      const radius = shape.radius || 0;
      ctx.beginPath();
      ctx.arc(center[0], center[1], radius, 0, Math.PI * 2);
      if (shape.fill) {
        ctx.fill();
      }
      if (shape.stroke) {
        ctx.stroke();
      }
    } else if (shape.kind === "rect") {
      const x = shape.x || 0;
      const y = shape.y || 0;
      const w = shape.width || 0;
      const h = shape.height || 0;
      if (shape.fill) {
        ctx.fillRect(x, y, w, h);
      }
      if (shape.stroke) {
        ctx.strokeRect(x, y, w, h);
      }
    }

    ctx.restore();
  });
}

function drawLines(ctx, lines) {
  lines.forEach((line) => {
    const points = line.points || [];
    if (points.length === 0) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = line.stroke || "#dfe6ee";
    ctx.lineWidth = line.lineWidth || 2;
    ctx.lineCap = line.lineCap || "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();
    ctx.restore();
  });
}

function drawThrusters(ctx, thrustInput, thrusters, thrusterHeat) {
  const clamped = clamp(thrustInput, -1, 1);
  const mainHeat =
    thrusterHeat && typeof thrusterHeat.main === "number" ? thrusterHeat.main : 0;

  if (clamped > 0) {
    drawMainFlame(ctx, clamped, thrusters.main, mainHeat);
  }
}

function drawMainFlame(ctx, strength, thruster, heat) {
  const flameLength = 8 + strength * 20;
  const flameWidth = 4 + strength * 3;
  const offset = thruster && thruster.offset ? thruster.offset : [0, 16];
  const flameColors = getFlameColors(heat);

  ctx.save();
  ctx.translate(offset[0], offset[1]);
  drawEngineBellHeat(ctx, heat);
  ctx.strokeStyle = flameColors.outer;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, flameLength);
  ctx.lineTo(-flameWidth, 0);
  ctx.lineTo(flameWidth, 0);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = flameColors.inner;
  ctx.beginPath();
  ctx.moveTo(0, flameLength * 0.7);
  ctx.lineTo(-flameWidth * 0.6, 0);
  ctx.lineTo(flameWidth * 0.6, 0);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

function getFlameColors(heat) {
  const t = clamp(heat || 0, 0, 1);
  const outer = lerpColor([70, 150, 255], [255, 180, 70], t);
  const inner = lerpColor([200, 235, 255], [255, 235, 200], t * 0.9);
  return {
    outer: toRgb(outer),
    inner: toRgb(inner),
  };
}

function drawEngineBellHeat(ctx, heat) {
  const t = clamp(heat || 0, 0, 1);
  if (t <= 0) {
    return;
  }

  const color = lerpColor([70, 20, 18], [220, 90, 50], t * 0.9);
  ctx.save();
  ctx.strokeStyle = toRgba(color, 0.6);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-6.5, 0);
  ctx.lineTo(6.5, 0);
  ctx.stroke();
  ctx.restore();
}

function lerpColor(from, to, t) {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

function toRgb(color) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function toRgba(color, alpha) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function drawRotationThrusters(ctx, rotationInput, model, rotationEnabled) {
  const bounds = model.bounds || { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const center =
    model.centerOfMass
      ? { x: 0, y: 0 }
      : {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2,
        };

  const offsetX = Math.max(6, width * 0.35);
  const offsetY = Math.max(6, height * 0.25);
  const topOffsetX = offsetX * 0.8;
  const bottomOffsetX = offsetX * 1.15;

  // Ship space uses +X right, +Y down. Spec uses +Y up, so the selected corners are flipped.
  const topLeft = { x: center.x - topOffsetX, y: center.y - offsetY };
  const topRight = { x: center.x + topOffsetX, y: center.y - offsetY };
  const bottomLeft = { x: center.x - bottomOffsetX, y: center.y + offsetY };
  const bottomRight = { x: center.x + bottomOffsetX, y: center.y + offsetY };

  const nozzleLeft = { x: 1, y: 0 };
  const nozzleRight = { x: -1, y: 0 };

  const topLeftNozzle = drawRotationNozzle(ctx, topLeft, nozzleLeft);
  const topRightNozzle = drawRotationNozzle(ctx, topRight, nozzleRight);
  const bottomLeftNozzle = drawRotationNozzle(ctx, bottomLeft, nozzleLeft);
  const bottomRightNozzle = drawRotationNozzle(ctx, bottomRight, nozzleRight);

  if (rotationInput > 0) {
    // Right turn: y+ x- and y- x+ in y-up space -> top-left + bottom-right in canvas space.
    if (rotationEnabled) {
      const strength = Math.min(Math.abs(rotationInput), 1);
      if (strength > 0.01) {
        drawRotationFlame(ctx, topLeftNozzle, strength);
        drawRotationFlame(ctx, bottomRightNozzle, strength);
      }
    }
  } else {
    // Left turn: y- x- and y+ x+ in y-up space -> bottom-left + top-right in canvas space.
    if (rotationEnabled) {
      const strength = Math.min(Math.abs(rotationInput), 1);
      if (strength > 0.01) {
        drawRotationFlame(ctx, bottomLeftNozzle, strength);
        drawRotationFlame(ctx, topRightNozzle, strength);
      }
    }
  }
}

function drawRotationFlame(ctx, nozzle, strength) {
  if (!nozzle) {
    return;
  }

  const nx = -nozzle.dirX;
  const ny = -nozzle.dirY;
  const flameLength = 4 + strength * 6;
  const flameWidth = 1.5 + strength * 1.5;
  const baseX = nozzle.exitX + nx * 8;
  const baseY = nozzle.exitY + ny * 8;
  const tipX = baseX + nx * flameLength;
  const tipY = baseY + ny * flameLength;
  const perpX = -ny;
  const perpY = nx;
  const baseLeftX = baseX + perpX * flameWidth;
  const baseLeftY = baseY + perpY * flameWidth;
  const baseRightX = baseX - perpX * flameWidth;
  const baseRightY = baseY - perpY * flameWidth;

  ctx.save();
  ctx.strokeStyle = "#f5a623";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseLeftX, baseLeftY);
  ctx.lineTo(baseRightX, baseRightY);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawRotationNozzle(ctx, position, direction) {
  const dirX = direction && Number.isFinite(direction.x) ? direction.x : 1;
  const dirY = direction && Number.isFinite(direction.y) ? direction.y : 0;
  const length = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / length;
  const ny = dirY / length;
  const perpX = -ny;
  const perpY = nx;
  const nozzleLength = 6;
  const nozzleWidth = 3.2;
  const baseInset = 2;
  const baseX = position.x - nx * baseInset;
  const baseY = position.y - ny * baseInset;
  const tipX = position.x + nx * nozzleLength;
  const tipY = position.y + ny * nozzleLength;

  ctx.save();
  ctx.strokeStyle = "#9aa7b2";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(baseX + perpX * nozzleWidth, baseY + perpY * nozzleWidth);
  ctx.lineTo(baseX - perpX * nozzleWidth, baseY - perpY * nozzleWidth);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  return {
    exitX: tipX,
    exitY: tipY,
    dirX: nx,
    dirY: ny,
  };
}

function drawDebugVectors(ctx, shipState, model) {
  if (!model || !model.bounds || !shipState) {
    return;
  }

  const bounds = model.bounds;
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const com = { x: 0, y: 0 };
  const velocity = shipState.velocity || { x: 0, y: 0 };
  const speed = Math.hypot(velocity.x, velocity.y);

  ctx.save();
  ctx.strokeStyle = "#45c6ff";
  ctx.fillStyle = "#45c6ff";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(com.x, com.y);
  ctx.stroke();

  drawDebugDot(ctx, center.x, center.y, 2.5);
  drawDebugDot(ctx, com.x, com.y, 3.5);
  ctx.restore();

  if (speed <= 0.01) {
    return;
  }

  ctx.save();
  ctx.rotate(-(shipState.rotation || 0));
  ctx.strokeStyle = "#7cff6b";
  ctx.fillStyle = "#7cff6b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(velocity.x, velocity.y);
  ctx.stroke();

  const angle = Math.atan2(velocity.y, velocity.x);
  const arrowSize = 6;
  const tipX = velocity.x;
  const tipY = velocity.y;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - Math.cos(angle - Math.PI / 6) * arrowSize,
    tipY - Math.sin(angle - Math.PI / 6) * arrowSize
  );
  ctx.lineTo(
    tipX - Math.cos(angle + Math.PI / 6) * arrowSize,
    tipY - Math.sin(angle + Math.PI / 6) * arrowSize
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDebugDot(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
