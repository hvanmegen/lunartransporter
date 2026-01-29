// Lightweight ground dust particle system.
export function createDustSystem({
  maxParticles = 120,
  spawnRate = 80,
  baseSpeed = 12,
  lift = 6,
  spread = 18,
  size = 1.4,
  life = 0.7,
} = {}) {
  const particles = [];
  let spawnAccumulator = 0;

  function update(dt, { active = false, x = 0, groundY = 0, intensity = 0 } = {}) {
    if (active) {
      spawnAccumulator += spawnRate * clamp(intensity, 0, 1) * dt;
      const count = Math.floor(spawnAccumulator);
      spawnAccumulator -= count;
      for (let i = 0; i < count; i += 1) {
        if (particles.length >= maxParticles) {
          break;
        }
        const angle = (Math.random() - 0.5) * Math.PI;
        const speed = baseSpeed + Math.random() * baseSpeed;
        const vx = Math.cos(angle) * speed;
        const vy = -Math.abs(Math.sin(angle)) * (lift + Math.random() * lift);
        particles.push({
          x: x + (Math.random() - 0.5) * spread,
          y: groundY + 1 + Math.random() * 2,
          vx,
          vy,
          age: 0,
          ttl: life * (0.7 + Math.random() * 0.6),
          size: size * (0.8 + Math.random() * 0.6),
        });
      }
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.ttl) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function draw(ctx) {
    if (particles.length === 0) {
      return;
    }

    ctx.save();
    ctx.fillStyle = "#c2c6cb";

    particles.forEach((p) => {
      const t = 1 - p.age / p.ttl;
      ctx.globalAlpha = Math.max(0, t * 0.6);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  return {
    update,
    draw,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
