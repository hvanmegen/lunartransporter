import {
  LUNAR_GRAVITY,
  FUEL_MASS_PER_UNIT,
  HARD_LANDING_DAMAGE,
  EARTH_GRAVITY,
  LANDING_LATERAL_SPEED_THRESHOLD,
  LANDING_ROTATION_SPEED_THRESHOLD,
  LANDING_VERTICAL_SPEED_THRESHOLD,
  SHIP_ROTATION_FUEL_BURN_RATE,
  SHIP_COLLISION_RADIUS,
  SHIP_FUEL_BURN_RATE,
  SHIP_MASS,
  SHIP_MAX_RETRO_THRUST,
  SHIP_MAX_THRUST,
  SHIP_MAX_ROTATION_SPEED,
  SHIP_ROTATION_DAMPING,
  SHIP_ROTATION_SPEED,
  THRUST_EFFICIENCY,
  REFUEL_RATE,
  REFUEL_DING_INTERVAL,
  REPAIR_COST_PER_DAMAGE,
  CARGO_TRANSFER_RATE,
} from "./constants.js";
import { GameState, createStateMachine } from "./state.js";
import { createTime, FIXED_TIMESTEP } from "./time.js";
import { createInput } from "../controls/input.js";
import { createNewGame } from "../game/newGame.js";
import { createSpacePads } from "../world/spacePads.js";
import { createTerrain } from "../world/terrain.js";
import { hasSave, loadGame, saveGame } from "../persistence/save.js";
import { getDefaultSettings, loadSettings, saveSettings } from "../persistence/settings.js";
import { loadConfig, saveConfig } from "../persistence/config.js";
import { createMenu } from "../ui/menu.js";
import { createOptions } from "../ui/options.js";
import { renderMenu } from "../ui/renderMenu.js";
import { renderOptions } from "../ui/renderOptions.js";
import { createCamera } from "../render/camera.js";
import { createAudioEngine } from "../audio/audioEngine.js";
import { createMusicPlayer } from "../audio/musicPlayer.js";
import { drawShip } from "../ship/render.js";
import { createShipPhysics } from "../ship/physics.js";
import { updateThrusterHeat, createThrusterHeatState } from "../ship/thrusterHeat.js";
import { createCollisionSystem } from "../world/collision.js";
import { calculateShipStats } from "../ship/modules/registry.js";
import { createCargoHold } from "../economy/cargo.js";
import { createEconomy } from "../economy/economy.js";
import { createStarfield } from "../render/starfield.js";
import { createDustSystem } from "../render/dust.js";

