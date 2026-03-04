export const clamp = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export const clamp01 = (value) => clamp(value, 0, 1);

export const logistic = (x) => 1 / (1 + Math.exp(-x));

export const average = (values) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

export const safeDivide = (numerator, denominator, fallback = 0) => {
  if (!Number.isFinite(denominator) || denominator === 0) return fallback;
  return numerator / denominator;
};

