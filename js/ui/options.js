// Options model with keyboard + gamepad input handling.

export function createOptions({
  title = "Options",
  settings = {},
  onApply = null,
  deadzone = 0.35,
  messageDuration = 2,
} = {}) {
  const input = createOptionsInput({ deadzone });
  const config = buildConfig();

  let selectedIndex = 0;
  let message = "";
  let messageTimer = 0;
  let applied = applyDefaults(settings, config);
  let draft = { ...applied };

  function update(dt) {
    input.update();

    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) {
        message = "";
      }
    }

    const action = input.consumeAction();
    if (!action) {
      return null;
    }

    if (action === "up") {
      moveSelection(-1);
      return null;
    }

    if (action === "down") {
      moveSelection(1);
      return null;
    }

    if (action === "left") {
      adjustCurrent(-1);
      return null;
    }

    if (action === "right") {
      adjustCurrent(1);
      return null;
    }

    if (action === "select") {
      const item = config[selectedIndex];
      if (item && item.type === "spacer") {
        return null;
      }
      if (item && item.type === "action" && item.id === "resetDefaults") {
        const defaults = getDefaultDraft();
        const result = onApply ? onApply({ ...defaults }) : { ok: true };
        if (result && result.ok === false) {
          setMessage("Reset failed.");
        } else {
          draft = { ...defaults };
          applied = { ...defaults };
          setMessage("Settings reset.");
        }
        return { type: "reset" };
      }

      const result = onApply ? onApply({ ...draft }) : { ok: true };
      if (result && result.ok === false) {
        setMessage("Apply failed.");
      } else {
        setMessage("Settings applied.");
        applied = { ...draft };
      }
      return { type: "apply" };
    }

    if (action === "back") {
      draft = { ...applied };
      return { type: "back" };
    }

    return null;
  }

  function moveSelection(delta) {
    selectedIndex = getNextSelectableIndex(selectedIndex, delta, config);
  }

  function adjustCurrent(direction) {
    const item = config[selectedIndex];
    if (!item) {
      return;
    }

    if (item.type === "action" || item.type === "spacer") {
      return;
    }

    if (item.type === "enum") {
      const index = item.values.indexOf(draft[item.id]);
      const nextIndex = (index + direction + item.values.length) % item.values.length;
      draft[item.id] = item.values[nextIndex];
      return;
    }

    const step = item.step * direction;
    const next = clamp(draft[item.id] + step, item.min, item.max);
    draft[item.id] = next;
  }

  function setMessage(text, duration = messageDuration) {
    message = text;
    messageTimer = duration;
  }

  function getState() {
    const selectedItem = config[selectedIndex];
    let controls = [];
    if (selectedItem && selectedItem.id === "inputMode") {
      controls = getControlHints(draft.inputMode, input.getLastActiveSource());
    } else if (selectedItem && selectedItem.id === "difficulty") {
      controls = getDifficultyHints();
    }

    return {
      title,
      items: config.map((item) => ({
        id: item.id,
        type: item.type || "range",
        label: item.label,
        value: formatValue(item, draft[item.id]),
      })),
      selectedIndex,
      message,
      controls,
    };
  }

  function getDefaultDraft() {
    return applyDefaults({}, config);
  }

  function destroy() {
    input.destroy();
  }

  return {
    update,
    getState,
    destroy,
  };
}

