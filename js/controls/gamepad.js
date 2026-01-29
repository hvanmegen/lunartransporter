// Gamepad input adapter with deadzone handling.
export function createGamepad({ deadzone = 0.2, debug = false } = {}) {
  let lastInputTime = 0;
  let debugEnabled = debug;
  let previousButtons = [];
  let previousAxes = [];

  function getGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads ? pads[0] : null;
  }

  function isConnected() {
    const pad = getGamepad();
    return Boolean(pad && pad.connected);
  }

  function applyDeadzone(value) {
    if (Math.abs(value) < deadzone) {
      return 0;
    }

    const scaled = (Math.abs(value) - deadzone) / (1 - deadzone);
    return Math.sign(value) * scaled;
  }

  function readAxis(index) {
    const pad = getGamepad();
    if (!pad || !pad.axes || pad.axes.length <= index) {
      return 0;
    }

    const value = applyDeadzone(pad.axes[index]);
    if (value !== 0) {
      lastInputTime = performance.now();
    }

    return value;
  }

  function readButton(index) {
    const pad = getGamepad();
    if (!pad || !pad.buttons || pad.buttons.length <= index) {
      return 0;
    }

    const value = applyDeadzone(pad.buttons[index].value || 0);
    if (value !== 0) {
      lastInputTime = performance.now();
    }

    return value;
  }

  function getRotation() {
    return readAxis(0);
  }

  function getThrottle() {
    return readButton(7);
  }

  function getRetro() {
    return 0;
  }

  function getRefuel() {
    return readButton(4);
  }

  function getLoadCargo() {
    return readButton(5);
  }

  function getUnloadCargo() {
    return readButton(5);
  }

  function getLastInputTime() {
    return lastInputTime;
  }

  function setDebug(enabled) {
    debugEnabled = Boolean(enabled);
  }

  function poll() {
    const pad = getGamepad();
    if (!pad) {
      previousButtons = [];
      previousAxes = [];
      return;
    }

    let changed = false;
    if (debugEnabled) {
      pad.buttons.forEach((button, index) => {
        const previous = previousButtons[index] || { pressed: false, value: 0 };
        const pressedChanged = button.pressed !== previous.pressed;
        const valueChanged = Math.abs(button.value - previous.value) > 0.1;
        if (pressedChanged || valueChanged) {
          if (button.pressed) {
            console.log(
              `[gamepad] button ${index} pressed (value: ${button.value.toFixed(2)})`
            );
          } else if (pressedChanged) {
            console.log(`[gamepad] button ${index} released`);
          }
          changed = true;
        }
        previousButtons[index] = { pressed: button.pressed, value: button.value };
        if (applyDeadzone(button.value) !== 0) {
          lastInputTime = performance.now();
        }
      });

      pad.axes.forEach((axis, index) => {
        const previous = previousAxes[index] ?? 0;
        if (Math.abs(axis - previous) > 0.1) {
          console.log(`[gamepad] axis ${index}: ${axis.toFixed(2)}`);
          changed = true;
        }
        previousAxes[index] = axis;
        if (applyDeadzone(axis) !== 0) {
          lastInputTime = performance.now();
        }
      });

      if (changed) {
        logRawState(pad);
      }

      return;
    }

    pad.buttons.forEach((button) => {
      if (applyDeadzone(button.value) !== 0) {
        lastInputTime = performance.now();
      }
    });
    pad.axes.forEach((axis) => {
      if (applyDeadzone(axis) !== 0) {
        lastInputTime = performance.now();
      }
    });
  }

  function logRawState(pad) {
    if (!debugEnabled || !pad) {
      return;
    }

    const buttons = pad.buttons.map((button, index) => ({
      index,
      pressed: button.pressed,
      value: Number(button.value.toFixed(3)),
    }));
    const axes = pad.axes.map((axis) => Number(axis.toFixed(3)));

    console.log("[gamepad] raw state", {
      id: pad.id,
      index: pad.index,
      buttons,
      axes,
      connected: pad.connected,
      mapping: pad.mapping,
      timestamp: pad.timestamp,
    });
  }

  return {
    isConnected,
    getRotation,
    getThrottle,
    getRetro,
    getRefuel,
    getLoadCargo,
    getUnloadCargo,
    getLastInputTime,
    setDebug,
    poll,
  };
}