// Main loop and state manager.
export function createGame({ canvas, shipModel = null, musicTracks = [] }) {
  const context = canvas.getContext("2d");
  const time = createTime();
  const stateMachine = createStateMachine(GameState.MENU);
  let runState = null;

  let config = loadConfig();
  const mainMenu = createMenu({
    title: "Lunar Transporter",
    items: buildMainMenuItems(config, runState, hasSave()),
  });

  let settings = loadSettingsOrDefault();
  let musicEnabled = isMusicEnabled(settings);
  let sfxEnabled = isSfxEnabled(settings);
  let hasUserStartedMusic = false;
  let hasUserStartedAudio = false;
  const audio = createAudioEngine({
    masterVolume: settings.masterVolume / 100,
    sfxVolume: settings.sfxVolume / 100,
  });
  const musicDisplay = {
    title: "",
    timer: 0,
    enabled: musicEnabled,
  };
  const music = createMusicPlayer({
    tracks: musicTracks,
    volume: (settings.masterVolume / 100) * (settings.musicVolume / 100),
    onTrackChange: (src) => {
      if (!musicEnabled) {
        return;
      }
      musicDisplay.title = formatTrackTitle(src);
      musicDisplay.timer = 0;
    },
  });
  const options = createOptions({
    title: "Options",
    settings,
    onApply: (nextSettings) => {
      settings = nextSettings;
      flightInput.setMode(settings.inputMode);
      updateAudioSettings();
      return saveSettings(nextSettings);
    },
  });

  const pauseInput = createPauseInput();
  const flightInput = createInput({ mode: settings.inputMode, debug: config.debug });
  const starfield = createStarfield();
  let starfieldSize = { width: 0, height: 0 };
  let animationFrameId = 0;
  let running = false;
  const logDebug = createLogger(config);
  updateAudioSettings();

  stateMachine
    .addState(GameState.MENU, {
      update(deltaSeconds) {
        const action = mainMenu.update(deltaSeconds);
        if (sfxEnabled) {
          audio.update({ state: GameState.MENU, throttle: 0, rotation: 0 });
        }
        if (action) {
          if (action.type === "back") {
            if (runState && runState.paused) {
              runState.paused = false;
              stateMachine.setState(runState.currentState || GameState.LANDED);
              logDebug("resume from menu");
            }
            return;
          }
          handleMenuAction(action);
        }
      },
    })
    .addState(GameState.OPTIONS, {
      update(deltaSeconds) {
        const action = options.update(deltaSeconds);
        if (sfxEnabled) {
          audio.update({ state: GameState.OPTIONS, throttle: 0, rotation: 0 });
        }
        if (!action) {
          return;
        }

        if (action.type === "back") {
          mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
          stateMachine.setState(GameState.MENU);
        }
      },
    })
    .addState(GameState.FLIGHT, {
      update(deltaSeconds) {
        pauseInput.update();
        if (pauseInput.consume()) {
          if (runState) {
            runState.paused = true;
            runState.currentState = GameState.FLIGHT;
          }
          mainMenu.clearInput();
          mainMenu.suppressBack();
          mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
          stateMachine.setState(GameState.MENU);
          return;
        }

        updateRun(deltaSeconds);
      },
    })
    .addState(GameState.LANDED, {
      update(deltaSeconds) {
        pauseInput.update();
        if (pauseInput.consume()) {
          if (runState) {
            runState.paused = true;
            runState.currentState = GameState.LANDED;
          }
          mainMenu.clearInput();
          mainMenu.suppressBack();
          mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
          stateMachine.setState(GameState.MENU);
          return;
        }

        if (shouldLaunch()) {
          transitionToFlight();
          return;
        }

        updateRun(deltaSeconds);
      },
    })
    .addState(GameState.LANDING, {
      update(deltaSeconds) {
        pauseInput.update();
        if (pauseInput.consume()) {
          if (runState) {
            runState.paused = true;
            runState.currentState = GameState.LANDING;
          }
          mainMenu.clearInput();
          mainMenu.suppressBack();
          mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
          stateMachine.setState(GameState.MENU);
          return;
        }

        updateRun(deltaSeconds);
      },
    })
    .addState(GameState.CRASHLANDED, {
      update(deltaSeconds) {
        pauseInput.update();
        if (pauseInput.consume()) {
          resetRunToMenu();
          return;
        }

        if (shouldLaunch()) {
          transitionToFlight();
          return;
        }

        updateRun(deltaSeconds);
      },
    })
    .addState(GameState.OUT_OF_FUEL, {
      update(deltaSeconds) {
        pauseInput.update();
        if (pauseInput.consume()) {
          if (runState) {
            runState.paused = true;
            runState.currentState = GameState.OUT_OF_FUEL;
          }
          mainMenu.clearInput();
          mainMenu.suppressBack();
          mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
          stateMachine.setState(GameState.MENU);
          return;
        }

        updateRun(deltaSeconds);
      },
    })
    .addState(GameState.CRASHED, {
      update() {
        pauseInput.update();
        if (pauseInput.consume()) {
          resetRunToMenu();
        }
      },
    })
    .addState(GameState.GAME_OVER, {
      enter() {
        if (audio.setEnabled) {
          audio.setEnabled(false);
        }
        music.stop();
        musicDisplay.title = "";
        musicDisplay.timer = 0;
      },
      update() {
        pauseInput.update();
        if (pauseInput.consume()) {
          resetRunToMenu();
        }
      },
    });

  function updateAudioSettings() {
    musicEnabled = isMusicEnabled(settings);
    sfxEnabled = isSfxEnabled(settings);
    musicDisplay.enabled = musicEnabled;

    audio.setMasterVolume(settings.masterVolume / 100);
    audio.setSfxVolume(settings.sfxVolume / 100);
    if (audio.setEnabled) {
      audio.setEnabled(sfxEnabled && hasUserStartedAudio);
    }

    const nextMusicVolume = (settings.masterVolume / 100) * (settings.musicVolume / 100);
    music.setVolume(nextMusicVolume);

    if (!musicEnabled) {
      music.stop();
      musicDisplay.title = "";
      musicDisplay.timer = 0;
      return;
    }

    if (hasUserStartedMusic) {
      music.start();
    }
  }

  function triggerGameOver() {
    if (stateMachine.getState() === GameState.GAME_OVER) {
      return;
    }
    stateMachine.setState(GameState.GAME_OVER);
    if (runState) {
      runState.currentState = GameState.GAME_OVER;
    }
  }

  function handleMenuAction(action) {
    if (action.type !== "select") {
      return;
    }

    if (sfxEnabled) {
      audio.start();
      hasUserStartedAudio = true;
      if (audio.setEnabled) {
        audio.setEnabled(true);
      }
    }
    if (musicEnabled) {
      music.start();
      hasUserStartedMusic = true;
    }
    logDebug("menu action", action.itemId);

    switch (action.itemId) {
      case "resume":
        resumeRun();
        break;
      case "start":
        startNewRun();
        break;
      case "options":
        stateMachine.setState(GameState.OPTIONS);
        break;
      case "save":
        handleSave();
        break;
      case "load":
        handleLoad();
        break;
      case "debug":
        toggleDebug();
        break;
      default:
        break;
    }
  }

  function resumeRun() {
    if (!runState) {
      startNewRun();
      return;
    }

    runState.paused = false;
    stateMachine.setState(runState.currentState || GameState.LANDED);
    logDebug("state ->", runState.currentState || GameState.LANDED);
    mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
  }

  function startNewRun() {
    if (musicEnabled && hasUserStartedMusic) {
      rotateMusicTrack(music, musicDisplay);
    }
    runState = createNewRun(stateMachine, shipModel, config);
    logDebug("new run created", runState);
    runState.paused = false;
    stateMachine.setState(runState.currentState || GameState.LANDED);
    logDebug("state ->", runState.currentState || GameState.LANDED);
    mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
  }

  function handleSave() {
    if (!runState || !runState.active) {
      mainMenu.setMessage("No active game to save.");
      return;
    }

    if (runState.currentState !== GameState.LANDED) {
      mainMenu.setMessage("Save only available while landed.");
      return;
    }

    if (isPlayableState(stateMachine.getState())) {
      runState.currentState = stateMachine.getState();
    }

    const payload = buildSaveModel(runState, music.getState());

    const result = saveGame(payload);
    if (result) {
      mainMenu.setMessage("Game saved.");
    } else {
      mainMenu.setMessage("Save failed.");
    }

    mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
  }

  function handleLoad() {
    const state =
      runState && runState.currentState ? runState.currentState : stateMachine.getState();
    if (state === GameState.FLIGHT) {
      mainMenu.setMessage("Load not available while in flight.");
      return;
    }

    const loaded = loadGame();
    if (!loaded) {
      mainMenu.setMessage("No save found.");
      logDebug("load failed: no save");
      return;
    }

    runState = normalizeLoadedRun(loaded, stateMachine, shipModel, config);
    applyLoadedMusic(music, musicDisplay, loaded.music);
    runState.paused = false;
    stateMachine.setState(runState.currentState || GameState.FLIGHT);
    logDebug("load success", runState);
    mainMenu.setMessage("Game loaded.");
    mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
  }

  function resetRunToMenu() {
    if (musicEnabled) {
      rotateMusicTrack(music, musicDisplay);
    } else {
      music.stop();
      musicDisplay.title = "";
      musicDisplay.timer = 0;
    }
    runState = null;
    mainMenu.setMessage("Run reset.");
          mainMenu.clearInput();
          mainMenu.suppressBack();
          mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
          stateMachine.setState(GameState.MENU);
    logDebug("reset run");
    mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
  }

  function toggleDebug() {
    config.debug = !config.debug;
    saveConfig(config);
    flightInput.setDebug(config.debug);
    mainMenu.setItems(buildMainMenuItems(config, runState, hasSave()));
    mainMenu.setMessage(config.debug ? "Debug enabled." : "Debug disabled.");
  }

  function updateRun(_deltaSeconds) {
    if (!runState) {
      return;
    }

    const deltaSeconds = _deltaSeconds;
    const ship = runState.ship;
    const terrain = runState.world && runState.world.terrain;
    const spacePads = runState.world && runState.world.spacePads;

    if (!ship || !terrain) {
      return;
    }

    if (flightInput.getLastUsedType) {
      runState.lastInputType = flightInput.getLastUsedType();
    }

    const altitude = getAltitudeFromNearestPad(runState);
    runState.altitude = altitude;
    const padAt = spacePads ? spacePads.getPadAt(ship.position.x) : null;
    runState.activePad = padAt;

    if (runState.currentState === GameState.FLIGHT && padAt) {
      runState.currentState = GameState.LANDING;
      stateMachine.setState(GameState.LANDING);
    } else if (runState.currentState === GameState.LANDING && !padAt) {
      runState.currentState = GameState.FLIGHT;
      stateMachine.setState(GameState.FLIGHT);
    }

    const rotationInput = flightInput.getRotation();
    const tuning = getDifficultyTuning(settings.difficulty);
    if (runState.shipPhysics) {
      runState.shipPhysics.setGravity(LUNAR_GRAVITY * tuning.gravityScale);
      runState.shipPhysics.setFuelBurnRate(SHIP_FUEL_BURN_RATE * tuning.fuelBurnScale);
    }
    const isControlledFlight =
      runState.currentState === GameState.FLIGHT || runState.currentState === GameState.LANDING;
    const rotationEnabled = isControlledFlight && altitude > 5;
    const isFlightState =
      runState.currentState === GameState.FLIGHT ||
      runState.currentState === GameState.LANDING ||
      runState.currentState === GameState.OUT_OF_FUEL;

    if (runState.cargoHold) {
      ship.cargoMass = runState.cargoHold.getTotalMass();
    }
    updateShipMass(ship);

    if (rotationEnabled) {
      applyRotationInput(ship, rotationInput, deltaSeconds, tuning);
      runState.rotationInput = rotationInput;
      consumeRotationFuel(ship, rotationInput, deltaSeconds, tuning.fuelBurnScale);
    } else {
      runState.rotationInput = 0;
      if (runState.currentState === GameState.LANDED || runState.currentState === GameState.CRASHLANDED) {
        ship.rotation = 0;
        ship.angularVelocity = 0;
      }
    }

    if (isFlightState) {
      integrateRotation(ship, deltaSeconds);
    }

    const thrust = getNetThrustInput(flightInput);
    runState.thrustInput = thrust;

    if (isFlightState && ship.fuel <= 0 && runState.currentState !== GameState.OUT_OF_FUEL) {
      runState.currentState = GameState.OUT_OF_FUEL;
      stateMachine.setState(GameState.OUT_OF_FUEL);
    }

    if (isFlightState) {
      const tuning = getDifficultyTuning(settings.difficulty);
      const effectiveThrust =
        runState.currentState === GameState.OUT_OF_FUEL ? 0 : thrust * tuning.thrustScale;
      runState.thrustInput = effectiveThrust;
      runState.shipPhysics.applyThrust(effectiveThrust);
      runState.shipPhysics.update(ship, deltaSeconds);

      const collisionResult = runState.collision.update(ship);
      if (collisionResult && collisionResult.collided) {
        handleCollision(runState, collisionResult, stateMachine);
      }
    } else if (runState.currentState === GameState.LANDED || runState.currentState === GameState.CRASHLANDED) {
      anchorShipToTerrain(ship, terrain);
      ship.rotation = 0;
      ship.angularVelocity = 0;
    }

    if (runState.economy) {
      runState.money = runState.economy.getMoney();
    }

    const refuelInput = flightInput.getRefuel ? flightInput.getRefuel() : 0;
    const loadInput = flightInput.getLoadCargo ? flightInput.getLoadCargo() : 0;
    const unloadInput = flightInput.getUnloadCargo ? flightInput.getUnloadCargo() : 0;
    const refuelResult = handleRefuel(runState, deltaSeconds, refuelInput, audio);
    if (refuelResult && refuelResult.added > 0) {
      updateShipMass(ship);
    }

    const repairResult = handleRepair(runState, deltaSeconds, refuelInput);
    if (repairResult && repairResult.applied > 0) {
      updateShipMass(ship);
    }

    const cargoResult = handleCargoTransfer(runState, deltaSeconds, loadInput, unloadInput, audio);
    if (cargoResult && cargoResult.delta !== 0) {
      updateShipMass(ship);
    }

    const moneyValue = runState.economy ? runState.economy.getMoney() : runState.money ?? 0;
    if (Math.round(moneyValue) <= 0) {
      triggerGameOver();
      return;
    }

    if (ship.fuel <= 0) {
      const onPad =
        runState.currentState === GameState.LANDED || runState.currentState === GameState.CRASHLANDED;
      const pad = runState.activePad;
      const canSellPad = onPad && pad && (pad.type === "colony" || pad.type === "repair");
      const cargoMass = runState.cargoHold ? runState.cargoHold.getTotalMass() : 0;
      if (!(canSellPad && cargoMass > 0)) {
        triggerGameOver();
        return;
      }
    }

    if (ship) {
      const heatInput = isFlightState ? Math.max(0, runState.thrustInput || 0) : 0;
      ship.thrusterHeat = updateThrusterHeat(ship.thrusterHeat, { main: heatInput }, deltaSeconds, config);
    }

    if (runState.dust) {
      const dustRange =
        runState.config && typeof runState.config.dustAltitude === "number"
          ? runState.config.dustAltitude
          : 40;
      const exhaustDir = {
        x: -Math.sin(ship.rotation || 0),
        y: Math.cos(ship.rotation || 0),
      };
      const impact = findGroundImpact(runState, ship.position, exhaustDir, dustRange);
      const dustActive =
        isFlightState &&
        runState.thrustInput > 0.1 &&
        impact &&
        impact.distance > 0 &&
        impact.distance < dustRange;
      const intensity =
        dustActive && dustRange > 0
          ? (1 - impact.distance / dustRange) * runState.thrustInput * impact.alignment
          : 0;
      runState.dust.update(deltaSeconds, {
        active: dustActive,
        x: impact ? impact.x : ship.position.x,
        groundY: impact ? impact.y : getGroundHeightAt(runState, ship.position.x),
        intensity,
      });
    }

    updateCamera(runState, terrain, deltaSeconds, settings.cameraZoomSensitivity);

    if (stateMachine.getState() === GameState.GAME_OVER) {
      runState.currentState = GameState.GAME_OVER;
    }

    updateTelemetry(runState, deltaSeconds);

    if (sfxEnabled) {
      audio.update({
        state: runState.currentState,
        throttle: runState.thrustInput || 0,
        rotation: runState.rotationInput || 0,
        hotThrusters: buildCoolingInputs(runState, config),
        refuel: buildRefuelAudio(runState, refuelResult),
        repair: buildRepairAudio(runState, repairResult, refuelInput),
        cargo: buildCargoAudio(runState, cargoResult),
        fuelAlarm: buildFuelAlarmAudio(runState),
      });
    }
  }

  function shouldLaunch() {
    if (!runState) {
      return false;
    }

    const throttle = flightInput.getThrottle();
    if (runState.ship && runState.ship.fuel <= 0) {
      return false;
    }
    const should = throttle > 0;
    if (should) {
      logDebug("launch input", { throttle });
    }
    return should;
  }

  function transitionToFlight() {
    if (!runState) {
      return;
    }

    runState.currentState = GameState.FLIGHT;
    if (runState.ship) {
      const terrain = runState.world && runState.world.terrain;
      if (terrain) {
        const ground = terrain.getHeightAt(runState.ship.position.x);
        const bottomOffset =
          typeof runState.ship.collisionBottom === "number"
            ? runState.ship.collisionBottom
            : SHIP_COLLISION_RADIUS;
        runState.ship.position.y = ground - bottomOffset - 2;
        runState.ship.velocity.y = Math.min(runState.ship.velocity.y, -2);
      }
      runState.ship.landed = false;
    }
    stateMachine.setState(GameState.FLIGHT);
    logDebug("state -> FLIGHT");
  }

  function render() {
    const viewport = getViewport(context);
    const width = viewport.width;
    const height = viewport.height;

    if (width !== starfieldSize.width || height !== starfieldSize.height) {
      starfield.resize(width, height);
      starfieldSize = { width, height };
    }
    starfield.draw(context);

    const currentState = stateMachine.getState();

    if (currentState === GameState.MENU) {
      renderMenu(context, mainMenu.getState(), {
        width,
        height,
      });
      renderNowPlaying(context, width, height, musicDisplay);
      return;
    }

    if (currentState === GameState.OPTIONS) {
      renderOptions(context, options.getState(), {
        width,
        height,
      });
      renderNowPlaying(context, width, height, musicDisplay);
      return;
    }

    renderRunState(context, currentState, width, height);
    renderNowPlaying(context, width, height, musicDisplay);
  }

  function renderRunState(ctx, currentState, width, height) {
    if (runState && runState.camera) {
      runState.camera.setViewport(width, height);
    }

    if (runState && runState.world && runState.camera) {
      const camera = runState.camera;
      const zoom = camera.getZoom();
      const viewWidth = width / zoom;
      const viewHeight = height / zoom;
      const cameraPos = camera.getPosition();
      const startX = cameraPos.x - viewWidth / 2;
      const endX = cameraPos.x + viewWidth / 2;
      const fillToY = cameraPos.y + viewHeight / 2 + 200;

      ctx.save();
      camera.begin(ctx);
      drawTerrain(ctx, runState.world.terrain, startX, endX, fillToY);
      drawPads(ctx, runState.world.pads, startX, endX, runState.world.width || 0);
      if (runState.dust) {
        runState.dust.draw(ctx);
      }

      if (runState.ship) {
        const altitude = typeof runState.altitude === "number" ? runState.altitude : getAltitudeFromNearestPad(runState);
        const rotationEnabled =
          (runState.currentState === GameState.FLIGHT || runState.currentState === GameState.LANDING) &&
          altitude > 5;
        drawShip(
          ctx,
          runState.ship,
          runState.thrustInput || 0,
          runState.rotationInput || 0,
          config.debug,
          rotationEnabled,
          runState.ship.thrusterHeat
        );
        drawPadGuides(ctx, runState, cameraPos, viewWidth, settings && settings.unitSystem);
      }

      camera.end(ctx);
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = "#e3e9f0";
    ctx.font = "500 18px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    if (config.debug) {
      const status = getStateLabel(currentState);
      ctx.fillText(`State: ${status}`, 24, 24);

      if (runState && runState.spawnPad) {
        ctx.fillText(`Pad: ${runState.spawnPad.id}`, 24, 48);
      }

      if (runState && runState.currentState) {
        ctx.fillText(`Spawn: ${runState.currentState.toUpperCase()}`, 24, 72);
      }

      ctx.fillText(`Difficulty: ${String(settings.difficulty || "").toUpperCase()}`, 24, 96);
    }

    renderHud(ctx, runState, width, height, settings && settings.unitSystem);
    renderPadPrompt(ctx, runState, width, height);
    ctx.restore();

    if (currentState === GameState.CRASHLANDED) {
      renderCrashLanded(ctx, width, height, runState);
    } else if (currentState === GameState.CRASHED) {
      renderCrashed(ctx, width, height, config);
    } else if (currentState === GameState.GAME_OVER) {
      renderGameOver(ctx, width, height);
    }
  }

  function loop(nowMs) {
    if (!running) {
      return;
    }

    time.advance(nowMs);

    while (time.getAccumulator() >= FIXED_TIMESTEP) {
      flightInput.update();
      stateMachine.update(FIXED_TIMESTEP);
      updateMusicDisplay(musicDisplay, FIXED_TIMESTEP);
      time.consume(FIXED_TIMESTEP);
    }

    render();
    animationFrameId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) {
      return;
    }

    running = true;
    time.reset();
    stateMachine.setState(GameState.MENU);
    animationFrameId = requestAnimationFrame(loop);
  }

  function stop() {
    if (!running) {
      return;
    }

    running = false;
    cancelAnimationFrame(animationFrameId);
    mainMenu.destroy();
    options.destroy();
    pauseInput.destroy();
    flightInput.destroy();
  }

  return {
    start,
    stop,
  };
}

