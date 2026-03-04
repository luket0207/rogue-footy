/**
 * makeDecision (weighted random choice)
 *
 * Takes an object of weights and returns a key selected with probability
 * proportional to its weight.
 *
 * Example:
 * const result = makeDecision({ a: 20, b: 80 });
 * // a = 20%, b = 80%
 *
 * Notes:
 * - Weights can be any non-negative numbers (integers or floats).
 * - Zero means "never pick".
 * - Negative, NaN, or non-finite values are rejected.
 *
 * Usage:
 * import { makeDecision, normalizeWeights } from "@/engine/utils/makeDecision/makeDecision";
 *
 * const winnerKey = makeDecision({ sword: 20, shield: 80 });
 */

export const normalizeWeights = (weightsObj) => {
  if (weightsObj == null || typeof weightsObj !== "object" || Array.isArray(weightsObj)) {
    throw new Error("normalizeWeights: weights must be an object of { key: number }");
  }

  const entries = Object.entries(weightsObj);

  if (entries.length < 2) {
    throw new Error("normalizeWeights: provide at least 2 options");
  }

  const cleaned = entries.map(([key, value]) => {
    const num = Number(value);

    if (!Number.isFinite(num)) {
      throw new Error(`normalizeWeights: weight for "${key}" must be a finite number`);
    }
    if (num < 0) {
      throw new Error(`normalizeWeights: weight for "${key}" must be >= 0`);
    }

    return [key, num];
  });

  const total = cleaned.reduce((sum, [, w]) => sum + w, 0);

  if (total <= 0) {
    throw new Error("normalizeWeights: total weight must be > 0");
  }

  // Returns [{ key, weight, probability }]
  return cleaned.map(([key, weight]) => ({
    key,
    weight,
    probability: weight / total,
  }));
};

export const makeDecision = (weightsObj, rng = Math.random) => {
  if (typeof rng !== "function") {
    throw new Error("makeDecision: rng must be a function returning a float in [0, 1)");
  }

  const normalized = normalizeWeights(weightsObj);

  // Weighted roulette selection
  const totalWeight = normalized.reduce((sum, x) => sum + x.weight, 0);
  const roll = rng() * totalWeight;

  let cumulative = 0;
  for (let i = 0; i < normalized.length; i++) {
    cumulative += normalized[i].weight;
    if (roll < cumulative) {
      return normalized[i].key;
    }
  }

  // Fallback (handles float precision edge cases)
  return normalized[normalized.length - 1].key;
};
