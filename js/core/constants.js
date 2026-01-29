import { GameState } from "./state.js";

// Core game-wide constants.
export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
export const BACKGROUND_COLOR = "#000000";

export const STATES = GameState;

// Lunar surface gravity (m/s^2).
export const EARTH_GRAVITY = 9.81;
export const LUNAR_GRAVITY = 3.24;
export const SHIP_MASS = 1200;
export const SHIP_MAX_THRUST = 40000;
export const SHIP_MAX_RETRO_THRUST = 16000;
export const SHIP_FUEL_CAPACITY = 12000;
export const SHIP_FUEL_BURN_RATE = 90;
export const SHIP_ROTATION_FUEL_BURN_RATE = 12;
export const FUEL_MASS_PER_UNIT = 1;
export const THRUST_EFFICIENCY = 4;
export const SHIP_TARGET_TOTAL_MASS = 10000;
export const SHIP_COLLISION_RADIUS = 14;
export const SHIP_ROTATION_SPEED = 3.2;
export const SHIP_MAX_ROTATION_SPEED = 4.2;
export const SHIP_ROTATION_DAMPING = 0;

export const REPAIR_COST_PER_DAMAGE = 5;

export const REFUEL_RATE = 200;
export const REFUEL_DING_INTERVAL = 200;
export const CARGO_TRANSFER_RATE = 500;
export const HE3_VALUE_PER_KG = 5;

export const LANDING_VERTICAL_SPEED_THRESHOLD = 12;
export const LANDING_LATERAL_SPEED_THRESHOLD = 8;
export const LANDING_ROTATION_SPEED_THRESHOLD = 0.6;
export const HARD_LANDING_DAMAGE = 25;