function loadSettingsOrDefault() {
  const result = loadSettings();
  if (result.ok) {
    return result.data;
  }

  const defaults = getDefaultSettings();
  saveSettings(defaults);
  return defaults;
}

function buildMainMenuItems(config, runState, hasSavedGame) {
  const inRun = Boolean(runState && runState.active);
  const currentState = runState && runState.currentState ? runState.currentState : null;
  const canSave = inRun && currentState === GameState.LANDED;
  const loadAllowed = !currentState || currentState !== GameState.FLIGHT;
  const canLoad = Boolean(hasSavedGame) && loadAllowed;
  const items = [];

  if (inRun) {
    items.push({ id: "resume", label: "Resume game" });
  }

  items.push({ id: "start", label: "Start new game" });
  items.push({ id: "spacer-main", type: "spacer", disabled: true });
  items.push({ id: "load", label: "Load Game", disabled: !canLoad });
  items.push({ id: "save", label: "Save Game", disabled: !canSave });
  items.push({ id: "options", label: "Options" });
  items.push({ id: "spacer-debug", type: "spacer", disabled: true });
  items.push({
    id: "debug",
    label: `Debug: ${config.debug ? "On" : "Off"}`,
    isActive: config.debug,
  });

  return items;
}

function createRefuelState() {
  return {
    active: false,
    addedSinceDing: 0,
    lastPercent: 0,
  };
}

function handleRefuel(runState, dt, refuelInput, audioEngine) {
  if (!runState || !runState.ship) {
    return null;
  }

  const ship = runState.ship;
  const capacity = ship.fuelCapacity ?? 0;
  const pad = runState.activePad;
  const canRefuel =
    (runState.currentState === GameState.LANDED || runState.currentState === GameState.CRASHLANDED) &&
    pad &&
    (pad.type === "industrial" || pad.type === "mine") &&
    capacity > 0 &&
    ship.fuel < capacity;

  const refuelActive = canRefuel && refuelInput > 0;

  if (!runState.refuel) {
    runState.refuel = createRefuelState();
  }

  runState.refuel.active = refuelActive;

  if (!refuelActive) {
    return { active: false, added: 0, percent: capacity > 0 ? ship.fuel / capacity : 0 };
  }

  const beforeFuel = ship.fuel ?? 0;
  const money = runState.economy ? runState.economy.getMoney() : 0;
  const fuelCostPer50Kg =
    typeof runState.config?.fuelCostPer50Kg === "number"
      ? runState.config.fuelCostPer50Kg
      : 10;
  const costPerKg = fuelCostPer50Kg / 50;
  const refuelRate =
    typeof runState.config?.refuelRate === "number" ? runState.config.refuelRate : REFUEL_RATE;
  const affordable = money > 0 ? money / costPerKg : 0;
  const amount = Math.min(refuelRate * dt, capacity - beforeFuel, affordable);
  if (amount <= 0) {
    runState.refuel.active = false;
    return { active: false, added: 0, percent: capacity > 0 ? beforeFuel / capacity : 0 };
  }

  ship.fuel = beforeFuel + amount;
  if (runState.economy) {
    runState.economy.spendMoney(amount * costPerKg);
    runState.money = runState.economy.getMoney();
  }

  runState.refuel.addedSinceDing += amount;
  const dingInterval =
    typeof runState.config?.refuelDingInterval === "number"
      ? runState.config.refuelDingInterval
      : REFUEL_DING_INTERVAL;
  while (runState.refuel.addedSinceDing >= dingInterval) {
    runState.refuel.addedSinceDing -= dingInterval;
    if (audioEngine && audioEngine.playRefuelDing) {
      audioEngine.playRefuelDing();
    }
  }

  if (beforeFuel < capacity && ship.fuel >= capacity) {
    if (audioEngine && audioEngine.playRefuelClick) {
      audioEngine.playRefuelClick();
    }
  }

  const percent = capacity > 0 ? ship.fuel / capacity : 0;
  runState.refuel.lastPercent = percent;

  return { active: true, added: amount, percent };
}

function handleRepair(runState, dt, repairInput) {
  if (!runState || !runState.ship || !runState.economy) {
    return null;
  }

  const ship = runState.ship;
  const pad = runState.activePad;
  const canRepair =
    (runState.currentState === GameState.LANDED || runState.currentState === GameState.CRASHLANDED) &&
    pad &&
    (pad.type === "colony" || pad.type === "repair") &&
    ship.hullHP < 100;

  if (!canRepair || !repairInput || repairInput <= 0) {
    return { applied: 0 };
  }

  const repairRate =
    typeof runState.config?.repairRate === "number" ? runState.config.repairRate : 6;
  const desired = repairRate * dt;
  const available = Math.max(0, 100 - ship.hullHP);
  const money = runState.economy.getMoney();
  const maxAffordable = money / REPAIR_COST_PER_DAMAGE;
  const amount = Math.min(desired, available, maxAffordable);
  if (amount <= 0) {
    return { applied: 0 };
  }

  ship.hullHP = Math.min(100, ship.hullHP + amount);
  runState.economy.applyRepairCost(amount * REPAIR_COST_PER_DAMAGE);
  runState.money = runState.economy.getMoney();

  return { applied: amount };
}

function buildRefuelAudio(runState, refuelResult) {
  if (!runState || !runState.ship) {
    return null;
  }

  if (refuelResult && typeof refuelResult.percent === "number") {
    return {
      active: Boolean(refuelResult.active),
      percent: refuelResult.percent,
    };
  }

  const capacity = runState.ship.fuelCapacity ?? 0;
  const percent = capacity > 0 ? (runState.ship.fuel ?? 0) / capacity : 0;
  return {
    active: Boolean(runState.refuel && runState.refuel.active),
    percent,
  };
}

function buildRepairAudio(runState, repairResult, repairInput) {
  if (!runState || !runState.ship) {
    return null;
  }

  const ship = runState.ship;
  const pad = runState.activePad;
  const onPad =
    runState.currentState === GameState.LANDED || runState.currentState === GameState.CRASHLANDED;
  const canRepair =
    onPad && pad && (pad.type === "colony" || pad.type === "repair") && ship.hullHP < 100;
  const active = Boolean(canRepair && repairInput > 0 && repairResult && repairResult.applied > 0);
  const intensity = clamp((100 - ship.hullHP) / 100, 0, 1);
  return { active, intensity };
}

