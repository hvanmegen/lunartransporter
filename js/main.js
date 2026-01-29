import { createGame } from "./core/game.js";
import { loadShipModel } from "./ship/loader.js";

function createCanvas() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  function resize() {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.dataset.pixelRatio = String(pixelRatio);

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  resize();

  return { canvas, resize };
}

async function start() {
  const { canvas, resize } = createCanvas();
  document.body.appendChild(canvas);

  const shipModel = await loadShipModel("default");
  const tracks = readMusicTracks();
  const game = createGame({ canvas, shipModel, musicTracks: tracks });
  game.start();

  window.addEventListener("resize", resize);
}

function readMusicTracks() {
  const element = document.getElementById("music-tracks");
  if (!element) {
    return [];
  }

  try {
    const data = JSON.parse(element.textContent || "[]");
    return Array.isArray(data) ? data : [];
  } catch (_error) {
    return [];
  }
}

start();
