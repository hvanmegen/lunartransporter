# Lunar Trucker

Modular HTML5 canvas lander with a fixed-timestep loop, procedural terrain, ship physics, and a menu/options flow. The game runs fully client-side; `index.php` is used only for asset versioning and music playlist discovery.

## Quick start

```bash
php -S localhost:8000
```

Then open `http://localhost:8000` (from this directory).

## Project structure

- `index.php` — entry point, cache-busting, music playlist JSON.
- `js/main.js` — bootstraps canvas + game.
- `js/core/` — timing, state machine, constants, game loop.
- `js/render/` — camera + rendering helpers.
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

## Notes

- ES modules only. No globals.
- Systems are split by responsibility (render/input/physics/etc.).
- All constants live in `js/core/constants.js`.
