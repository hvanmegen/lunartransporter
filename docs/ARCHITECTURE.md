# Architecture

This project is organized as small, isolated systems. Each system owns one responsibility and communicates through plain data objects.

## Core loop

- `js/core/time.js` provides a fixed-timestep accumulator (`1/60`).
- `js/core/state.js` is a small state machine.
- `js/core/game.js` drives `update(dt)` and `render(ctx)`.

## Rendering

- `js/render/camera.js` applies camera transforms (`begin/end`) and smooth follow/zoom.
- `js/ship/render.js` draws the ship procedurally from ship state + thrust input.

## World

- `js/world/terrain.js` builds a 1D heightmap and draws only the visible segment.
- `js/world/collision.js` checks ship vs terrain and resolves landing outcomes.

## Ship

- `js/ship/ship.js` owns ship state and delegates physics.
- `js/ship/physics.js` integrates velocity/position, fuel use, thrust.
- `js/ship/modules/` defines modules and loadouts; stats are aggregated dynamically.

## Input

- `js/controls/keyboard.js` reads key state.
- `js/controls/gamepad.js` reads gamepad axes/buttons with deadzones.
- `js/controls/input.js` selects the active source.

## Economy

- `js/economy/cargo.js` manages cargo slots and mass/value totals.
- `js/economy/economy.js` handles money, delivery payout, repairs, and game over.
