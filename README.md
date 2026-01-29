# Lunar Transporter

Arcade-realistic lunar lander about hauling He3, managing fuel, and landing safely. Built as a modular HTML5 canvas game with a fixed-timestep loop, procedural terrain, and fully client-side JS. `index.php` only handles cache-busting and music playlist discovery.

## Quick start

```bash
php -S localhost:8000
```

Then open `http://localhost:8000` (from this directory).

## Features

- Fixed-timestep simulation with deterministic physics.
- Procedural terrain + dynamic space pads.
- Cargo economy: buy at mines, sell at colonies/repair pads.
- Procedural SFX and optional music playlist.
- Local saves for settings/config/run state.

## Gameplay

You pilot a cargo lander across a long procedural lunar surface. The loop is:

1. Launch, manage thrust and rotation, and land safely.
2. Buy He3 at industrial/mine pads.
3. Deliver and sell He3 at colony/repair pads.
4. Spend on fuel and repairs, and keep the ship intact.

Game over happens if money hits 0, or if fuel is 0 and you are not landed on a colony/repair pad with cargo to sell.

## Controls

Keyboard:
- Throttle: Up arrow or W
- Rotation: Left/Right arrows or A/D
- Refuel: R (on industrial/mine pads)
- Load cargo: L (on industrial/mine pads)
- Unload cargo: U (on colony/repair pads)
- Menu: Enter / Esc (as shown in on-screen prompts)

Gamepad:
- Throttle: Right trigger (button 7)
- Rotation: Left stick horizontal
- Refuel: LB (button 4)
- Load/Unload cargo: RB (button 5)
- Menu: A/B/Start (as shown in on-screen prompts)

The input system auto-detects keyboard vs gamepad and can be locked in Options.

## Procedural audio

All SFX are generated in real-time (no baked samples): engine rumble, thruster hiss, cooling pings, refuel hiss, cargo transfer noise, and repair ratchet bursts. Music playback is optional and uses the playlist discovered by `index.php`. Audio starts only after a user gesture to satisfy browser autoplay policies.

## Pads and economy

- Industrial / Mine pads: buy fuel and He3.
- Colony / Repair pads: sell He3 and repair hull.
- Crash landings can damage hull and drop fuel; towing can cost money.

## Difficulty

Difficulty scales thrust, gravity, and fuel burn. Default is HIGH; you can change it in Options.

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

## Saves and settings

Settings, config, and the current run are stored in localStorage. Save data includes ship state, cargo, pad positions, money, and thruster heat so engine temperature restores on load.

## Configuration

- `js/persistence/config.js` holds gameplay tuning defaults (fuel burn, heat, dust, etc.).
- `js/persistence/settings.js` holds user settings (volumes, difficulty, units).

## Notes

- ES modules only. No globals.
- Systems are split by responsibility (render/input/physics/etc.).
- All constants live in `js/core/constants.js`.