function handleCargoTransfer(runState, dt, loadInput, unloadInput, audioEngine) {
  if (!runState || !runState.ship || !runState.cargoHold) {
    return null;
  }

  const ship = runState.ship;
  const pad = runState.activePad;
  const capacity = ship.cargoCapacity ?? 0;
  const currentMass = runState.cargoHold.getTotalMass();
  const percent = capacity > 0 ? currentMass / capacity : 0;
  const fuelCostPer50Kg =
    typeof runState.config?.fuelCostPer50Kg === "number"
      ? runState.config.fuelCostPer50Kg
      : 10;
  const fuelCostPerKg = fuelCostPer50Kg / 50;
  const he3BuyMultiplier =
    typeof runState.config?.cargoHe3CostMultiplier === "number"
      ? runState.config.cargoHe3CostMultiplier
      : 4;
  const he3SellMultiplier =
    typeof runState.config?.cargoHe3SellMultiplier === "number"
      ? runState.config.cargoHe3SellMultiplier
      : 6;
  const transferRate =
    typeof runState.config?.cargoTransferRate === "number"
      ? runState.config.cargoTransferRate
      : CARGO_TRANSFER_RATE;

  const onPad =
    runState.currentState === GameState.LANDED || runState.currentState === GameState.CRASHLANDED;

  if (!onPad || !pad || capacity <= 0) {
    return { active: false, mode: "load", percent, delta: 0 };
  }

  if ((pad.type === "industrial" || pad.type === "mine") && loadInput > 0) {
    const available = Math.max(0, capacity - currentMass);
    const buyPricePerKg = fuelCostPerKg * he3BuyMultiplier;
    const money = runState.economy ? runState.economy.getMoney() : 0;
    const affordable = buyPricePerKg > 0 ? money / buyPricePerKg : available;
    const amount = Math.min(transferRate * dt, available, affordable);
    if (amount <= 0) {
      return { active: false, mode: "load", percent, delta: 0 };
    }

    const added = runState.cargoHold.addBulkCargo({
      id: "he3",
      name: "He3",
      mass: amount,
      valuePerKg: fuelCostPerKg * he3SellMultiplier,
    });
    if (added > 0 && runState.economy) {
      runState.economy.spendMoney(added * buyPricePerKg);
      runState.money = runState.economy.getMoney();
    }
    ship.cargoMass = runState.cargoHold.getTotalMass();
    ship.cargo = runState.cargoHold.getSlots();
    const percentAfter = capacity > 0 ? ship.cargoMass / capacity : 0;
    if (percentAfter >= 1 && audioEngine && audioEngine.playCargoClick) {
      audioEngine.playCargoClick();
    }
    return {
      active: added > 0,
      mode: "load",
      percent: percentAfter,
      delta: added,
    };
  }

  if ((pad.type === "colony" || pad.type === "repair") && unloadInput > 0) {
    const amount = Math.min(transferRate * dt, currentMass);
    if (amount <= 0) {
      return { active: false, mode: "unload", percent, delta: 0 };
    }

    const removed = runState.cargoHold.removeBulkCargo({ id: "he3", mass: amount });
    if (removed > 0 && runState.economy) {
      runState.economy.addMoney(removed * fuelCostPerKg * he3SellMultiplier);
      runState.money = runState.economy.getMoney();
    }
    ship.cargoMass = runState.cargoHold.getTotalMass();
    ship.cargo = runState.cargoHold.getSlots();
    return {
      active: removed > 0,
      mode: "unload",
      percent: capacity > 0 ? ship.cargoMass / capacity : 0,
      delta: -removed,
    };
  }

  return { active: false, mode: "load", percent, delta: 0 };
}

function buildCargoAudio(runState, cargoResult) {
  if (!runState || !runState.ship || !runState.cargoHold) {
    return null;
  }

  if (cargoResult && typeof cargoResult.percent === "number") {
    return {
      active: Boolean(cargoResult.active),
      percent: cargoResult.percent,
      mode: cargoResult.mode || "load",
    };
  }

  const capacity = runState.ship.cargoCapacity ?? 0;
  const currentMass = runState.cargoHold.getTotalMass();
  const percent = capacity > 0 ? currentMass / capacity : 0;
  return { active: false, percent, mode: "load" };
}

function buildFuelAlarmAudio(runState) {
  if (!runState || !runState.ship) {
    return { active: false };
  }

  const ship = runState.ship;
  const capacity = ship.fuelCapacity ?? 0;
  if (capacity <= 0) {
    return { active: false };
  }

  const percent = (ship.fuel ?? 0) / capacity;
  const threshold =
    typeof runState.config?.lowFuelWarningThreshold === "number"
      ? runState.config.lowFuelWarningThreshold
      : 0.2;
  if (percent >= threshold) {
    return { active: false };
  }

  const pad = runState.activePad;
  const onRefuelPad =
    (runState.currentState === GameState.LANDED || runState.currentState === GameState.CRASHLANDED) &&
    pad &&
    (pad.type === "industrial" || pad.type === "mine");

  const interval =
    typeof runState.config?.lowFuelWarningInterval === "number"
      ? runState.config.lowFuelWarningInterval
      : 0.9;
  return { active: !onRefuelPad, interval };
}

function buildDustConfig(config) {
  const source = config || {};
  const readNumber = (value, fallback) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return {
    maxParticles: Math.round(clamp(readNumber(source.dustMaxParticles, 140), 20, 600)),
    spawnRate: clamp(readNumber(source.dustSpawnRate, 90), 5, 400),
    baseSpeed: clamp(readNumber(source.dustBaseSpeed, 12), 1, 60),
    lift: clamp(readNumber(source.dustLift, 6), 1, 60),
    spread: clamp(readNumber(source.dustSpread, 16), 2, 120),
    size: clamp(readNumber(source.dustSize, 1.3), 0.5, 6),
    life: clamp(readNumber(source.dustLife, 0.8), 0.1, 3),
  };
}

function buildCoolingInputs(runState, config) {
  if (!runState || !runState.ship || !runState.ship.thrusterHeat) {
    return null;
  }

  const rawHeat = typeof runState.ship.thrusterHeat.main === "number" ? runState.ship.thrusterHeat.main : 0;
  const heatMax = typeof config.thrusterHeatMax === "number" && config.thrusterHeatMax > 0 ? config.thrusterHeatMax : 1;
  const heat = rawHeat / heatMax;
  const minK = typeof config.thrusterHeatMinTempK === "number" ? config.thrusterHeatMinTempK : 600;
  const maxK = typeof config.thrusterHeatMaxTempK === "number" ? config.thrusterHeatMaxTempK : 2200;
  const low = Math.min(minK, maxK);
  const high = Math.max(minK, maxK);
  const tempK = low + clamp(heat, 0, 1) * (high - low);
  const tempC = tempK - 273.15;
  return {
    heat: clamp(heat, 0, 1),
    threshold: config.thrusterHeatTickThreshold ?? 0.3,
    minDelay: config.thrusterHeatTickMinDelay ?? 0.35,
    maxDelay: config.thrusterHeatTickMaxDelay ?? 1.2,
    gain: config.thrusterHeatTickGain ?? 0.35,
    tempC,
    tempMaxC: high - 273.15,
  };
}

function updateMusicDisplay(musicDisplay, deltaSeconds) {
  if (!musicDisplay || !musicDisplay.enabled || !musicDisplay.title) {
    return;
  }

  musicDisplay.timer += deltaSeconds;
}

function renderNowPlaying(ctx, width, height, musicDisplay) {
  if (!musicDisplay || !musicDisplay.enabled || !musicDisplay.title) {
    return;
  }

  const opacity = getMusicOpacity(musicDisplay.timer);
  ctx.save();
  ctx.font = "500 14px system-ui";
  ctx.fillStyle = `rgba(230, 238, 247, ${opacity})`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`Music playing: ${musicDisplay.title}`, width - 24, 24);
  ctx.restore();
}

function getMusicOpacity(timer) {
  if (timer <= 30) {
    return 0.5;
  }

  if (timer <= 40) {
    const t = (timer - 30) / 10;
    return 0.5 - (0.35 * t);
  }

  return 0.15;
}

function formatTrackTitle(src) {
  if (!src) {
    return "";
  }

  const base = src.split("?")[0];
  const parts = base.split("/");
  const filename = parts[parts.length - 1] || "";
  const decoded = decodeFilename(filename);
  const dot = decoded.lastIndexOf(".");
  return dot > 0 ? decoded.slice(0, dot) : decoded;
}

function decodeFilename(filename) {
  try {
    return decodeURIComponent(filename);
  } catch (_error) {
    return filename;
  }
}

function applyLoadedMusic(music, musicDisplay, musicState) {
  if (!music || !musicState || !musicState.track) {
    return;
  }

  const applied = music.setPlayback({ src: musicState.track, time: musicState.time });
  if (applied) {
    musicDisplay.title = formatTrackTitle(musicState.track);
    musicDisplay.timer = 0;
  }
}

function rotateMusicTrack(music, musicDisplay) {
  if (!music) {
    return;
  }

  const current = music.getState().src;
  music.pickRandom({ excludeSrc: current });
  musicDisplay.title = formatTrackTitle(music.getState().src);
  musicDisplay.timer = 0;
}

function createNewRun(stateMachine, shipModel, config) {
  const worldWidth =
    config && typeof config.worldWidth === "number" && Number.isFinite(config.worldWidth)
      ? config.worldWidth
      : 5000;
  const newGame = createNewGame({ worldWidth, seed: 0, shipModel, config });
  const spacePads = newGame.world.spacePads || createSpacePads({ worldWidth });
  const shipPhysics = createShipPhysics({
    mass: newGame.ship.mass || SHIP_MASS,
    gravity: LUNAR_GRAVITY,
    maxThrust: SHIP_MAX_THRUST * THRUST_EFFICIENCY,
    maxRetroThrust: SHIP_MAX_RETRO_THRUST * THRUST_EFFICIENCY,
    fuelBurnRate: SHIP_FUEL_BURN_RATE,
  });
  const collision = createCollisionSystem({ terrain: newGame.world.terrain, spacePads });
  const economy = createEconomy({ startingMoney: 5000, stateMachine });
  const camera = createCamera({
    x: newGame.ship.position.x,
    y: newGame.ship.position.y,
    zoom: 1,
    viewport: { width: 0, height: 0 },
  });
  const cargoHold = createCargoHold({ maxMass: newGame.ship.cargoCapacity || 0 });
  newGame.ship.thrusterHeat = createThrusterHeatState();
  const dust = createDustSystem(buildDustConfig(config));

  return {
    active: true,
    paused: false,
    money: economy.getMoney(),
    world: newGame.world,
    ship: newGame.ship,
    currentState: newGame.currentState,
    spawnPad: newGame.spawnPad,
    activePad: null,
    crashMessage: "",
    config,
    shipPhysics,
    collision,
    camera,
    dust,
    thrustInput: 0,
    cargoHold,
    economy,
    telemetry: createTelemetrySnapshot({
      ship: newGame.ship,
      money: economy.getMoney(),
      world: newGame.world,
    }),
    telemetryTimer: 0,
    refuel: createRefuelState(),
  };
}

