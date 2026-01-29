// Timing helpers for the fixed timestep loop.
export const FIXED_TIMESTEP = 1 / 60;

export function createTime() {
  let lastTimeMs = 0;
  let accumulator = 0;

  function reset() {
    lastTimeMs = 0;
    accumulator = 0;
  }

  function advance(nowMs) {
    if (lastTimeMs === 0) {
      lastTimeMs = nowMs;
      return 0;
    }

    const deltaSeconds = (nowMs - lastTimeMs) / 1000;
    lastTimeMs = nowMs;
    accumulator += deltaSeconds;
    return deltaSeconds;
  }

  function consume(fixedDeltaSeconds) {
    accumulator -= fixedDeltaSeconds;
  }

  function getAccumulator() {
    return accumulator;
  }

  return {
    reset,
    advance,
    consume,
    getAccumulator,
  };
}
