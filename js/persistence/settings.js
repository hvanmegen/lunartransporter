// Local storage persistence for settings only.
const STORAGE_KEY = "lunartrucker.settings.v1";

const DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 60,
  sfxVolume: 80,
  musicVolume: 30,
  cameraZoomSensitivity: 1,
  inputMode: "auto",
  difficulty: "easy",
  unitSystem: "metric",
});

export function getDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}

export function loadSettings() {
  if (!isStorageAvailable()) {
    return { ok: false, error: "localStorage unavailable" };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ok: false, error: "no settings found" };
    }

    const parsed = JSON.parse(raw);
    return { ok: true, data: normalizeSettings(parsed) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function saveSettings(settings) {
  if (!isStorageAvailable()) {
    return { ok: false, error: "localStorage unavailable" };
  }

  try {
    const payload = JSON.stringify(normalizeSettings(settings));
    localStorage.setItem(STORAGE_KEY, payload);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function normalizeSettings(settings) {
  const base = getDefaultSettings();
  if (!settings || typeof settings !== "object") {
    return base;
  }

  return {
    masterVolume: normalizePercent(settings.masterVolume ?? base.masterVolume),
    sfxVolume: normalizePercent(settings.sfxVolume ?? base.sfxVolume),
    musicVolume: normalizePercent(settings.musicVolume ?? base.musicVolume),
    cameraZoomSensitivity: clamp(settings.cameraZoomSensitivity ?? base.cameraZoomSensitivity, 0.5, 2),
    inputMode: normalizeInputMode(settings.inputMode ?? base.inputMode),
    difficulty: normalizeDifficulty(settings.difficulty ?? base.difficulty),
    unitSystem: normalizeUnitSystem(settings.unitSystem ?? base.unitSystem),
  };
}

function normalizeInputMode(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "keyboard" || normalized === "gamepad") {
    return normalized;
  }

  return "auto";
}

function normalizeDifficulty(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "hard") {
    return "hard";
  }

  return "easy";
}

function normalizeUnitSystem(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "imperial" || normalized === "scientific") {
    return normalized;
  }
  if (normalized === "imperical") {
    return "imperial";
  }

  return "metric";
}

function clamp(value, min, max) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function normalizePercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  const scaled = value <= 1 ? value * 100 : value;
  return clamp(Math.round(scaled), 0, 100);
}

function isStorageAvailable() {
  try {
    const testKey = "__settings_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch (_error) {
    return false;
  }
}
