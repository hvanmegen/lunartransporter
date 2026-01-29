# Lunar Transporter

Arcade‑realistic lunar lander about hauling He3, managing fuel, and landing safely. Built as a modular HTML5 canvas game with a fixed‑timestep loop, procedural terrain, and fully client‑side JS. `index.php` only handles cache‑busting and music playlist discovery.

## Quick start

```bash
php -S localhost:8000
```

Then open `http://localhost:8000` (from this directory).

## Features

- Fixed‑timestep simulation with deterministic physics.
- Procedural terrain + dynamic space pads.
- Cargo economy: buy at mines, sell at colonies/repair pads.
- Procedural SFX and optional music playlist.
- Local saves for settings/config/run state.

## Project structure

- `index.php` — entry point, cache-busting, music playlist JSON.
- `js/main.js` — bootstraps canvas + game.
- `js/core/` — timing, state machine, constants, game loop, HUD.
- `js/render/` — camera + rendering helpers + dust.
- `js/world/` — terrain, space pads, collision.
- `js/ship/` — ship physics, procedural render, parts loader.
- `js/controls/` — keyboard/gamepad input + mode selector.
- `js/ui/` — menu and options screens.
- `js/audio/` — procedural SFX + music player.
- `js/persistence/` — localStorage for settings/config/saves.
- `js/game/` — new-game setup and run initialization.
- `media/music/` — optional music tracks (mp3/ogg/wav), auto-playlist.

## Music playlist

Drop `.mp3` or `.ogg` files into `media/music/`. The PHP entry scans this folder and passes the playlist to the game. Files in this directory are intentionally ignored by git.

## Configuration

- `js/persistence/config.js` holds gameplay tuning defaults (fuel burn, heat, dust, etc.).
- `js/persistence/settings.js` holds user settings (volumes, difficulty, units).

## Notes

- ES modules only. No globals.
- Systems are split by responsibility (render/input/physics/etc.).
- All constants live in `js/core/constants.js`.
