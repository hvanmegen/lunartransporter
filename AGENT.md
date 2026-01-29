# Agent Guide: Lunar Transporter

This repo is a modular HTML5 canvas game. Everything runs in the browser with ES modules. There is no build step. `index.php` exists only to serve assets with cache-busting and to discover music files.

## Quick mental model
- Single canvas, full-screen render.
- Fixed-timestep update loop (60 FPS update) with variable render.
- State machine drives menu/options/flight/landing/crash/game over.
- Physics + economy + audio are all deterministic per frame.
- Saves/config/settings are localStorage.

## Entry points
- `index.php` — cache-busting query params, music playlist JSON.
- `js/main.js` — bootstraps canvas and starts the game.
- `js/core/game.js` — main orchestration: state machine, update loop, render, audio hooks.

## Runtime flow (high level)
1. `createGame()` builds state, audio, inputs, menu/options.
2. State machine sets `menu` by default.
3. On user input, audio is started (browser autoplay policy).
4. Update loop runs in fixed timesteps: input -> physics -> collision -> economy -> audio -> telemetry.
5. Render runs once per frame using the most recent state.

## Game states
`menu`, `options`, `flight`, `landing`, `landed`, `crashlanded`, `crashed`, `out_of_fuel`, `game_over`.

State handling lives in `js/core/game.js` with helpers in `js/core/state.js`.

## Gameplay rules (summary)
- Launch, fly, land, buy fuel and He3 at industrial/mine pads.
- Sell He3 and repair at colony/repair pads.
- Crashes damage hull and may dump cargo or fuel; towing can cost money.
- Game over triggers when:
  - money <= 0 (rounded), or
  - fuel is 0 and you are not landed on a colony/repair pad with cargo to sell.

## Controls (source of truth)
Keyboard (`js/controls/keyboard.js`):
- Throttle: Up arrow or W
- Rotation: Left/Right arrows or A/D
- Refuel: R
- Load cargo: L
- Unload cargo: U

Gamepad (`js/controls/gamepad.js`):
- Rotation: left stick X (axis 0)
- Throttle: right trigger (button 7)
- Refuel: LB (button 4)
- Load/Unload: RB (button 5)

Input selector (`js/controls/input.js`) auto-switches between keyboard/gamepad unless forced in Options.

## Pads and economy
Pad types (used in `js/core/game.js` and `js/world/spacePads.js`):
- Industrial/Mine: refuel + buy He3
- Colony/Repair: sell He3 + repair hull

Economy (`js/economy/economy.js`):
- `addMoney`/`spendMoney` can trigger game over
- He3 buy price uses `fuelCostPerKg * cargoHe3CostMultiplier`
- He3 sell price uses `fuelCostPerKg * cargoHe3SellMultiplier`

## Audio system
Procedural SFX (`js/audio/audioEngine.js`):
- Engine rumble, thruster hiss, cooling pings, refuel hiss, cargo transfer, repair ratchet.
- Audio starts only after user gesture.
- Entering `game_over` stops all SFX and music.

Music (`js/audio/musicPlayer.js`):
- `index.php` scans `media/music/` for `mp3/ogg/wav` and provides playlist JSON.
- Music state (track + time) is saved/restored.

## Rendering + camera
- `js/render/` for camera helpers and dust rendering.
- The HUD, menus, and game overlays render to the same canvas.

## Physics + ship
- Physics core in `js/ship/` and `js/core/game.js`.
- Thruster heat model in `js/ship/thrusterHeat.js`.
- Landing checks and crash handling in `js/core/game.js`.

## Save/load (localStorage)
Keys:
- Config: `lunartransporter.config.v1`
- Settings: `lunartransporter.settings.v1`
- Save: `lunartransporter.save.v2`

Save model includes ship/world/run snapshot plus `ship.thrusterHeat` so engine temp restores on load.

## Config and settings
Defaults:
- `js/persistence/config.js` — tuning: heat model, dust, fuel costs, pad spacing, etc.
- `js/persistence/settings.js` — user settings: volumes, difficulty, units, input mode.

Options UI uses defaults in `js/ui/options.js`.

## Common change locations
- Difficulty tuning: `getDifficultyTuning()` in `js/core/game.js`
- Options layout: `js/ui/renderOptions.js`
- Controls text prompts: `js/core/game.js` (pad prompts)
- Audio tuning: `js/audio/audioEngine.js`
- Economy rates: `js/persistence/config.js`
- Default settings: `js/persistence/settings.js`
- HUD layout: `renderHud()` in `js/core/game.js`

## Debugging tips
- Use `config.debug` to unlock debug display.
- Watch for audio autoplay policy: SFX/music only start after user input.
- If save/load misbehaves, clear localStorage.

## Gotchas
- No build step; all ES modules.
- Music requires user gesture (browser policy).
- LocalStorage is the only persistence.
