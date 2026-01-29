// Keyboard input adapter.
export function createKeyboard() {
  const pressedKeys = new Set();
  let lastInputTime = 0;

  function isRelevantKey(code) {
    return (
      code === "ArrowLeft" ||
      code === "ArrowRight" ||
      code === "ArrowUp" ||
      code === "KeyA" ||
      code === "KeyD" ||
      code === "KeyW" ||
      code === "KeyR" ||
      code === "KeyL" ||
      code === "KeyU"
    );
  }

  function onKeyDown(event) {
    if (!isRelevantKey(event.code)) {
      return;
    }

    pressedKeys.add(event.code);
    lastInputTime = performance.now();
  }

  function onKeyUp(event) {
    if (!isRelevantKey(event.code)) {
      return;
    }

    pressedKeys.delete(event.code);
    lastInputTime = performance.now();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function getRotation() {
    const left = pressedKeys.has("ArrowLeft") || pressedKeys.has("KeyA") ? -1 : 0;
    const right = pressedKeys.has("ArrowRight") || pressedKeys.has("KeyD") ? 1 : 0;

    if (left !== 0 && right !== 0) {
      return 0;
    }

    return left + right;
  }

  function getThrottle() {
    return pressedKeys.has("ArrowUp") || pressedKeys.has("KeyW") ? 1 : 0;
  }

  function getRetro() {
    return 0;
  }

  function getRefuel() {
    return pressedKeys.has("KeyR") ? 1 : 0;
  }

  function getLoadCargo() {
    return pressedKeys.has("KeyL") ? 1 : 0;
  }

  function getUnloadCargo() {
    return pressedKeys.has("KeyU") ? 1 : 0;
  }

  function getLastInputTime() {
    return lastInputTime;
  }

  function destroy() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  }

  return {
    getRotation,
    getThrottle,
    getRetro,
    getRefuel,
    getLoadCargo,
    getUnloadCargo,
    getLastInputTime,
    destroy,
  };
}