function normalizeLoadedRun(saveData, stateMachine, shipModel, config) {
  if (!saveData || typeof saveData !== "object") {
    return createNewRun(stateMachine, shipModel, config);
  }

  const ship = saveData.ship || {};
  const world = saveData.world || {};
  const pads = Array.isArray(world.pads) ? world.pads : [];
  const worldWidth = typeof world.width === "number" ? world.width : 5000;
  const seed = typeof world.seed === "number" ? world.seed : 0;
  const spacePads = createSpacePads({ worldWidth, pads });
  const terrain = createTerrain({ worldWidth, seed, spacePads });
  const pad = selectNearestPad(ship.position && ship.position.x, pads);
  const activePadId = typeof saveData.activePadId === "string" ? saveData.activePadId : "";
  const spawnPadId = typeof saveData.spawnPadId === "string" ? saveData.spawnPadId : "";
  const activePad =
    activePadId && pads.length ? pads.find((item) => item && item.id === activePadId) : null;
  const spawnPad =
    spawnPadId && pads.length ? pads.find((item) => item && item.id === spawnPadId) : null;
  const normalizedState = normalizePlayableState(saveData.currentState) || GameState.FLIGHT;
  const modules = ship.modules || {};
  const baseMass =
    shipModel && typeof shipModel.mass === "number" && Number.isFinite(shipModel.mass)
      ? shipModel.mass
      : SHIP_MASS;
  const stats = calculateShipStats(baseMass, modules);
  const fuelAmount = typeof ship.fuel === "number" ? ship.fuel : stats.fuelCapacity;
  const fuelMass = fuelAmount * FUEL_MASS_PER_UNIT;
  const dryMass = stats.mass;
  const cargoCapacity =
    typeof ship.cargoCapacity === "number"
      ? ship.cargoCapacity
      : shipModel && typeof shipModel.cargoCapacity === "number"
        ? shipModel.cargoCapacity
        : 0;
  const cargoHold = createCargoHold({ maxMass: cargoCapacity });
  hydrateCargoHold(cargoHold, ship.cargo || []);
  const hydratedCargoMass = cargoHold.getTotalMass();
  const mass = dryMass + fuelMass + hydratedCargoMass;
  const shipPhysics = createShipPhysics({
    mass,
    gravity: LUNAR_GRAVITY,
    maxThrust: SHIP_MAX_THRUST * THRUST_EFFICIENCY,
    maxRetroThrust: SHIP_MAX_RETRO_THRUST * THRUST_EFFICIENCY,
    fuelBurnRate: SHIP_FUEL_BURN_RATE,
  });
  const collision = createCollisionSystem({ terrain, spacePads });
  const camera = createCamera({
    x: (ship.position && ship.position.x) || 0,
    y: (ship.position && ship.position.y) || 0,
    zoom: 1,
    viewport: { width: 0, height: 0 },
  });
  const dust = createDustSystem(buildDustConfig(config));
  const economy = createEconomy({
    startingMoney: typeof saveData.money === "number" ? saveData.money : 0,
    stateMachine,
  });

  const collisionBottom =
    shipModel && typeof shipModel.collisionBottom === "number"
      ? shipModel.collisionBottom
      : shipModel && shipModel.bounds
        ? shipModel.bounds.maxY
        : SHIP_COLLISION_RADIUS;
  const runState = {
    active: true,
    paused: false,
    money: economy.getMoney(),
    world: {
      width: worldWidth,
      seed,
      terrain,
      spacePads,
      pads,
    },
    ship: {
      position: ship.position || { x: 0, y: 0 },
      velocity: ship.velocity || { x: 0, y: 0 },
      rotation: ship.rotation ?? 0,
      angularVelocity: 0,
      fuel: ship.fuel ?? stats.fuelCapacity,
      fuelCapacity: stats.fuelCapacity,
      cargoCapacity,
      cargoMass: hydratedCargoMass,
      hullHP: ship.hullHP ?? 100,
      modules,
      cargo: ship.cargo || [],
      dryMass,
      mass: dryMass + fuelMass + hydratedCargoMass,
      landed: normalizedState === GameState.LANDED || normalizedState === GameState.CRASHLANDED,
      model: shipModel,
      collisionBottom,
      thrusterHeat:
        ship.thrusterHeat && typeof ship.thrusterHeat === "object"
          ? { ...ship.thrusterHeat }
          : createThrusterHeatState(),
    },
    currentState: normalizedState,
    spawnPad: spawnPad || pad || null,
    activePad: activePad,
    crashMessage: "",
    config,
    shipPhysics,
    collision,
    camera,
    dust,
    thrustInput: 0,
    cargoHold,
    economy,
    telemetry: createTelemetrySnapshot({
      ship,
      money: economy.getMoney(),
      world: { width: worldWidth, pads, terrain },
    }),
    telemetryTimer: 0,
    refuel: createRefuelState(),
  };

  return runState;
}

function isPlayableState(state) {
  return (
    state === GameState.FLIGHT ||
    state === GameState.LANDED ||
    state === GameState.LANDING ||
    state === GameState.CRASHLANDED ||
    state === GameState.OUT_OF_FUEL ||
    state === GameState.CRASHED
  );
}

function normalizePlayableState(state) {
  const normalized = String(state || "").toLowerCase();
  if (normalized === "flight") {
    return GameState.FLIGHT;
  }
  if (normalized === "landed") {
    return GameState.LANDED;
  }
  if (normalized === "landing") {
    return GameState.LANDING;
  }
  if (normalized === "crashlanded") {
    return GameState.CRASHLANDED;
  }
  if (normalized === "crashed") {
    return GameState.CRASHED;
  }
  if (normalized === "out_of_fuel" || normalized === "out-of-fuel") {
    return GameState.OUT_OF_FUEL;
  }

  return null;
}

function getStateLabel(state) {
  switch (state) {
    case GameState.FLIGHT:
      return "FLIGHT";
    case GameState.LANDED:
      return "LANDED";
    case GameState.LANDING:
      return "LANDING";
    case GameState.CRASHLANDED:
      return "CRASH-LANDED";
    case GameState.CRASHED:
      return "CRASHED";
    case GameState.OUT_OF_FUEL:
      return "OUT OF FUEL";
    case GameState.GAME_OVER:
      return "GAME OVER";
    default:
      return String(state || "").toUpperCase();
  }
}

function selectNearestPad(x, pads) {
  if (!pads.length || typeof x !== "number") {
    return pads[0] || null;
  }

  let best = pads[0];
  let bestDistance = Math.abs(x - best.x);

  for (let i = 1; i < pads.length; i += 1) {
    const distance = Math.abs(x - pads[i].x);
    if (distance < bestDistance) {
      best = pads[i];
      bestDistance = distance;
    }
  }

  return best;
}

function getViewport(ctx) {
  const pixelRatio = Number(ctx.canvas.dataset.pixelRatio || 1);
  return {
    width: ctx.canvas.width / pixelRatio,
    height: ctx.canvas.height / pixelRatio,
  };
}

