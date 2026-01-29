// Enum-like game states shared across systems.
export const GameState = Object.freeze({
  MENU: "menu",
  OPTIONS: "options",
  FLIGHT: "flight",
  LANDED: "landed",
  LANDING: "landing",
  CRASHLANDED: "crashlanded",
  CRASHED: "crashed",
  OUT_OF_FUEL: "out_of_fuel",
  GAME_OVER: "game_over",
});

// Minimal state machine with optional enter/update/exit hooks.
export function createStateMachine(initialState) {
  let currentState = initialState;
  const states = new Map();

  function addState(name, handlers = {}) {
    states.set(name, {
      enter: handlers.enter || null,
      update: handlers.update || null,
      exit: handlers.exit || null,
    });
    return api;
  }

  function setState(name, data) {
    if (currentState === name) {
      return;
    }

    const previousHandlers = states.get(currentState);
    if (previousHandlers && previousHandlers.exit) {
      previousHandlers.exit(data);
    }

    currentState = name;

    const nextHandlers = states.get(currentState);
    if (nextHandlers && nextHandlers.enter) {
      nextHandlers.enter(data);
    }
  }

  function update(deltaSeconds) {
    const handlers = states.get(currentState);
    if (handlers && handlers.update) {
      handlers.update(deltaSeconds);
    }
  }

  function getState() {
    return currentState;
  }

  const api = {
    addState,
    setState,
    update,
    getState,
  };

  return api;
}
