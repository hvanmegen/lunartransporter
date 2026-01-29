// Lightweight procedural audio engine (no external assets).
export function createAudioEngine({ masterVolume = 0.8, sfxVolume = 0.8 } = {}) {
  let context = null;
  let masterGain = null;
  let sfxGain = null;
  let engineNoise = null;
  let engineFilter = null;
  let engineGain = null;
  let engineMidFilter = null;
  let engineMidGain = null;
  let engineRumble = null;
  let engineRumbleGain = null;
  let rotationNoise = null;
  let rotationFilter = null;
  let rotationGain = null;
  let rotationTone = null;
  let rotationToneGain = null;
  let ambientNoise = null;
  let ambientFilter = null;
  let ambientGain = null;
  let ambientTone = null;
  let ambientToneGain = null;
  let refuelNoise = null;
  let refuelFilter = null;
  let refuelGain = null;
  let cargoNoise = null;
  let cargoFilter = null;
  let cargoGain = null;
  let started = false;
  let lastState = null;
  let volume = clamp(masterVolume, 0, 1);
  let sfxVolumeValue = clamp(sfxVolume, 0, 1);
  let lastUpdateTime = 0;
  let ambientRecovering = false;
  let ambientRecoverElapsed = 0;
  let ambientRecoverDuration = 0;
  let lastSfxActive = false;
  let nextCoolingTickTime = 0;

  function start() {
    if (started) {
      return true;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return false;
    }

    context = new AudioContextClass();
    masterGain = context.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(context.destination);

    sfxGain = context.createGain();
    sfxGain.gain.value = sfxVolumeValue;
    sfxGain.connect(masterGain);

    // Main engine: low rumble + filtered noise + turbopump tone.
    engineNoise = createLoopedNoise(context);
    engineFilter = context.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 450;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineNoise.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(sfxGain);

    engineMidFilter = context.createBiquadFilter();
    engineMidFilter.type = "bandpass";
    engineMidFilter.frequency.value = 1100;
    engineMidFilter.Q.value = 0.6;
    engineMidGain = context.createGain();
    engineMidGain.gain.value = 0;
    engineNoise.connect(engineMidFilter);
    engineMidFilter.connect(engineMidGain);
    engineMidGain.connect(sfxGain);

    engineRumble = context.createOscillator();
    engineRumble.type = "sawtooth";
    engineRumble.frequency.value = 55;
    engineRumbleGain = context.createGain();
    engineRumbleGain.gain.value = 0;
    engineRumble.connect(engineRumbleGain);
    engineRumbleGain.connect(sfxGain);

    // Rotation thrusters: high hiss + turbopump tone.
    rotationNoise = createLoopedNoise(context);
    rotationFilter = context.createBiquadFilter();
    rotationFilter.type = "bandpass";
    rotationFilter.frequency.value = 1800;
    rotationFilter.Q.value = 0.8;
    rotationGain = context.createGain();
    rotationGain.gain.value = 0;
    rotationNoise.connect(rotationFilter);
    rotationFilter.connect(rotationGain);
    rotationGain.connect(sfxGain);

    rotationTone = context.createOscillator();
    rotationTone.type = "triangle";
    rotationTone.frequency.value = 420;
    rotationToneGain = context.createGain();
    rotationToneGain.gain.value = 0;
    rotationTone.connect(rotationToneGain);
    rotationToneGain.connect(sfxGain);

    // Ambient idle: soft rumble + filtered noise.
    ambientNoise = createLoopedNoise(context);
    ambientFilter = context.createBiquadFilter();
    ambientFilter.type = "lowpass";
    ambientFilter.frequency.value = 240;
    ambientGain = context.createGain();
    ambientGain.gain.value = 0;
    ambientNoise.connect(ambientFilter);
    ambientFilter.connect(ambientGain);
    ambientGain.connect(sfxGain);

    ambientTone = context.createOscillator();
    ambientTone.type = "sine";
    ambientTone.frequency.value = 110;
    ambientToneGain = context.createGain();
    ambientToneGain.gain.value = 0;
    ambientTone.connect(ambientToneGain);
    ambientToneGain.connect(sfxGain);

    // Refueling hiss.
    refuelNoise = createLoopedNoise(context);
    refuelFilter = context.createBiquadFilter();
    refuelFilter.type = "highpass";
    refuelFilter.frequency.value = 240;
    refuelGain = context.createGain();
    refuelGain.gain.value = 0;
    refuelNoise.connect(refuelFilter);
    refuelFilter.connect(refuelGain);
    refuelGain.connect(sfxGain);

    // Cargo transfer hiss.
    cargoNoise = createLoopedNoise(context);
    cargoFilter = context.createBiquadFilter();
    cargoFilter.type = "bandpass";
    cargoFilter.frequency.value = 900;
    cargoFilter.Q.value = 0.7;
    cargoGain = context.createGain();
    cargoGain.gain.value = 0;
    cargoNoise.connect(cargoFilter);
    cargoFilter.connect(cargoGain);
    cargoGain.connect(sfxGain);

    engineNoise.start();
    engineRumble.start();
    rotationNoise.start();
    rotationTone.start();
    ambientNoise.start();
    ambientTone.start();
    refuelNoise.start();
    cargoNoise.start();

    started = true;
    return true;
  }

  function setMasterVolume(nextVolume) {
    volume = clamp(nextVolume, 0, 1);
    if (masterGain && context) {
      masterGain.gain.setTargetAtTime(volume, context.currentTime, 0.05);
    }
  }

  function setSfxVolume(nextVolume) {
    sfxVolumeValue = clamp(nextVolume, 0, 1);
    if (sfxGain && context) {
      sfxGain.gain.setTargetAtTime(sfxVolumeValue, context.currentTime, 0.05);
    }
  }

  function update({
    throttle = 0,
    rotation = 0,
    state = "",
    hotThrusters = null,
    refuel = null,
    cargo = null,
  } = {}) {
    if (!started || !context) {
      return;
    }

    const now = context.currentTime;
    const delta = lastUpdateTime ? Math.max(0, now - lastUpdateTime) : 0;
    lastUpdateTime = now;
    const throttleValue = clamp(throttle, 0, 1);
    const rotationValue = clamp(Math.abs(rotation), 0, 1);

    const engineLevel = Math.pow(throttleValue, 1.4);
    const mainScale = 0.5;
    engineGain.gain.setTargetAtTime(engineLevel * 0.34 * mainScale, now, 0.05);
    engineFilter.frequency.setTargetAtTime(300 + engineLevel * 1500, now, 0.05);
    engineMidGain.gain.setTargetAtTime(engineLevel * 0.07 * mainScale, now, 0.05);
    engineMidFilter.frequency.setTargetAtTime(850 + engineLevel * 1100, now, 0.05);
    engineRumble.frequency.setTargetAtTime(36 + engineLevel * 68, now, 0.05);
    engineRumbleGain.gain.setTargetAtTime(engineLevel * 0.26 * mainScale, now, 0.05);

    const rotationLevel = Math.pow(rotationValue, 1.2);
    const smallScale = 0.7;
    rotationGain.gain.setTargetAtTime(rotationLevel * 0.24 * smallScale, now, 0.03);
    rotationFilter.frequency.setTargetAtTime(1500 + rotationLevel * 2000, now, 0.03);
    rotationTone.frequency.setTargetAtTime(340 + rotationLevel * 420, now, 0.03);
    rotationToneGain.gain.setTargetAtTime(rotationLevel * 0.04 * smallScale, now, 0.03);

    const ambientBase = shouldPlayAmbient(state) ? 0.06 : 0;
    const sfxActive = engineLevel > 0.02 || rotationLevel > 0.02;

    if (sfxActive) {
      ambientRecovering = false;
      ambientRecoverElapsed = 0;
    } else if (lastSfxActive) {
      ambientRecovering = true;
      ambientRecoverElapsed = 0;
      ambientRecoverDuration = randomRange(5, 10);
    }

    lastSfxActive = sfxActive;

    let recoveryFactor = 1;
    if (ambientRecovering) {
      ambientRecoverElapsed += delta;
      recoveryFactor = clamp(ambientRecoverElapsed / ambientRecoverDuration, 0, 1);
      if (recoveryFactor >= 1) {
        ambientRecovering = false;
      }
    }

    if (sfxActive) {
      recoveryFactor = 0;
    }

    const ambientLevel = ambientBase * recoveryFactor;
    ambientGain.gain.setTargetAtTime(ambientLevel, now, 0.25);
    ambientToneGain.gain.setTargetAtTime(ambientLevel * 0.55, now, 0.25);

    updateRefuelSound(refuel, now);
    updateCargoSound(cargo, now);

    handleCoolingTicks({
      now,
      throttleValue,
      hotThrusters,
    });

    if (state && state !== lastState) {
      handleStateTransition(state);
      lastState = state;
    }
  }

  function handleStateTransition(state) {
    if (!context) {
      return;
    }

    if (state === "out_of_fuel") {
      playFuelDing();
    }

    if (state === "landed") {
      playLandingThunk();
    }

    if (state === "crashed" || state === "crashlanded") {
      playCrash();
    }
  }

  function playFuelDing() {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(sfxGain);

    const now = context.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  function playLandingThunk() {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "triangle";
    osc.frequency.value = 140;
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(sfxGain);

    const now = context.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  function playCrash() {
    const noise = createOneShotNoise(context, 0.25);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    const gain = context.createGain();
    gain.gain.value = 0.001;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    const now = context.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    noise.start(now);
    noise.stop(now + 0.4);

    const osc = context.createOscillator();
    const oscGain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = 90;
    oscGain.gain.value = 0.001;
    osc.connect(oscGain);
    oscGain.connect(sfxGain);
    oscGain.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  function updateRefuelSound(refuel, now) {
    if (!refuelGain || !refuelFilter) {
      return;
    }

    const percent = clamp(refuel && typeof refuel.percent === "number" ? refuel.percent : 0, 0, 1);
    const active = Boolean(refuel && refuel.active) && percent < 1;
    const curve = Math.pow(percent, 2.6);
    const gainTarget = active ? 0.03 + 0.03 * curve : 0;
    const freq = 240 + curve * 2200;
    refuelGain.gain.setTargetAtTime(gainTarget, now, 0.08);
    refuelFilter.frequency.setTargetAtTime(freq, now, 0.1);
  }

  function playRefuelDing() {
    if (!context || !sfxGain) {
      return;
    }

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = 820;
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(sfxGain);

    const now = context.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.26, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.62);
  }

  function playRefuelClick() {
    if (!context || !sfxGain) {
      return;
    }

    const noise = createOneShotNoise(context, 0.05);
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    const gain = context.createGain();
    gain.gain.value = 0.001;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    const now = context.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.start(now);
    noise.stop(now + 0.14);
  }

  function updateCargoSound(cargo, now) {
    if (!cargoGain || !cargoFilter) {
      return;
    }

    const percent = clamp(cargo && typeof cargo.percent === "number" ? cargo.percent : 0, 0, 1);
    const active = Boolean(cargo && cargo.active);
    const mode = cargo && cargo.mode ? cargo.mode : "load";
    const curve = mode === "unload" ? Math.pow(1 - percent, 2.2) : Math.pow(percent, 2.2);
    const variance = mode === "unload" ? 0.18 : 0.12;
    const base = mode === "unload" ? 900 : 650;
    const range = mode === "unload" ? 2200 : 1800;
    const wobble = Math.sin(now * 4.1) * variance + Math.sin(now * 7.7) * (variance * 0.6);
    const freq = Math.max(200, base + curve * range + wobble * range);
    const gainTarget = active ? 0.04 + 0.05 * curve : 0;
    cargoGain.gain.setTargetAtTime(gainTarget, now, 0.08);
    cargoFilter.frequency.setTargetAtTime(freq, now, 0.08);
  }

  function handleCoolingTicks({ now, throttleValue, hotThrusters }) {
    const cooling = normalizeCoolingInput(hotThrusters);
    if (!cooling) {
      return;
    }

    if (throttleValue > 0.02) {
      nextCoolingTickTime = now + 0.25;
      return;
    }

    if (cooling.heat < cooling.threshold) {
      nextCoolingTickTime = now + 0.4;
      return;
    }

    if (cooling.tempC <= 100) {
      nextCoolingTickTime = now + 0.6;
      return;
    }

    if (now < nextCoolingTickTime) {
      return;
    }

    const heatFactor = clamp((cooling.heat - cooling.threshold) / (1 - cooling.threshold), 0, 1);
    const tempFactor = clamp((cooling.tempC - 100) / Math.max(1, cooling.tempMaxC - 100), 0, 1);
    const intensity = clamp(0.25 + heatFactor * 0.25 + tempFactor * 0.75, 0, 1);
    const gainScale = cooling.gain * (0.6 + tempFactor * 0.9);
    playCoolingTick(intensity, tempFactor, gainScale);

    const minDelay = Math.min(cooling.minDelay, cooling.maxDelay);
    const maxDelay = Math.max(cooling.minDelay, cooling.maxDelay);
    const interval = lerp(maxDelay, minDelay, Math.max(heatFactor, tempFactor));
    const jitter = interval * (0.25 + Math.random() * 0.45);
    nextCoolingTickTime = now + interval + jitter;
  }

  function normalizeCoolingInput(hotThrusters) {
    if (!hotThrusters) {
      return null;
    }

    if (typeof hotThrusters === "number") {
      return {
        heat: clamp(hotThrusters, 0, 1),
        threshold: 0.3,
        minDelay: 0.35,
        maxDelay: 1.2,
        gain: 0.35,
        tempC: 0,
        tempMaxC: 0,
      };
    }

    if (Array.isArray(hotThrusters)) {
      const maxHeat = hotThrusters.reduce((acc, entry) => {
        const heat = entry && typeof entry.heat === "number" ? entry.heat : 0;
        return Math.max(acc, heat);
      }, 0);

      const sample = hotThrusters.find((entry) => entry && typeof entry.heat === "number");
      return {
        heat: clamp(maxHeat, 0, 1),
        threshold: sample && typeof sample.threshold === "number" ? sample.threshold : 0.3,
        minDelay: sample && typeof sample.minDelay === "number" ? sample.minDelay : 0.35,
        maxDelay: sample && typeof sample.maxDelay === "number" ? sample.maxDelay : 1.2,
        gain: sample && typeof sample.gain === "number" ? sample.gain : 0.35,
        tempC: sample && typeof sample.tempC === "number" ? sample.tempC : 0,
        tempMaxC: sample && typeof sample.tempMaxC === "number" ? sample.tempMaxC : 0,
      };
    }

    if (typeof hotThrusters === "object") {
      return {
        heat: clamp(typeof hotThrusters.heat === "number" ? hotThrusters.heat : 0, 0, 1),
        threshold: typeof hotThrusters.threshold === "number" ? hotThrusters.threshold : 0.3,
        minDelay: typeof hotThrusters.minDelay === "number" ? hotThrusters.minDelay : 0.35,
        maxDelay: typeof hotThrusters.maxDelay === "number" ? hotThrusters.maxDelay : 1.2,
        gain: typeof hotThrusters.gain === "number" ? hotThrusters.gain : 0.35,
        tempC: typeof hotThrusters.tempC === "number" ? hotThrusters.tempC : 0,
        tempMaxC: typeof hotThrusters.tempMaxC === "number" ? hotThrusters.tempMaxC : 0,
      };
    }

    return null;
  }

  function playCoolingTick(heatFactor, tempFactor, gainScale) {
    if (!context || !sfxGain) {
      return;
    }

    const noise = createOneShotNoise(context, 0.05 + heatFactor * 0.03);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    const basePitch = lerp(600, 1600, Math.max(tempFactor, 0.2));
    const jitter = (Math.random() - 0.5) * (120 + tempFactor * 260);
    const pitch = Math.max(300, basePitch + jitter);
    filter.frequency.value = pitch;
    filter.Q.value = 13;
    const gain = context.createGain();
    gain.gain.value = 0.001;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    const now = context.currentTime;
    const target = 0.14 + heatFactor * 0.26;
    gain.gain.exponentialRampToValueAtTime(target * gainScale, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.start(now);
    noise.stop(now + 0.14);

    const osc = context.createOscillator();
    const oscGain = context.createGain();
    osc.type = "triangle";
    const toneBase = lerp(420, 980, heatFactor);
    osc.frequency.value = Math.max(280, toneBase + jitter * 0.4);
    oscGain.gain.value = 0.001;
    osc.connect(oscGain);
    oscGain.connect(sfxGain);
    oscGain.gain.exponentialRampToValueAtTime(0.11 * gainScale, now + 0.008);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  return {
    start,
    setMasterVolume,
    setSfxVolume,
    update,
    playRefuelDing,
    playRefuelClick,
  };
}

function createLoopedNoise(context) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function createOneShotNoise(context, duration = 0.2) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = false;
  return source;
}

function shouldPlayAmbient(state) {
  return (
    state === "menu" ||
    state === "landed" ||
    state === "landing" ||
    state === "flight" ||
    state === "out_of_fuel" ||
    state === "crashlanded"
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