function hydrateCargoHold(cargoHold, items) {
  if (!cargoHold || !Array.isArray(items)) {
    return;
  }

  items.forEach((item) => {
    if (item) {
      cargoHold.addCargo({ ...item });
    }
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDifficultyTuning(difficulty) {
  const mode = String(difficulty || "easy").toLowerCase();
  if (mode === "hard" || mode === "high") {
    return {
      thrustScale: 0.9,
      gravityScale: 1.1,
      fuelBurnScale: 1.2,
      rotationScale: 1,
      stabilizeStrength: 0,
      rotationDamping: 0,
    };
  }

  return {
    thrustScale: 1.15,
    gravityScale: 0.85,
    fuelBurnScale: 0.8,
    rotationScale: 1,
    stabilizeStrength: 0,
    rotationDamping: 0,
  };
}

function applyRotationInput(ship, rotationInput, dt, tuning) {
  if (!ship) {
    return;
  }

  const rotationScale = tuning ? tuning.rotationScale : 1;
  const stabilizeStrength = tuning ? tuning.stabilizeStrength : 0;
  const rotationDamping = tuning ? tuning.rotationDamping : SHIP_ROTATION_DAMPING;
  const angularAcceleration = rotationInput * SHIP_ROTATION_SPEED * rotationScale;
  const current = ship.angularVelocity || 0;
  let next = current + angularAcceleration * dt;

  if (rotationInput === 0 && stabilizeStrength > 0) {
    next += -current * stabilizeStrength * dt;
  }

  if (rotationInput === 0 && rotationDamping > 0) {
    const damping = Math.exp(-rotationDamping * dt);
    next *= damping;
  }

  ship.angularVelocity = clamp(next, -SHIP_MAX_ROTATION_SPEED, SHIP_MAX_ROTATION_SPEED);
}

function integrateRotation(ship, dt) {
  if (!ship) {
    return;
  }

  ship.rotation += (ship.angularVelocity || 0) * dt;
}

function getNetThrustInput(input) {
  if (!input) {
    return 0;
  }

  const throttle = input.getThrottle();

  if (throttle > 0) {
    return throttle;
  }

  return 0;
}

function updateShipMass(ship) {
  if (!ship) {
    return;
  }

  let dryMass = typeof ship.dryMass === "number" ? ship.dryMass : 0;
  if (!Number.isFinite(dryMass) || dryMass <= 0) {
    const baseMass =
      ship.model && typeof ship.model.mass === "number" && Number.isFinite(ship.model.mass)
        ? ship.model.mass
        : SHIP_MASS;
    dryMass = calculateShipStats(baseMass, ship.modules || {}).mass;
  }
  const fuel = typeof ship.fuel === "number" ? ship.fuel : 0;
  const cargoMass = typeof ship.cargoMass === "number" ? ship.cargoMass : 0;
  ship.dryMass = dryMass;
  ship.mass = dryMass + fuel * FUEL_MASS_PER_UNIT + cargoMass;
}

function isSafeLanding(collisionResult) {
  if (!collisionResult) {
    return false;
  }

  return (
    collisionResult.verticalSpeed <= LANDING_VERTICAL_SPEED_THRESHOLD &&
    collisionResult.lateralSpeed <= LANDING_LATERAL_SPEED_THRESHOLD &&
    collisionResult.rotationSpeed <= LANDING_ROTATION_SPEED_THRESHOLD
  );
}

function consumeRotationFuel(ship, rotationInput, dt, burnScale = 1) {
  if (!ship || ship.fuel <= 0) {
    return 0;
  }

  const strength = Math.min(Math.abs(rotationInput), 1);
  if (strength <= 0) {
    return 0;
  }

  const burn = strength * SHIP_ROTATION_FUEL_BURN_RATE * burnScale * dt;
  if (burn <= 0) {
    return 0;
  }

  const actual = Math.min(burn, ship.fuel);
  ship.fuel -= actual;
  updateShipMass(ship);
  return actual;
}

function anchorShipToTerrain(ship, terrain) {
  if (!ship || !terrain) {
    return;
  }

  const terrainHeight = terrain.getHeightAt(ship.position.x);
  const bottomOffset = typeof ship.collisionBottom === "number" ? ship.collisionBottom : SHIP_COLLISION_RADIUS;
  ship.position.y = terrainHeight - bottomOffset;
  ship.velocity.x = 0;
  ship.velocity.y = 0;
}

function handleCollision(runState, collisionResult, stateMachine) {
  if (!runState || !runState.ship) {
    return;
  }

  const ship = runState.ship;
  const onPad = Boolean(collisionResult.onPad);
  const safe = isSafeLanding(collisionResult);

  if (runState.currentState === GameState.OUT_OF_FUEL) {
    if (onPad && safe) {
      completeLanding(runState, collisionResult.pad, stateMachine);
    } else {
      handleCrashImpact(runState, stateMachine);
    }
    return;
  }

  if (runState.currentState === GameState.LANDING) {
    if (onPad && safe) {
      completeLanding(runState, collisionResult.pad, stateMachine);
    } else {
      handleCrashLanding(runState, { onPad, pad: collisionResult.pad }, stateMachine);
    }
    return;
  }

  if (onPad && safe) {
    completeLanding(runState, collisionResult.pad, stateMachine);
    return;
  }

  handleCrashImpact(runState, stateMachine);
}

function completeLanding(runState, pad, stateMachine) {
  if (!runState || !runState.ship) {
    return;
  }

  const ship = runState.ship;
  ship.velocity.x = 0;
  ship.velocity.y = 0;
  ship.angularVelocity = 0;
  ship.rotation = 0;
  ship.landed = true;
  runState.currentState = GameState.LANDED;
  if (stateMachine) {
    stateMachine.setState(GameState.LANDED);
  }
  if (pad) {
    runState.spawnPad = pad;
  }
  handleLanding(runState);
}

function handleCrashImpact(runState, stateMachine) {
  if (!runState || !runState.ship) {
    return;
  }

  const ship = runState.ship;
  ship.velocity.x = 0;
  ship.velocity.y = 0;
  ship.angularVelocity = 0;
  handleCrash(runState, HARD_LANDING_DAMAGE);
  if (ship.hullHP <= 0) {
    runState.currentState = GameState.GAME_OVER;
    if (stateMachine) {
      stateMachine.setState(GameState.GAME_OVER);
    }
    return;
  }

  runState.currentState = GameState.CRASHED;
  if (stateMachine) {
    stateMachine.setState(GameState.CRASHED);
  }
}

function handleCrashLanding(runState, { onPad, pad }, stateMachine) {
  if (!runState || !runState.ship) {
    return;
  }

  const ship = runState.ship;
  ship.velocity.x = 0;
  ship.velocity.y = 0;
  ship.angularVelocity = 0;
  ship.rotation = 0;
  ship.landed = true;
  ship.hullHP = randomInt(6, 24);

  handleCrash(runState);

  const fuelLossChance =
    typeof runState.config?.crashLandFuelLossChance === "number"
      ? runState.config.crashLandFuelLossChance
      : 0.2;
  const loseFuel = Math.random() < fuelLossChance;

  if (onPad) {
    if (loseFuel) {
      ship.fuel = 0;
    }
    runState.crashMessage = loseFuel
      ? "Crash landed. Fuel lost."
      : "Crash landed on pad.";
    if (pad) {
      runState.spawnPad = pad;
    }
  } else {
    ship.fuel = 0;
    const towingCost =
      typeof runState.config?.towingCost === "number" ? runState.config.towingCost : 0;
    if (towingCost > 0 && runState.economy) {
      runState.economy.spendMoney(towingCost);
      runState.money = runState.economy.getMoney();
    }
    towToNearestPad(runState);
    runState.crashMessage = "Crash landed. You were towed to the nearest spacepad.";
    if (loseFuel) {
      ship.fuel = 0;
    }
  }

  if (stateMachine && stateMachine.getState() === GameState.GAME_OVER) {
    runState.currentState = GameState.GAME_OVER;
    return;
  }

  if (ship.hullHP > 1) {
    runState.currentState = GameState.LANDED;
    if (stateMachine) {
      stateMachine.setState(GameState.LANDED);
    }
    return;
  }

  runState.currentState = GameState.CRASHLANDED;
  if (stateMachine) {
    stateMachine.setState(GameState.CRASHLANDED);
  }
}

function towToNearestPad(runState) {
  if (!runState || !runState.ship || !runState.world) {
    return;
  }

  const pads = runState.world.pads || [];
  const nearest = findNearestPad(pads, runState.ship.position.x, runState.world.width || 0);
  if (!nearest) {
    return;
  }

  const terrain = runState.world.terrain;
  const bottomOffset =
    typeof runState.ship.collisionBottom === "number"
      ? runState.ship.collisionBottom
      : SHIP_COLLISION_RADIUS;
  runState.ship.position.x = nearest.x;
  runState.ship.position.y = terrain ? nearest.height - bottomOffset : nearest.height;
  runState.spawnPad = nearest;
}

function randomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function updateCamera(runState, terrain, dt, zoomSensitivity) {
  if (!runState || !runState.camera || !runState.ship) {
    return;
  }

  const altitude = terrain
    ? Math.max(0, terrain.getHeightAt(runState.ship.position.x) - runState.ship.position.y)
    : 0;

  const zoomFactor = (zoomSensitivity || 1) * 1.6;
  runState.camera.setTarget(runState.ship.position);
  runState.camera.update(dt, altitude * zoomFactor);
}

function drawTerrain(ctx, terrain, startX, endX, fillToY) {
  if (!terrain) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = "#6c7176";
  ctx.fillStyle = "#2f3236";
  ctx.lineWidth = 2;
  terrain.draw(ctx, { startX, endX, baselineY: 0, worldSpace: true, fillToY });
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPads(ctx, pads, startX, endX, worldWidth) {
  if (!pads || pads.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineCap = "round";

  pads.forEach((pad) => {
    const width = pad.width || 0;
    const lineWidth = pad.lineWidth || 4;
    const color = getPadColor(pad.type);
    const padX = pad.x || 0;
    const padY = pad.height || 0;

    if (!worldWidth) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(padX - width / 2, padY);
      ctx.lineTo(padX + width / 2, padY);
      ctx.stroke();
      return;
    }

    const viewStart = Number.isFinite(startX) ? startX : padX - worldWidth / 2;
    const viewEnd = Number.isFinite(endX) ? endX : padX + worldWidth / 2;
    let k = Math.floor((viewStart - padX) / worldWidth);
    let drawX = padX + k * worldWidth;
    const maxX = viewEnd + width;

    while (drawX <= maxX) {
      if (drawX + width >= viewStart - width) {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(drawX - width / 2, padY);
        ctx.lineTo(drawX + width / 2, padY);
        ctx.stroke();
      }
      drawX += worldWidth;
    }
  });

  ctx.restore();
}


function getPadColor(type) {
  if (type === "mine" || type === "industrial") {
    return "#d7a74f";
  }
  if (type === "repair" || type === "colony") {
    return "#6ec6ff";
  }

  return "#7dd38a";
}

function drawPadGuides(ctx, runState, cameraPos, viewWidth, unitSystem) {
  if (!runState || !runState.ship || !runState.world) {
    return;
  }

  const ship = runState.ship;
  const pads = runState.world.pads || [];
  const spacePads = runState.world.spacePads;
  const worldWidth = runState.world.width || 0;
  const state = runState.currentState;

  if (!spacePads || typeof spacePads.getNearestPad !== "function") {
    return;
  }

  if (state !== GameState.FLIGHT && state !== GameState.LANDING) {
    return;
  }

  if (pads.length < 2) {
    return;
  }

  const nearest = spacePads.getNearestPad(ship.position.x);
  const nearestPad = nearest ? nearest.pad : null;
  if (!nearestPad) {
    return;
  }

  if (!isPadInView(nearestPad.x, cameraPos.x, viewWidth, worldWidth)) {
    return;
  }

  const targets = pads
    .filter((pad) => {
      if (nearestPad && pad && nearestPad && pad.id && nearestPad.id) {
        return pad.id !== nearestPad.id;
      }
      return pad !== nearestPad;
    })
    .map((pad) => ({
      pad,
      distance: Math.abs(wrappedDistance(ship.position.x, pad.x, worldWidth)),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2);

  if (targets.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.font = "500 12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const unitConfig = getUnitConfig(unitSystem || "metric");
  const worldScale = getWorldScale(runState);

  targets.forEach(({ pad }) => {
    const dx = wrappedDistance(pad.x, ship.position.x, worldWidth);
    const dy = pad.height - ship.position.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.01) {
      return;
    }

    const nx = dx / length;
    const ny = dy / length;
    const arrowOffset = 36;
    const arrowLength = 36;
    const startX = ship.position.x;
    const startY = ship.position.y;
    const baseX = startX + nx * arrowOffset;
    const baseY = startY + ny * arrowOffset;
    const endX = baseX + nx * arrowLength;
    const endY = baseY + ny * arrowLength;

    const color = getPadColor(pad.type);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const headSize = 6;
    const angle = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - Math.cos(angle - Math.PI / 6) * headSize,
      endY - Math.sin(angle - Math.PI / 6) * headSize
    );
    ctx.lineTo(
      endX - Math.cos(angle + Math.PI / 6) * headSize,
      endY - Math.sin(angle + Math.PI / 6) * headSize
    );
    ctx.closePath();
    ctx.fill();

    const distanceValue = convertValue(length * worldScale, unitConfig.distance);
    const label = `${distanceValue.toFixed(0)} ${unitConfig.distance.label}`;
    const labelOffset = 32;
    const closeThreshold = 120;
    const labelDirection = length < closeThreshold ? -1 : 1;
    ctx.fillText(label, endX + nx * labelOffset * labelDirection, endY + ny * labelOffset * labelDirection);
  });

  ctx.restore();
}

function isPadInView(padX, cameraX, viewWidth, worldWidth) {
  const distance = wrappedDistance(padX, cameraX, worldWidth);
  return Math.abs(distance) <= viewWidth / 2;
}

function renderHud(ctx, runState, width, height, unitSystemOverride) {
  if (!runState || !runState.ship) {
    return;
  }

  const telemetry = runState.telemetry || createTelemetrySnapshot(runState);
  const unitSystem = unitSystemOverride || "metric";
  const unitConfig = getUnitConfig(unitSystem);
  const worldScale = getWorldScale(runState);
  const speed = convertValue(telemetry.speed * worldScale, unitConfig.speed);
  const accelThrust = convertValue(telemetry.accelThrust * worldScale, unitConfig.accel);
  const accelNet = convertValue(telemetry.accelNet * worldScale, unitConfig.accel);
  const thrustForce = convertValue(telemetry.thrustForce, unitConfig.thrust);
  const lateral = convertValue(telemetry.lateral * worldScale, unitConfig.distance);
  const altitude = convertValue(telemetry.altitude * worldScale, unitConfig.distance);
  const groundDistance = convertValue(telemetry.groundDistance * worldScale, unitConfig.distance);
  const verticalSpeed = convertValue(telemetry.verticalSpeed * worldScale, unitConfig.speed);
  const fuelMass = convertValue(telemetry.fuelKg, unitConfig.mass);
  const cargoMass = convertValue(telemetry.cargoMass, unitConfig.mass);
  const dryMass = convertValue(telemetry.dryMass, unitConfig.mass);
  const mass = convertValue(telemetry.mass, unitConfig.mass);
  const hullPercent = clamp(telemetry.hull, 0, 100);
  const moneySymbol = getMoneySymbol(unitSystem);
  const engineTemp = formatTemperature(telemetry, unitSystem);
  const riskTone = getLandingRiskTone(runState);
  const accelG = (telemetry.accelThrust * worldScale) / EARTH_GRAVITY;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const left = 24;
  const line = 18;
  const moneyLineHeight = 24;
  const lines = [
    {
      text: `Money: ${formatMoney(telemetry.money, moneySymbol)}`,
      tone: null,
      font: "600 20px system-ui",
      color: "#f6c453",
      height: moneyLineHeight,
    },
    { text: "", tone: null, height: line },
    { text: `Dry Mass: ${dryMass.toFixed(0)} ${unitConfig.mass.label}`, tone: null },
    {
      text: `Fuel: ${fuelMass.toFixed(0)} ${unitConfig.mass.label} (${telemetry.fuelPercent.toFixed(0)}%)`,
      tone: null,
    },
    {
      text: `Cargo: ${cargoMass.toFixed(0)} ${unitConfig.mass.label} (${telemetry.cargoPercent.toFixed(0)}%)`,
      tone: null,
    },
    { text: `Total Mass: ${mass.toFixed(0)} ${unitConfig.mass.label}`, tone: null },
    { text: "", tone: null, height: line },
    { text: `Speed: ${speed.toFixed(1)} ${unitConfig.speed.label}`, tone: riskTone },
    {
      text: `Accel: ${accelThrust.toFixed(2)} ${unitConfig.accel.label} (${accelG.toFixed(2)} g)  Net: ${accelNet.toFixed(2)} ${unitConfig.accel.label}`,
      tone: null,
    },
    { text: `Thrust: ${thrustForce.toFixed(0)} ${unitConfig.thrust.label}`, tone: null },
    { text: `Engine: ${engineTemp.value.toFixed(0)} ${engineTemp.label}`, tone: null },
    {
      text: `Lateral: ${lateral.toFixed(1)} ${unitConfig.distance.label}  Vertical: ${altitude.toFixed(1)} ${unitConfig.distance.label}`,
      tone: riskTone,
    },
    { text: `Ground: ${groundDistance.toFixed(1)} ${unitConfig.distance.label}`, tone: null },
    { text: `V-Speed: ${verticalSpeed.toFixed(1)} ${unitConfig.speed.label}`, tone: riskTone },
    { text: `Angle: ${telemetry.angleDeg.toFixed(1)}°  Spin: ${telemetry.spinDeg.toFixed(1)}°/s`, tone: riskTone },
    { text: "", tone: null, height: line },
    { text: `Hull: ${hullPercent.toFixed(0)}%`, tone: null },
  ];

  const bottomPadding = 24;
  const totalHeight = lines.reduce((sum, entry) => sum + (entry.height ?? line), 0);
  let y = height - bottomPadding - totalHeight;

  lines.forEach((entry) => {
    const heightStep = entry.height ?? line;
    if (!entry.text) {
      y += heightStep;
      return;
    }
    ctx.font = entry.font || "500 16px system-ui";
    ctx.fillStyle = entry.color || getToneColor(entry.tone) || "#dfe6ee";
    ctx.fillText(entry.text, left, y);
    y += heightStep;
  });

  ctx.restore();
}

function getLandingRiskTone(runState) {
  if (!runState || !runState.ship || !runState.activePad) {
    return null;
  }

  const velocity = runState.ship.velocity || { x: 0, y: 0 };
  const vertical = Math.abs(velocity.y);
  const lateral = Math.abs(velocity.x);
  const spin = Math.abs(runState.ship.angularVelocity || 0);
  const safe =
    vertical <= LANDING_VERTICAL_SPEED_THRESHOLD &&
    lateral <= LANDING_LATERAL_SPEED_THRESHOLD &&
    spin <= LANDING_ROTATION_SPEED_THRESHOLD;

  if (safe) {
    return "safe";
  }

  const crashMultiplier = 1.5;
  const crash =
    vertical > LANDING_VERTICAL_SPEED_THRESHOLD * crashMultiplier ||
    lateral > LANDING_LATERAL_SPEED_THRESHOLD * crashMultiplier ||
    spin > LANDING_ROTATION_SPEED_THRESHOLD * crashMultiplier;

  return crash ? "danger" : "warning";
}

function getToneColor(tone) {
  if (tone === "safe") {
    return "#6fe3a5";
  }
  if (tone === "warning") {
    return "#f6c453";
  }
  if (tone === "danger") {
    return "#e46a6a";
  }

  return null;
}

function buildPadPrompt(runState) {
  if (!runState || !runState.activePad) {
    return "";
  }

  const pad = runState.activePad;
  const onPad =
    runState.currentState === GameState.LANDED || runState.currentState === GameState.CRASHLANDED;
  if (!onPad) {
    return "";
  }

  if (pad.type === "industrial" || pad.type === "mine") {
    if (runState.lastInputType === "gamepad") {
      return "LB to refuel · RB to load He3 cargo";
    }
    return "R to refuel · L to load He3 cargo";
  }

  if (pad.type === "colony" || pad.type === "repair") {
    if (runState.lastInputType === "gamepad") {
      return "LB to repair · RB to unload He3 cargo";
    }
    return "R to repair · U to unload He3 cargo";
  }

  return "";
}

function renderPadPrompt(ctx, runState, width, height) {
  const prompt = buildPadPrompt(runState);
  if (!prompt) {
    return;
  }

  const promptY =
    runState && runState.config && typeof runState.config.uiPadPromptY === "number"
      ? runState.config.uiPadPromptY
      : 0.66;

  ctx.save();
  ctx.fillStyle = "#dfe6ee";
  ctx.font = "500 18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(prompt, width / 2, height * promptY);
  ctx.restore();
}

function getUnitConfig(system) {
  const normalized = String(system || "metric").toLowerCase();
  if (normalized === "imperial") {
    return {
      distance: { factor: 3.28084, label: "ft" },
      speed: { factor: 3.28084, label: "ft/s" },
      accel: { factor: 3.28084, label: "ft/s²" },
      mass: { factor: 2.20462, label: "lb" },
      thrust: { factor: 0.224809, label: "lbf" },
      temp: "f",
    };
  }

  if (normalized === "scientific") {
    return {
      distance: { factor: 1, label: "m" },
      speed: { factor: 1, label: "m/s" },
      accel: { factor: 1, label: "m/s²" },
      mass: { factor: 1, label: "kg" },
      thrust: { factor: 1, label: "N" },
      temp: "k",
    };
  }

  return {
    distance: { factor: 1, label: "m" },
    speed: { factor: 1, label: "m/s" },
    accel: { factor: 1, label: "m/s²" },
    mass: { factor: 1, label: "kg" },
    thrust: { factor: 1, label: "N" },
    temp: "c",
  };
}

function convertValue(value, unit) {
  if (!unit || typeof unit.factor !== "number") {
    return value;
  }

  return value * unit.factor;
}

function getWorldScale(runState) {
  if (!runState || !runState.config) {
    return 1;
  }

  const scale = runState.config.worldUnitMeters;
  return typeof scale === "number" && Number.isFinite(scale) ? scale : 1;
}

function formatTemperature(telemetry, unitSystem) {
  const normalized = String(unitSystem || "metric").toLowerCase();
  if (normalized === "imperial") {
    return { value: telemetry.engineTempF, label: "°F" };
  }
  if (normalized === "scientific") {
    return { value: telemetry.engineTempK, label: "K" };
  }
  return { value: telemetry.engineTempC, label: "°C" };
}

function getMoneySymbol(unitSystem) {
  const normalized = String(unitSystem || "metric").toLowerCase();
  if (normalized === "imperial") {
    return "$";
  }
  if (normalized === "scientific") {
    return "¤";
  }
  return "€";
}

function formatMoney(value, symbol) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const rounded = Math.round(Math.abs(amount));
  const formatted =
    typeof Intl !== "undefined" && Intl.NumberFormat
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded)
      : String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = amount < 0 ? "-" : "";
  return `${sign}${symbol}${formatted}`;
}
function formatAngleDegrees(radians) {
  let degrees = (radians * 180) / Math.PI;

  while (degrees > 180) {
    degrees -= 360;
  }

  while (degrees < -180) {
    degrees += 360;
  }

  return degrees;
}

function formatSpinDegrees(radiansPerSecond) {
  return (radiansPerSecond * 180) / Math.PI;
}

function updateTelemetry(runState, dt) {
  if (!runState || !runState.ship) {
    return;
  }

  runState.telemetryTimer = (runState.telemetryTimer || 0) + dt;
  const interval = 1 / 15;
  if (runState.telemetryTimer < interval) {
    return;
  }

  runState.telemetryTimer = runState.telemetryTimer % interval;
  runState.telemetry = createTelemetrySnapshot(runState);
}

function getAltitudeFromNearestPad(runState) {
  if (!runState || !runState.ship) {
    return 0;
  }

  const world = runState.world || {};
  const pads = world.pads || [];
  const shipX = runState.ship.position ? runState.ship.position.x : 0;
  const shipY = runState.ship.position ? runState.ship.position.y : 0;

  let padHeight = 0;
  if (pads.length > 0) {
    const nearest = findNearestPad(pads, shipX, world.width || 0);
    padHeight = nearest ? nearest.height : 0;
  } else if (world.terrain) {
    padHeight = world.terrain.getHeightAt(shipX);
  }

  return padHeight - shipY;
}

function getGroundDistance(runState) {
  if (!runState || !runState.ship) {
    return 0;
  }

  const shipX = runState.ship.position ? runState.ship.position.x : 0;
  const shipY = runState.ship.position ? runState.ship.position.y : 0;
  const groundHeight = getGroundHeightAt(runState, shipX);
  return groundHeight - shipY;
}

function getGroundHeightAt(runState, x) {
  if (!runState || !runState.world) {
    return 0;
  }

  const world = runState.world || {};
  const terrain = world.terrain;
  if (!terrain) {
    return 0;
  }

  let groundHeight = terrain.getHeightAt(x);
  const spacePads = world.spacePads;
  if (spacePads && typeof spacePads.getPadAt === "function") {
    const pad = spacePads.getPadAt(x);
    if (pad && typeof pad.height === "number") {
      groundHeight = pad.height;
    }
  }
  return groundHeight;
}

function getGroundInfoAt(runState, x) {
  if (!runState || !runState.world) {
    return { height: 0, slope: 0 };
  }

  const world = runState.world || {};
  const terrain = world.terrain;
  if (!terrain) {
    return { height: 0, slope: 0 };
  }

  let height = terrain.getHeightAt(x);
  let slope = typeof terrain.getSlopeAt === "function" ? terrain.getSlopeAt(x) : 0;
  const spacePads = world.spacePads;
  if (spacePads && typeof spacePads.getPadAt === "function") {
    const pad = spacePads.getPadAt(x);
    if (pad && typeof pad.height === "number") {
      height = pad.height;
      slope = 0;
    }
  }
  return { height, slope };
}

function findGroundImpact(runState, origin, direction, maxDistance) {
  if (!origin || !direction || maxDistance <= 0) {
    return null;
  }

  if (direction.y <= 0) {
    return null;
  }

  const step = Math.max(1, maxDistance / 30);
  let lastX = origin.x;
  let lastY = origin.y;
  let lastGround = getGroundHeightAt(runState, lastX);

  for (let t = step; t <= maxDistance; t += step) {
    const x = origin.x + direction.x * t;
    const y = origin.y + direction.y * t;
    const groundInfo = getGroundInfoAt(runState, x);
    const groundY = groundInfo.height;
    if (y >= groundY) {
      const normal = normalizeVector({ x: -groundInfo.slope, y: 1 });
      const alignment = clamp(direction.x * normal.x + direction.y * normal.y, 0, 1);
      return {
        x,
        y: groundY,
        distance: t,
        alignment,
      };
    }
    lastX = x;
    lastY = y;
    lastGround = groundY;
  }

  if (lastY >= lastGround) {
    return {
      x: lastX,
      y: lastGround,
      distance: maxDistance,
      alignment: 0,
    };
  }

  return null;
}

function normalizeVector(vec) {
  const length = Math.hypot(vec.x, vec.y);
  if (!length) {
    return { x: 0, y: 0 };
  }
  return { x: vec.x / length, y: vec.y / length };
}

function computeAccelerationValues(runState) {
  if (!runState || !runState.ship) {
    return { thrust: 0, net: 0 };
  }

  const ship = runState.ship;
  const mass = ship.mass || 1;
  const thrust = ship.thrustForce || 0;
  const thrustAccel = mass > 0 ? thrust / mass : 0;
  const ax = Math.sin(ship.rotation || 0) * thrustAccel;
  const ay = -Math.cos(ship.rotation || 0) * thrustAccel + LUNAR_GRAVITY;
  return {
    thrust: Math.abs(thrustAccel),
    net: Math.hypot(ax, ay),
  };
}

function findNearestPad(pads, x, worldWidth) {
  if (!pads || pads.length === 0) {
    return null;
  }

  let best = pads[0];
  let bestDistance = wrappedDistance(x, pads[0].x, worldWidth);

  for (let i = 1; i < pads.length; i += 1) {
    const distance = wrappedDistance(x, pads[i].x, worldWidth);
    if (Math.abs(distance) < Math.abs(bestDistance)) {
      best = pads[i];
      bestDistance = distance;
    }
  }

  return best;
}

function wrappedDistance(a, b, width) {
  if (!width) {
    return a - b;
  }

  const delta = a - b;
  const wrapped = ((delta + width / 2) % width) - width / 2;
  return wrapped < -width / 2 ? wrapped + width : wrapped;
}

function createTelemetrySnapshot(runState) {
  const ship = runState.ship || {};
  const velocity = ship.velocity || { x: 0, y: 0 };
  const speed = Math.hypot(velocity.x, velocity.y);
  const lateral = velocity.x;
  const verticalSpeed =
    runState.currentState === GameState.LANDED ||
    runState.currentState === GameState.CRASHLANDED
      ? 0
      : -velocity.y;
  const accelValues = computeAccelerationValues(runState);
  const altitude = getAltitudeFromNearestPad(runState);
  const groundDistance = getGroundDistance(runState);
  const fuel = ship.fuel ?? 0;
  const fuelCapacity = ship.fuelCapacity ?? 0;
  const fuelPercent = fuelCapacity > 0 ? (fuel / fuelCapacity) * 100 : 0;
  const cargoCapacity = ship.cargoCapacity ?? 0;
  const cargoMass = ship.cargoMass ?? 0;
  const cargoPercent = cargoCapacity > 0 ? (cargoMass / cargoCapacity) * 100 : 0;
  const hull = ship.hullHP ?? 0;
  const dryMass = ship.dryMass ?? 0;
  const mass = ship.mass ?? 0;
  const rotationDeg = formatAngleDegrees(ship.rotation ?? 0);
  const spinDeg = formatSpinDegrees(ship.angularVelocity ?? 0);
  const thrustForce = ship.thrustForce ?? 0;
  const engineTempK = getThrusterTemperatureK(runState);
  const engineTempC = engineTempK - 273.15;
  const engineTempF = (engineTempC * 9) / 5 + 32;

  return {
    speed,
    accelThrust: accelValues.thrust,
    accelNet: accelValues.net,
    accelG: accelValues.thrust / EARTH_GRAVITY,
    lateral,
    verticalSpeed,
    altitude,
    groundDistance,
    fuelKg: fuel * FUEL_MASS_PER_UNIT,
    fuelPercent,
    cargoMass,
    cargoCapacity,
    cargoPercent,
    dryMass,
    hull,
    mass,
    angleDeg: rotationDeg,
    spinDeg,
    thrustForce,
    engineTempK,
    engineTempC,
    engineTempF,
    money: runState.money ?? 0,
  };
}

function getThrusterTemperatureK(runState) {
  if (!runState || !runState.ship) {
    return 0;
  }

  const rawHeat =
    runState.ship.thrusterHeat && typeof runState.ship.thrusterHeat.main === "number"
      ? runState.ship.thrusterHeat.main
      : 0;
  const config = runState.config || {};
  const minK = typeof config.thrusterHeatMinTempK === "number" ? config.thrusterHeatMinTempK : 600;
  const maxK = typeof config.thrusterHeatMaxTempK === "number" ? config.thrusterHeatMaxTempK : 2200;
  const low = Math.min(minK, maxK);
  const high = Math.max(minK, maxK);
  const heatMax = typeof config.thrusterHeatMax === "number" && config.thrusterHeatMax > 0 ? config.thrusterHeatMax : 1;
  const heat = clamp(rawHeat / heatMax, 0, 1);
  return low + heat * (high - low);
}

function handleLanding(runState) {
  if (!runState) {
    return;
  }
}

function handleCrash(runState, damage) {
  if (!runState || !runState.economy || !runState.cargoHold || !runState.ship) {
    return;
  }

  if (typeof damage === "number" && damage > 0) {
    runState.ship.hullHP = Math.max(0, (runState.ship.hullHP || 0) - damage);
  }

  runState.economy.crashCargo(runState.cargoHold);
  runState.money = runState.economy.getMoney();
  runState.ship.cargoMass = 0;
  runState.ship.cargo = runState.cargoHold.getSlots();
}

function renderGameOver(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#f4c16d";
  ctx.font = "700 48px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GAME OVER", width / 2, height / 2 - 20);

  ctx.font = "400 18px system-ui";
  ctx.fillStyle = "#e6eef7";
  ctx.fillText("Press Esc to return to menu", width / 2, height / 2 + 24);
  ctx.restore();
}

function renderCrashLanded(ctx, width, height, runState) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#f4c16d";
  ctx.font = "700 40px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const crashY =
    runState && runState.config && typeof runState.config.uiCrashMessageY === "number"
      ? runState.config.uiCrashMessageY
      : 0.33;
  const titleY = height * crashY;
  ctx.fillText("CRASH-LANDED", width / 2, titleY);

  ctx.font = "400 16px system-ui";
  ctx.fillStyle = "#e6eef7";
  const message =
    (runState && runState.crashMessage) || "You were towed to the nearest spacepad.";
  ctx.fillText(message, width / 2, titleY + 24);
  ctx.fillText("Press Esc to return to menu", width / 2, titleY + 46);
  ctx.restore();
}

function renderCrashed(ctx, width, height, config) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#f4c16d";
  ctx.font = "700 44px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const crashY =
    config && typeof config.uiCrashMessageY === "number" ? config.uiCrashMessageY : 0.33;
  const titleY = height * crashY;
  ctx.fillText("CRASHED", width / 2, titleY);

  ctx.font = "400 18px system-ui";
  ctx.fillStyle = "#e6eef7";
  ctx.fillText("Press Esc to return to menu", width / 2, titleY + 32);
  ctx.restore();
}

