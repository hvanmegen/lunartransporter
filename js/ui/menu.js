// Menu model with keyboard + gamepad input handling.
export function createMenu({
  title = "Menu",
  items = [],
  deadzone = 0.35,
  messageDuration = 2,
} = {}) {
  const input = createMenuInput({ deadzone });
  let selectedIndex = 0;
  let menuItems = items.slice();
  let message = "";
  let messageTimer = 0;
  let suppressBackTimer = 0;

  function update(dt) {
    input.update();

    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) {
        message = "";
      }
    }

    if (suppressBackTimer > 0) {
      suppressBackTimer = Math.max(0, suppressBackTimer - dt);
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

    if (action === "select") {
      const item = menuItems[selectedIndex];
      if (item && !item.disabled) {
        return { type: "select", itemId: item.id };
      }
      return null;
    }

    if (action === "back") {
      if (suppressBackTimer > 0) {
        return null;
      }
      return { type: "back" };
    }

    return null;
  }

  function moveSelection(delta) {
    if (menuItems.length === 0) {
      return;
    }

    const nextIndex = findNextEnabledIndex(menuItems, selectedIndex, delta);
    if (nextIndex !== null) {
      selectedIndex = nextIndex;
    }
  }

  function setMessage(text, duration = messageDuration) {
    message = text;
    messageTimer = duration;
  }

  function setItems(nextItems) {
    menuItems = nextItems.slice();
    if (menuItems.length === 0) {
      selectedIndex = 0;
      return;
    }

    if (selectedIndex >= menuItems.length) {
      selectedIndex = menuItems.length - 1;
    }

    if (menuItems[selectedIndex] && menuItems[selectedIndex].disabled) {
      const nextIndex = findNextEnabledIndex(menuItems, selectedIndex, 1);
      if (nextIndex !== null) {
        selectedIndex = nextIndex;
      }
    }
  }

  function getState() {
    return {
      title,
      items: menuItems.map((item) => ({ ...item })),
      selectedIndex,
      message,
      inputType: input.getLastActiveSource ? input.getLastActiveSource() : "keyboard",
    };
  }

  function destroy() {
    input.destroy();
  }

  function clearInput() {
    input.clear();
  }

  function suppressBack(duration = 0.25) {
    suppressBackTimer = Math.max(suppressBackTimer, duration);
  }

  return {
    update,
    setMessage,
    setItems,
    getState,
    clearInput,
    suppressBack,
    destroy,
  };
}

function findNextEnabledIndex(items, startIndex, delta) {
  if (items.length === 0) {
    return null;
  }

  for (let i = 0; i < items.length; i += 1) {
    const index = (startIndex + delta * (i + 1) + items.length) % items.length;
    if (!items[index].disabled) {
      return index;
    }
  }

  return null;
}

function createMenuInput({ deadzone }) {
  const actionQueue = [];
  let lastInputSource = "keyboard";
  const previousPad = {
    up: false,
    down: false,
    select: false,
    back: false,
    start: false,
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

  function clear() {
    actionQueue.length = 0;
    previousPad.up = false;
    previousPad.down = false;
    previousPad.select = false;
    previousPad.back = false;
    previousPad.start = false;
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
      previousPad.select = false;
      previousPad.back = false;
      previousPad.start = false;
      return;
    }

    const axis = applyDeadzone(pad.axes[1] || 0, deadzone);
    const upPressed = (pad.buttons[12] && pad.buttons[12].pressed) || axis < -0.5;
    const downPressed = (pad.buttons[13] && pad.buttons[13].pressed) || axis > 0.5;
    const selectPressed = pad.buttons[0] && pad.buttons[0].pressed;
    const backPressed = pad.buttons[1] && pad.buttons[1].pressed;
    const startPressed = pad.buttons[9] && pad.buttons[9].pressed;

    if (upPressed && !previousPad.up) {
      enqueueAction("up");
      lastInputSource = "gamepad";
    }
    if (downPressed && !previousPad.down) {
      enqueueAction("down");
      lastInputSource = "gamepad";
    }
    if (selectPressed && !previousPad.select) {
      enqueueAction("select");
      lastInputSource = "gamepad";
    }
    if (backPressed && !previousPad.back) {
      enqueueAction("back");
      lastInputSource = "gamepad";
    }
    if (startPressed && !previousPad.start) {
      enqueueAction("back");
      lastInputSource = "gamepad";
    }

    previousPad.up = upPressed;
    previousPad.down = downPressed;
    previousPad.select = selectPressed;
    previousPad.back = backPressed;
    previousPad.start = startPressed;
  }

  return {
    update,
    consumeAction,
    getLastActiveSource,
    clear,
    destroy,
  };
}

function isRelevantKey(code) {
  return (
    code === "ArrowUp" ||
    code === "ArrowDown" ||
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