function buildConfig() {
  return [
    {
      id: "masterVolume",
      label: "Master Volume",
      type: "range",
      min: 0,
      max: 100,
      step: 5,
      unit: "percent",
      defaultValue: 60,
    },
    {
      id: "sfxVolume",
      label: "SFX Volume",
      type: "range",
      min: 0,
      max: 100,
      step: 5,
      unit: "percent",
      defaultValue: 80,
    },
    {
      id: "musicVolume",
      label: "Music Volume",
      type: "range",
      min: 0,
      max: 100,
      step: 5,
      unit: "percent",
      defaultValue: 30,
    },
    {
      id: "soundSpacer",
      label: "",
      type: "spacer",
    },
    {
      id: "cameraZoomSensitivity",
      label: "Camera Zoom Sensitivity",
      type: "range",
      min: 0.5,
      max: 2,
      step: 0.1,
      defaultValue: 1,
    },
    {
      id: "unitSystem",
      label: "Units",
      type: "enum",
      values: ["metric", "imperial", "scientific"],
      defaultValue: "metric",
    },
    {
      id: "inputMode",
      label: "Input Mode",
      type: "enum",
      values: ["auto", "keyboard", "gamepad"],
      defaultValue: "auto",
    },
    {
      id: "difficulty",
      label: "Difficulty",
      type: "enum",
      values: ["easy", "hard"],
      defaultValue: "easy",
    },
    {
      id: "resetDefaults",
      label: "Reset to Defaults",
      type: "action",
    },
  ];
}

function formatValue(item, value) {
  if (item.type === "spacer") {
    return "";
  }
  if (item.type === "action") {
    return "";
  }

  if (item.type === "enum") {
    return String(value || item.defaultValue).toUpperCase();
  }

  const safeValue = typeof value === "number" ? value : item.defaultValue;
  if (item.unit === "percent") {
    return `${Math.round(safeValue)}%`;
  }

  return formatNumber(safeValue, item.step);
}

function applyDefaults(settings, config) {
  const draft = {};
  config.forEach((item) => {
    if (item.type === "action" || item.type === "spacer") {
      return;
    }
    draft[item.id] = settings[item.id] ?? item.defaultValue;
  });
  return draft;
}

function getNextSelectableIndex(currentIndex, delta, config) {
  if (!config.length) {
    return 0;
  }

  let index = currentIndex;
  for (let i = 0; i < config.length; i += 1) {
    index = (index + delta + config.length) % config.length;
    const item = config[index];
    if (!item || item.type !== "spacer") {
      return index;
    }
  }

  return currentIndex;
}

function getDifficultyHints() {
  return [
    {
      label: "EASY",
      items: ["Thrust +15%", "Gravity -15%", "Fuel burn -20%"],
    },
    {
      label: "HARD",
      items: ["Thrust -10%", "Gravity +10%", "Fuel burn +20%"],
    },
  ];
}

function getControlHints(mode, lastActive) {
  const normalized = String(mode || "auto").toLowerCase();

  if (normalized === "keyboard") {
    return [
      { label: "Keyboard", items: ["Up/Down: select", "Left/Right: adjust", "Enter: apply", "Esc: back"] },
    ];
  }

  if (normalized === "gamepad") {
    return [
      {
        label: "Gamepad",
        items: ["D-pad/Stick: select", "Left/Right: adjust", "A: apply", "B: back"],
      },
    ];
  }

  return buildAutoHints(lastActive);
}

function buildAutoHints(lastActive) {
  const keyboard = {
    label: "Keyboard",
    items: ["Up/Down: select", "Left/Right: adjust", "Enter: apply", "Esc: back"],
  };
  const gamepad = {
    label: "Gamepad",
    items: ["D-pad/Stick: select", "Left/Right: adjust", "A: apply", "B: back"],
  };

  if (lastActive === "keyboard") {
    keyboard.label = "Keyboard (last active)";
    return [keyboard, gamepad];
  }

  if (lastActive === "gamepad") {
    gamepad.label = "Gamepad (last active)";
    return [gamepad, keyboard];
  }

  return [keyboard, gamepad];
}

