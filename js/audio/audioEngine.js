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
  let repairNoise = null;
  let repairFilter = null;
  let repairGain = null;
  let repairGate = null;
  let repairDelay = null;
  let repairDelayGain = null;
  let repairDelayFeedback = null;
  let repairGateOsc = null;
  let repairGateGain = null;
  let repairGateOffset = null;
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
  let nextRepairTickTime = 0;
  let nextRepairBurstTime = 0;
  let repairBurstRemaining = 0;
  let enabled = true;
  let nextFuelAlarmTime = 0;

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

    // Repair wrench/gate noise.
    repairNoise = createLoopedNoise(context);
    repairFilter = context.createBiquadFilter();
    repairFilter.type = "bandpass";
    repairFilter.frequency.value = 1200;
    repairFilter.Q.value = 1.4;
    repairGain = context.createGain();
    repairGain.gain.value = 0;
    repairGate = context.createGain();
    repairGate.gain.value = 0;
    repairNoise.connect(repairFilter);
    repairFilter.connect(repairGain);
    repairGain.connect(repairGate);
    repairGate.connect(sfxGain);

    repairDelay = context.createDelay(0.2);
    repairDelay.delayTime.value = 0.06;
    repairDelayFeedback = context.createGain();
    repairDelayFeedback.gain.value = 0.22;
    repairDelayGain = context.createGain();
    repairDelayGain.gain.value = 0.25;
    repairGate.connect(repairDelay);
    repairDelay.connect(repairDelayGain);
    repairDelayGain.connect(sfxGain);
    repairDelay.connect(repairDelayFeedback);
    repairDelayFeedback.connect(repairDelay);

    repairGateOsc = context.createOscillator();
    repairGateOsc.type = "square";
    repairGateOsc.frequency.value = 1;
    repairGateGain = context.createGain();
    repairGateGain.gain.value = 0.5;
    repairGateOsc.connect(repairGateGain);
    if (context.createConstantSource) {
      repairGateOffset = context.createConstantSource();
      repairGateOffset.offset.value = 0.5;
      repairGateOffset.connect(repairGate.gain);
      repairGateOffset.start();
      repairGateGain.connect(repairGate.gain);
    }

    engineNoise.start();
    engineRumble.start();
    rotationNoise.start();
    rotationTone.start();
    ambientNoise.start();
    ambientTone.start();
    refuelNoise.start();
    cargoNoise.start();
    repairNoise.start();
    repairGateOsc.start();

    started = true;
    return true;
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (!context) {
      return;
    }

    if (enabled) {
      context.resume().catch(() => {});
    } else {
      if (engineGain) {
        engineGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (engineMidGain) {
        engineMidGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (engineRumbleGain) {
        engineRumbleGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (rotationGain) {
        rotationGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (rotationToneGain) {
        rotationToneGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (ambientGain) {
        ambientGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (ambientToneGain) {
        ambientToneGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (refuelGain) {
        refuelGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (cargoGain) {
        cargoGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (repairGain) {
        repairGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (repairGate) {
        repairGate.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (repairGateGain) {
        repairGateGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
      if (repairGateOffset) {
        repairGateOffset.offset.setTargetAtTime(0, context.currentTime, 0.05);
      }
      context.suspend().catch(() => {});
    }
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
    repair = null,
    fuelAlarm = null,
  } = {}) {
    if (!started || !context || !enabled) {
      return;
    }

    const now = context.currentTime;
    const delta = lastUpdateTime ? Math.max(0, now - lastUpdateTime) : 0;
    lastUpdateTime = now;
    const throttleValue = clamp(throttle, 0, 1);
    const rotationValue = clamp(Math.abs(rotation), 0, 1);

    const engineLevel = Math.pow(throttleValue, 1.4);
    const mainScale = 0.5;
    engineGain.gain.setTargetAtTime(engineLevel * 0.68 * mainScale, now, 0.05);
    engineFilter.frequency.setTargetAtTime(300 + engineLevel * 1500, now, 0.05);
    engineMidGain.gain.setTargetAtTime(engineLevel * 0.035 * mainScale, now, 0.05);
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
    updateRepairSound(repair, now);
    updateFuelAlarm(fuelAlarm, now);

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

  function updateFuelAlarm(fuelAlarm, now) {
    if (!context || !sfxGain) {
      return;
    }

    const active = Boolean(fuelAlarm && fuelAlarm.active);
    if (!active) {
      nextFuelAlarmTime = 0;
      return;
    }

    if (nextFuelAlarmTime === 0) {
      nextFuelAlarmTime = now;
    }

    const interval =
      fuelAlarm && typeof fuelAlarm.interval === "number" ? fuelAlarm.interval : 0.9;
    if (now >= nextFuelAlarmTime) {
      playFuelAlarmBeep(now);
      nextFuelAlarmTime = now + interval;
    }
  }

  function playFuelAlarmBeep(now) {
    if (!context || !sfxGain) {
      return;
    }

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "square";
    osc.frequency.value = 900;
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(sfxGain);

    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.28);
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

  function playCargoClick() {
    if (!context || !sfxGain) {
      return;
    }

    const noise = createOneShotNoise(context, 0.04);
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    const gain = context.createGain();
    gain.gain.value = 0.001;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    const now = context.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    noise.start(now);
    noise.stop(now + 0.09);
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

  function updateRepairSound(repair, now) {
    if (!repairGain || !repairFilter) {
      return;
    }

    const active = Boolean(repair && repair.active);
    const intensity = clamp(
      repair && typeof repair.intensity === "number" ? repair.intensity : 0.4,
      0,
      1
    );
    const wobble = Math.sin(now * 22) * 0.08 + Math.sin(now * 37) * 0.05;
    const freq = Math.max(500, 900 + intensity * 800 + wobble * 400);
    const gainTarget = active ? 0.18 + intensity * 0.16 : 0;
    repairGain.gain.setTargetAtTime(gainTarget, now, 0.06);
    repairFilter.frequency.setTargetAtTime(freq, now, 0.06);

    if (repairGateGain) {
      repairGateGain.gain.setTargetAtTime(0, now, 0.02);
    }
    if (repairGateOffset) {
      repairGateOffset.offset.setTargetAtTime(0, now, 0.02);
    }
    if (!repairGate) {
      return;
    }
    if (!active) {
      repairGate.gain.setTargetAtTime(0, now, 0.03);
      nextRepairTickTime = 0;
      nextRepairBurstTime = 0;
      repairBurstRemaining = 0;
      return;
    }

    const burstInterval = 0.08;
    const pauseInterval = 0.45;
    const ticksPerBurst = Math.round(lerp(10, 14, intensity));
    if (repairBurstRemaining === 0 && now >= nextRepairBurstTime) {
      repairBurstRemaining = ticksPerBurst;
    }
    if (!nextRepairTickTime || now >= nextRepairTickTime) {
      const start = now + 0.001;
      const peak = clamp(1.1 + intensity * 0.25, 0.7, 1.4);
      repairGate.gain.cancelScheduledValues(start);
      repairGate.gain.setValueAtTime(0.0001, start);
      repairGate.gain.exponentialRampToValueAtTime(peak, start + 0.002);
      repairGate.gain.exponentialRampToValueAtTime(0.001, start + 0.03);
      repairBurstRemaining = Math.max(0, repairBurstRemaining - 1);
      if (repairBurstRemaining > 0) {
        nextRepairTickTime = start + burstInterval;
      } else {
        nextRepairTickTime = start + pauseInterval;
        nextRepairBurstTime = start + pauseInterval;
      }
    }
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
    const gainScale = cooling.gain * (0.6 + tempFactor * 0.9) * 0.4;
    playCoolingTick(intensity, tempFactor, gainScale);

    const minDelay = Math.min(cooling.minDelay, cooling.maxDelay);
    const maxDelay = Math.max(cooling.minDelay, cooling.maxDelay);
    const interval = lerp(maxDelay, minDelay, Math.max(heatFactor, tempFactor));
    const jitter = interval * (0.05 + Math.random() * 1.8);
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

    const now = context.currentTime;
    const osc = context.createOscillator();
    const osc2 = context.createOscillator();
    const gain = context.createGain();
    const gain2 = context.createGain();
    osc.type = "sine";
    osc2.type = "sine";
    // Fixed pitch to avoid any perceived sweep.
    const tone = 620 * 1.3;
    osc.frequency.setValueAtTime(tone, now);
    osc2.frequency.setValueAtTime(tone * 1.7, now);
    gain.gain.value = 0.0001;
    gain2.gain.value = 0.0001;
    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(sfxGain);
    gain2.connect(sfxGain);

    const peak = (0.22 + heatFactor * 0.18) * gainScale;
    const tail = 0.6;
    const tailHigh = tail * 1.2;
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(peak * 0.2, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tail);
    gain2.gain.exponentialRampToValueAtTime(peak * 0.6, now + 0.003);
    gain2.gain.exponentialRampToValueAtTime(peak * 0.12, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + tailHigh);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + tail + 0.02);
    osc2.stop(now + tailHigh + 0.02);
  }

  return {
    start,
    setEnabled,
    setMasterVolume,
    setSfxVolume,
    update,
    playRefuelDing,
    playRefuelClick,
    playCargoClick,
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
