# Agent Guide: Lunar Transporter

## Overview
Lunar Transporter is a modular HTML5 canvas game about hauling He3 on the Moon. The runtime is fully client‑side JavaScript; `index.php` only provides cache‑busting and a music playlist JSON.

## Entry points
- `index.php` — server entry, asset versioning, music playlist discovery.
- `js/main.js` — creates the canvas, loads config/settings, starts the game.
- `js/core/game.js` — main loop, state machine, HUD, audio hooks.

## Runtime flow
- Fixed‑timestep simulation (60 FPS update) + variable render.
- State machine in `js/core/state.js`.
- Menu/options rendered to the same canvas as gameplay.

## Game states (core)
`menu`, `options`, `flight`, `landing`, `landed`, `crashlanded`, `crashed`, `out_of_fuel`, `game_over`.

## Economy + game over rules
- Economy in `js/economy/economy.js`.
- Game over triggers when money <= 0 (rounded) or when fuel is 0 and you are not landed on a colony/repair pad with cargo to sell.

## Audio
- SFX: `js/audio/audioEngine.js` (procedural).
- Music: `js/audio/musicPlayer.js` (HTMLAudioElement).
- Audio starts only after user input (browser policy).
- Entering `game_over` mutes all SFX and stops music.

## Persistence
LocalStorage keys (see `js/persistence/`):
- Config: `lunartransporter.config.v1`
- Settings: `lunartransporter.settings.v1`
- Save: `lunartransporter.save.v2`

Save data includes ship/world/run snapshot, plus `ship.thrusterHeat` so engine temperature restores on load.

## Key modules
- `js/core/` — state machine, timing, constants, HUD, main loop.
- `js/game/` — new game setup and run initialization.
- `js/world/` — terrain generation, space pads, collision.
- `js/ship/` — physics, procedural rendering, parts loader.
- `js/controls/` — keyboard/gamepad input and mode selection.
- `js/ui/` — menu and options screens.
- `js/render/` — camera, dust, rendering helpers.
- `js/audio/` — SFX and music player.
- `js/persistence/` — settings/config/save normalization.

## Common tweaks
- Difficulty tuning: `getDifficultyTuning` in `js/core/game.js`.
- Options layout: `js/ui/renderOptions.js`.
- Default settings: `js/persistence/settings.js`.
- Economy rates and heat model: `js/persistence/config.js`.
- Audio tuning: `js/audio/audioEngine.js`.

## Gotchas
- No build step; ES modules only.
- Music playback requires a user gesture.
- Saves are localStorage; clearing browser storage resets everything.
