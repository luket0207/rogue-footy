const hashSeed = (seedInput) => {
  const seedText = String(seedInput ?? "match-seed");
  let hash = 2166136261;

  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const createSeededRng = (seedInput) => {
  const initialSeed = hashSeed(seedInput);
  let state = initialSeed || 1;

  const random = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const randomFloat = (min = 0, max = 1) => random() * (max - min) + min;

  const randomInt = (min, max) => Math.floor(randomFloat(min, max + 1));

  return {
    seed: initialSeed,
    random,
    randomFloat,
    randomInt,
  };
};