function createOptionsInput({ deadzone }) {
  const actionQueue = [];
  let lastInputSource = null;
  const previousPad = {
    up: false,
    down: false,
    left: false,
    right: false,
    select: false,
    back: false,
  };

  function onKeyDown(event) {
    if (!isRelevantKey(event.code)) {
      return;
    }

    event.preventDefault();
    if (event.repeat) {
      return;
    }

    lastInputSource = "keyboard";
    enqueueAction(mapKeyToAction(event.code));
  }

  function onKeyUp(event) {
    if (!isRelevantKey(event.code)) {
      return;
    }

    event.preventDefault();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function update() {
    updateGamepad();
  }

  function consumeAction() {
    return actionQueue.shift() || null;
  }

  function getLastActiveSource() {
    return lastInputSource;
  }

  function destroy() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    actionQueue.length = 0;
  }

  function enqueueAction(action) {
    if (!action) {
      return;
    }

    actionQueue.push(action);
  }

  function updateGamepad() {
    const pad = getGamepad();
    if (!pad) {
      previousPad.up = false;
      previousPad.down = false;
      previousPad.left = false;
      previousPad.right = false;
      previousPad.select = false;
      previousPad.back = false;
      return;
    }

    const axisX = applyDeadzone(pad.axes[0] || 0, deadzone);
    const axisY = applyDeadzone(pad.axes[1] || 0, deadzone);

    const upPressed = (pad.buttons[12] && pad.buttons[12].pressed) || axisY < -0.5;
    const downPressed = (pad.buttons[13] && pad.buttons[13].pressed) || axisY > 0.5;
    const leftPressed = (pad.buttons[14] && pad.buttons[14].pressed) || axisX < -0.5;
    const rightPressed = (pad.buttons[15] && pad.buttons[15].pressed) || axisX > 0.5;
    const selectPressed = pad.buttons[0] && pad.buttons[0].pressed;
    const backPressed = pad.buttons[1] && pad.buttons[1].pressed;
    let actionQueued = false;

    if (upPressed && !previousPad.up) {
      enqueueAction("up");
      actionQueued = true;
    }
    if (downPressed && !previousPad.down) {
      enqueueAction("down");
      actionQueued = true;
    }
    if (leftPressed && !previousPad.left) {
      enqueueAction("left");
      actionQueued = true;
    }
    if (rightPressed && !previousPad.right) {
      enqueueAction("right");
      actionQueued = true;
    }
    if (selectPressed && !previousPad.select) {
      enqueueAction("select");
      actionQueued = true;
    }
    if (backPressed && !previousPad.back) {
      enqueueAction("back");
      actionQueued = true;
    }

    if (actionQueued) {
      lastInputSource = "gamepad";
    }

    previousPad.up = upPressed;
    previousPad.down = downPressed;
    previousPad.left = leftPressed;
    previousPad.right = rightPressed;
    previousPad.select = selectPressed;
    previousPad.back = backPressed;
  }

  return {
    update,
    consumeAction,
    getLastActiveSource,
    destroy,
  };
}

function isRelevantKey(code) {
  return (
    code === "ArrowUp" ||
    code === "ArrowDown" ||
    code === "ArrowLeft" ||
    code === "ArrowRight" ||
    code === "Enter" ||
    code === "Escape"
  );
}

function mapKeyToAction(code) {
  if (code === "ArrowUp") {
    return "up";
  }
  if (code === "ArrowDown") {
    return "down";
  }
  if (code === "ArrowLeft") {
    return "left";
  }
  if (code === "ArrowRight") {
    return "right";
  }
  if (code === "Enter") {
    return "select";
  }
  if (code === "Escape") {
    return "back";
  }

  return null;
}

function getGamepad() {
  if (!navigator.getGamepads) {
    return null;
  }

  const pads = navigator.getGamepads();
  return pads && pads[0] ? pads[0] : null;
}

function applyDeadzone(value, deadzone) {
  if (Math.abs(value) < deadzone) {
    return 0;
  }

  const scaled = (Math.abs(value) - deadzone) / (1 - deadzone);
  return Math.sign(value) * scaled;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value, step) {
  const decimals = getDecimalPlaces(step);
  return value.toFixed(decimals);
}

function getDecimalPlaces(step) {
  const stepString = String(step);
  const decimalIndex = stepString.indexOf(".");
  if (decimalIndex === -1) {
    return 0;
  }

  return stepString.length - decimalIndex - 1;
}
