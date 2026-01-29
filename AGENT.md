# Agent Guide: Lunar Transporter

## App overview
Lunar Transporter is a modular HTML5 canvas game. The runtime is fully client-side JavaScript, but `index.php` is used to:
- Add cache-busting query params to JS assets.
- Scan `media/music/` for playable tracks.
- Emit a `music-tracks` JSON script tag consumed by the JS bootstrapping.

The core game loop uses a fixed timestep (60 FPS update) and renders to a full-window canvas. Telemetry and menus are drawn on the same canvas.

## Entry points
- `index.php` — server entry, asset versioning, music playlist discovery.
- `js/main.js` — creates the canvas, loads JSON config, starts the game.
- `js/core/game.js` — main loop, state machine, and orchestration.

## Major modules
- `js/core/` — game state machine, timing, constants, high-level orchestration.
- `js/render/` — camera and visual helpers.
- `js/world/` — terrain generation, space pads, and collision system.
- `js/ship/` — ship physics, procedural render, parts loader.
- `js/controls/` — keyboard/gamepad input and unified input adapter.
- `js/ui/` — menu and options screens.
- `js/audio/` — procedural SFX and music player.
- `js/persistence/` — localStorage for settings, config, and saves.
- `js/game/` — new-game setup, pad placement, run initialization.

## Persistence
- Config: `lunartransporter.config.v1` (debug and tuning defaults).
- Settings: `lunartransporter.settings.v1` (input mode, volumes, units).
- Save: `lunartransporter.save.v2` (ship/world/run snapshot).

## Music playlist
`index.php` scans `media/music/` for `.mp3`, `.ogg`, or `.wav` and emits a playlist. The JS music player cycles through this list and resumes playback if a save file contains a stored track/time.

## Conventions
- ES modules only (no globals).
- One system per file.
- Physics/input/render are kept separate.
- Constants live in `js/core/constants.js` and config defaults in `js/persistence/config.js`.
