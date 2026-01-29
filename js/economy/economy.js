import { STATES } from "../core/constants.js";

// Economy system for money, deliveries, crashes, and repairs.
export function createEconomy({
  startingMoney = 5000,
  stateMachine = null,
} = {}) {
  let money = startingMoney;

  function addMoney(amount) {
    money += amount;
    enforceGameOver();
  }

  function spendMoney(amount) {
    money -= amount;
    enforceGameOver();
  }

  function deliverCargo(cargoHold) {
    if (!cargoHold) {
      return 0;
    }

    const payout = cargoHold.getTotalValue();
    cargoHold.clear();
    addMoney(payout);
    return payout;
  }

  function crashCargo(cargoHold) {
    if (!cargoHold) {
      return 0;
    }

    const lostValue = cargoHold.getTotalValue();
    cargoHold.clear();
    return lostValue;
  }

  function applyRepairCost(cost) {
    if (cost <= 0) {
      return 0;
    }

    spendMoney(cost);
    return cost;
  }

  function getMoney() {
    return money;
  }

  function enforceGameOver() {
    if (money <= 0 && stateMachine) {
      stateMachine.setState(STATES.GAME_OVER);
    }
  }

  return {
    addMoney,
    spendMoney,
    deliverCargo,
    crashCargo,
    applyRepairCost,
    getMoney,
  };
}
