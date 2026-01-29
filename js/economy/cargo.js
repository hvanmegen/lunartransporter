// Cargo system with dedicated slots and mass/value accounting.
export function createCargoHold({ slotCount = 3, maxMass = Infinity } = {}) {
  const slots = new Array(slotCount).fill(null);
  const capacity = Number.isFinite(maxMass) ? Math.max(0, maxMass) : Infinity;

  function createCargo({ id, name, mass, value }) {
    if (!id || !name || typeof mass !== "number" || typeof value !== "number") {
      throw new Error("Cargo requires id, name, mass, and value.");
    }

    return { id, name, mass, value };
  }

  function addCargo(cargo) {
    if (cargo && typeof cargo.mass === "number" && getTotalMass() + cargo.mass > capacity) {
      return false;
    }

    const index = slots.findIndex((slot) => slot === null);
    if (index === -1) {
      return false;
    }

    slots[index] = cargo;
    return true;
  }

  function removeCargo(index) {
    if (index < 0 || index >= slots.length) {
      return null;
    }

    const cargo = slots[index];
    slots[index] = null;
    return cargo;
  }

  function clear() {
    slots.fill(null);
  }

  function getSlots() {
    return slots.map((cargo) => (cargo ? { ...cargo } : null));
  }

  function getTotalMass() {
    return slots.reduce((total, cargo) => total + (cargo ? cargo.mass : 0), 0);
  }

  function getTotalValue() {
    return slots.reduce((total, cargo) => total + (cargo ? cargo.value : 0), 0);
  }

  function getMaxMass() {
    return capacity;
  }

  function addBulkCargo({ id, name, mass, valuePerKg = 0 }) {
    if (!id || !name || typeof mass !== "number" || mass <= 0) {
      return 0;
    }

    const available = Math.max(0, capacity - getTotalMass());
    const amount = Math.min(mass, available);
    if (amount <= 0) {
      return 0;
    }

    const existingIndex = slots.findIndex((slot) => slot && slot.id === id);
    if (existingIndex !== -1) {
      slots[existingIndex].mass += amount;
      slots[existingIndex].valuePerKg = valuePerKg;
      slots[existingIndex].value = slots[existingIndex].mass * valuePerKg;
      return amount;
    }

    const index = slots.findIndex((slot) => slot === null);
    if (index === -1) {
      return 0;
    }

    slots[index] = { id, name, mass: amount, value: amount * valuePerKg, valuePerKg };
    return amount;
  }

  function removeBulkCargo({ id, mass }) {
    if (!id || typeof mass !== "number" || mass <= 0) {
      return 0;
    }

    const index = slots.findIndex((slot) => slot && slot.id === id);
    if (index === -1) {
      return 0;
    }

    const cargo = slots[index];
    const amount = Math.min(mass, cargo.mass);
    cargo.mass -= amount;
    const valuePerKg = typeof cargo.valuePerKg === "number" ? cargo.valuePerKg : 0;
    cargo.value = cargo.mass * valuePerKg;
    if (cargo.mass <= 0.001) {
      slots[index] = null;
    }

    return amount;
  }

  return {
    createCargo,
    addCargo,
    removeCargo,
    clear,
    getSlots,
    getTotalMass,
    getTotalValue,
    getMaxMass,
    addBulkCargo,
    removeBulkCargo,
  };
}
