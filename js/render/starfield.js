// Simple starfield background renderer.
export function createStarfield({
  width = 0,
  height = 0,
  density = 0.00012,
} = {}) {
  let stars = [];
  let size = { width, height };
  let buffer = null;

  function resize(nextWidth, nextHeight) {
    size = { width: nextWidth, height: nextHeight };
    stars = generateStars(nextWidth, nextHeight, density);
    buffer = createBuffer(size, stars);
  }

  function draw(ctx) {
    if (stars.length === 0 && size.width > 0 && size.height > 0) {
      stars = generateStars(size.width, size.height, density);
      buffer = createBuffer(size, stars);
    }

    if (buffer) {
      ctx.drawImage(buffer, 0, 0);
      return;
    }

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size.width, size.height);
  }

  return {
    resize,
    draw,
  };
}

function generateStars(width, height, density) {
  const count = Math.max(30, Math.floor(width * height * density));
  const stars = new Array(count);

  for (let i = 0; i < count; i += 1) {
    stars[i] = {
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() < 0.15 ? 2 : 1,
      alpha: 0.2 + Math.random() * 0.6,
    };
  }

  return stars;
}

function createBuffer(size, stars) {
  if (size.width === 0 || size.height === 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size.width, size.height);

  ctx.fillStyle = "#ffffff";
  stars.forEach((star) => {
    ctx.globalAlpha = star.alpha;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });

  ctx.globalAlpha = 1;
  return canvas;
}
