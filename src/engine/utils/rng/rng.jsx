/**
 * RNG Utilities
 *
 * Usage:
 *
 * import { randomInt, randomFloat, chance } from "@/engine/utils/rng/rng";
 *
 * const roll = randomInt(1, 6);        // 1–6 inclusive
 * const speed = randomFloat(0.5, 2);  // 0.5–2 (float)
 * const isCritical = chance(0.25);    // 25% chance → true/false
 */

/**
 * Returns a random integer between min and max (inclusive).
 */
export const randomInt = (min, max) => {
  if (min > max) {
    throw new Error("randomInt: min cannot be greater than max");
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Returns a random float between min and max.
 */
export const randomFloat = (min, max) => {
  if (min > max) {
    throw new Error("randomFloat: min cannot be greater than max");
  }

  return Math.random() * (max - min) + min;
};

/**
 * Returns true with the given probability (0–1).
 */
export const chance = (probability) => {
  if (probability < 0 || probability > 1) {
    throw new Error("chance: probability must be between 0 and 1");
  }

  return Math.random() < probability;
};