function buildSaveModel(runState, musicState) {
  const ship = runState.ship || {};
  const world = runState.world || {};
  const cargo = runState.cargoHold ? runState.cargoHold.getSlots() : ship.cargo || [];

  return {
    version: 1,
    money: runState.money ?? 0,
    activePadId: runState.activePad ? runState.activePad.id : null,
    spawnPadId: runState.spawnPad ? runState.spawnPad.id : null,
    ship: {
      position: ship.position || { x: 0, y: 0 },
      velocity: ship.velocity || { x: 0, y: 0 },
      rotation: ship.rotation ?? 0,
      fuel: ship.fuel ?? 0,
      hullHP: ship.hullHP ?? 100,
      thrusterHeat:
        ship.thrusterHeat && typeof ship.thrusterHeat === "object"
          ? { ...ship.thrusterHeat }
          : createThrusterHeatState(),
      modules: ship.modules || {},
      cargo,
      cargoCapacity: ship.cargoCapacity ?? 0,
      cargoMass: ship.cargoMass ?? 0,
      dryMass: ship.dryMass ?? 0,
      mass: ship.mass ?? 0,
    },
    world: {
      width: world.width ?? 5000,
      seed: world.seed ?? 0,
      pads: world.pads || [],
    },
    currentState: runState.currentState || GameState.FLIGHT,
    music: buildMusicSave(musicState),
  };
}

