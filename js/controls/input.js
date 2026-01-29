import { createGamepad } from "./gamepad.js";
import { createKeyboard } from "./keyboard.js";

// Unified input selector for keyboard/gamepad sources.
export function createInput({ deadzone = 0.2, mode = "auto", debug = false } = {}) {
  const keyboard = createKeyboard();
  const gamepad = createGamepad({ deadzone, debug });
  let inputMode = normalizeMode(mode);

  function getActiveSource() {
    if (inputMode === "keyboard") {
      return keyboard;
    }

    if (inputMode === "gamepad") {
      return gamepad;
    }

    const keyboardTime = keyboard.getLastInputTime();
    const gamepadTime = gamepad.getLastInputTime();

    if (gamepad.isConnected()) {
      if (gamepadTime >= keyboardTime && gamepadTime > 0) {
        return gamepad;
      }

      if (keyboardTime > 0) {
        return keyboard;
      }

      return gamepad;
    }

    return keyboard;
  }

  function getRotation() {
    return getActiveSource().getRotation();
  }

  function getThrottle() {
    return getActiveSource().getThrottle();
  }

  function getRetro() {
    return getActiveSource().getRetro();
  }

  function getRefuel() {
    return getActiveSource().getRefuel ? getActiveSource().getRefuel() : 0;
  }

  function getLoadCargo() {
    return getActiveSource().getLoadCargo ? getActiveSource().getLoadCargo() : 0;
  }

  function getUnloadCargo() {
    return getActiveSource().getUnloadCargo ? getActiveSource().getUnloadCargo() : 0;
  }

  function setMode(nextMode) {
    inputMode = normalizeMode(nextMode);
  }

  function setDebug(enabled) {
    if (gamepad.setDebug) {
      gamepad.setDebug(enabled);
    }
  }

  function update() {
    if (gamepad.poll) {
      gamepad.poll();
    }
  }

  function destroy() {
    if (keyboard.destroy) {
      keyboard.destroy();
    }
  }

  return {
    getRotation,
    getThrottle,
    getRetro,
    getRefuel,
    getLoadCargo,
    getUnloadCargo,
    setMode,
    setDebug,
    update,
    destroy,
  };
}

function normalizeMode(mode) {
  const value = String(mode || "").toLowerCase();
  if (value === "keyboard" || value === "gamepad") {
    return value;
  }

  return "auto";
}