function buildMusicSave(musicState) {
  if (!musicState || typeof musicState !== "object") {
    return { track: "", time: 0 };
  }

  return {
    track: typeof musicState.src === "string" ? stripMusicQuery(musicState.src) : "",
    time: typeof musicState.time === "number" && Number.isFinite(musicState.time) ? musicState.time : 0,
  };
}

function stripMusicQuery(src) {
  return String(src || "").split("?")[0];
}

  function createPauseInput() {
  let pauseRequested = false;
  let previousBack = false;
  let previousStart = false;

  function onKeyDown(event) {
    if (event.code !== "Escape") {
      return;
    }

    event.preventDefault();
    pauseRequested = true;
  }

  window.addEventListener("keydown", onKeyDown);

  function update() {
    const pad = getGamepad();
    const startPressed = pad && pad.buttons[9] && pad.buttons[9].pressed;

    if (startPressed && !previousStart) {
      pauseRequested = true;
    }

    previousStart = Boolean(startPressed);
  }

  function consume() {
    if (!pauseRequested) {
      return false;
    }

    pauseRequested = false;
    return true;
  }

  function destroy() {
    window.removeEventListener("keydown", onKeyDown);
  }

  return {
    update,
    consume,
    destroy,
  };
}

function createLogger(config) {
  return function logDebug(message, data) {
    if (!config.debug) {
      return;
    }

    if (typeof data === "undefined") {
      console.log(`[debug] ${message}`);
      return;
    }

    console.log(`[debug] ${message}`, data);
  };
}

function getGamepad() {
  if (!navigator.getGamepads) {
    return null;
  }

  const pads = navigator.getGamepads();
  return pads && pads[0] ? pads[0] : null;
}

function isMusicEnabled(settings) {
  if (!settings) {
    return false;
  }

  return settings.masterVolume > 0 && settings.musicVolume > 0;
}

function isSfxEnabled(settings) {
  if (!settings) {
    return false;
  }

  return settings.masterVolume > 0 && settings.sfxVolume > 0;
}
