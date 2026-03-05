import playerIdentityPools from "../../../assets/gameContent/players";
import { clamp } from "./math";
import { createSeededRng } from "./seededRng";
import { POSITION } from "./matchSimTypes";

const BASE_OVERALL_LEVELS = Object.freeze([62, 65, 68, 71, 74, 77, 80, 83, 86, 89]);

const POSITION_OVERALL_WEIGHTS = Object.freeze({
  [POSITION.GK]: Object.freeze({
    goalkeeping: 0.74,
    passing: 0.08,
    control: 0.08,
    workRate: 0.05,
    defending: 0.05,
  }),
  [POSITION.DEF]: Object.freeze({
    defending: 0.43,
    workRate: 0.16,
    passing: 0.14,
    control: 0.1,
    offBall: 0.1,
    finishing: 0.05,
    goalkeeping: 0.02,
  }),
  [POSITION.MID]: Object.freeze({
    passing: 0.26,
    control: 0.24,
    offBall: 0.16,
    workRate: 0.12,
    defending: 0.1,
    finishing: 0.1,
    goalkeeping: 0.02,
  }),
  [POSITION.FWR]: Object.freeze({
    finishing: 0.45,
    offBall: 0.2,
    control: 0.14,
    passing: 0.1,
    workRate: 0.07,
    defending: 0.03,
    goalkeeping: 0.01,
  }),
});

const PRIMARY_ATTRIBUTE_BY_POSITION = Object.freeze({
  [POSITION.GK]: "goalkeeping",
  [POSITION.DEF]: "defending",
  [POSITION.MID]: "passing",
  [POSITION.FWR]: "finishing",
});

const sanitizeForId = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const toSkill = (value) => Math.round(clamp(value, 0, 100));

export const computePlayerOverall = (player, preferredPos = player.preferredPos) => {
  const weights = POSITION_OVERALL_WEIGHTS[preferredPos] || POSITION_OVERALL_WEIGHTS[POSITION.MID];
  const weighted = Object.entries(weights).reduce((sum, [skillKey, weight]) => sum + player[skillKey] * weight, 0);
  return Math.round(clamp(weighted, 1, 99));
};

const pickNationality = (rng) => {
  const pools = playerIdentityPools.nationalities;
  return pools[Math.floor(rng.random() * pools.length)];
};

const pickUniqueName = (nationalityPool, usedNames, rng) => {
  const firstNames = nationalityPool.firstNames;
  const lastNames = nationalityPool.lastNames;
  let first = firstNames[Math.floor(rng.random() * firstNames.length)];
  let last = lastNames[Math.floor(rng.random() * lastNames.length)];
  let fullName = `${first} ${last}`;

  let attempts = 0;
  while (usedNames.has(fullName) && attempts < 24) {
    first = firstNames[Math.floor(rng.random() * firstNames.length)];
    last = lastNames[Math.floor(rng.random() * lastNames.length)];
    fullName = `${first} ${last}`;
    attempts += 1;
  }

  if (usedNames.has(fullName)) {
    fullName = `${fullName} ${attempts + 1}`;
  }

  usedNames.add(fullName);
  const [resolvedFirstName, ...rest] = fullName.split(" ");
  return {
    firstName: resolvedFirstName,
    lastName: rest.join(" "),
    name: fullName,
  };
};

const rollAppearance = (rng) => {
  const { min, max } = playerIdentityPools.appearanceRange;
  return [rng.randomInt(min, max), rng.randomInt(min, max), rng.randomInt(min, max)];
};

const rollAge = (rng) => {
  const { min, max } = playerIdentityPools.age;
  return rng.randomInt(min, max);
};

const rollNoise = (rng, min, max) => rng.randomFloat(min, max);

const createSkillsByRole = (preferredPos, targetOverall, rng) => {
  if (preferredPos === POSITION.GK) {
    return {
      finishing: toSkill(targetOverall - 36 + rollNoise(rng, -4, 3)),
      passing: toSkill(targetOverall - 10 + rollNoise(rng, -4, 4)),
      control: toSkill(targetOverall - 11 + rollNoise(rng, -4, 4)),
      defending: toSkill(targetOverall - 21 + rollNoise(rng, -5, 3)),
      offBall: toSkill(targetOverall - 24 + rollNoise(rng, -5, 3)),
      workRate: toSkill(targetOverall - 9 + rollNoise(rng, -4, 4)),
      goalkeeping: toSkill(targetOverall + 10 + rollNoise(rng, -2, 3)),
    };
  }

  if (preferredPos === POSITION.DEF) {
    return {
      finishing: toSkill(targetOverall - 14 + rollNoise(rng, -4, 4)),
      passing: toSkill(targetOverall + 2 + rollNoise(rng, -4, 4)),
      control: toSkill(targetOverall + 1 + rollNoise(rng, -4, 4)),
      defending: toSkill(targetOverall + 10 + rollNoise(rng, -2, 3)),
      offBall: toSkill(targetOverall + rollNoise(rng, -4, 4)),
      workRate: toSkill(targetOverall + 5 + rollNoise(rng, -3, 4)),
      goalkeeping: toSkill(3 + rollNoise(rng, 0, 5)),
    };
  }

  if (preferredPos === POSITION.FWR) {
    return {
      finishing: toSkill(targetOverall + 10 + rollNoise(rng, -2, 3)),
      passing: toSkill(targetOverall - 1 + rollNoise(rng, -4, 4)),
      control: toSkill(targetOverall + 3 + rollNoise(rng, -4, 4)),
      defending: toSkill(targetOverall - 14 + rollNoise(rng, -5, 3)),
      offBall: toSkill(targetOverall + 7 + rollNoise(rng, -3, 4)),
      workRate: toSkill(targetOverall - 2 + rollNoise(rng, -4, 4)),
      goalkeeping: toSkill(2 + rollNoise(rng, 0, 4)),
    };
  }

  // MID
  return {
    finishing: toSkill(targetOverall + rollNoise(rng, -4, 4)),
    passing: toSkill(targetOverall + 9 + rollNoise(rng, -2, 3)),
    control: toSkill(targetOverall + 8 + rollNoise(rng, -2, 3)),
    defending: toSkill(targetOverall - 2 + rollNoise(rng, -4, 4)),
    offBall: toSkill(targetOverall + 4 + rollNoise(rng, -4, 4)),
    workRate: toSkill(targetOverall + 2 + rollNoise(rng, -4, 4)),
    goalkeeping: toSkill(2 + rollNoise(rng, 0, 4)),
  };
};

const enforceDistinctLevel = (player, preferredPos, minimumOverallForLevel) => {
  const nextPlayer = { ...player };
  const primarySkill = PRIMARY_ATTRIBUTE_BY_POSITION[preferredPos];
  let overall = computePlayerOverall(nextPlayer, preferredPos);
  let guard = 0;

  while (overall < minimumOverallForLevel && guard < 30) {
    nextPlayer[primarySkill] = clamp(nextPlayer[primarySkill] + 1, 0, 100);
    overall = computePlayerOverall(nextPlayer, preferredPos);
    guard += 1;
  }

  nextPlayer.overall = overall;
  return nextPlayer;
};

const createPlayer = ({ preferredPos, levelIndex, rng, usedNames }) => {
  const nationalityPool = pickNationality(rng);
  const nameData = pickUniqueName(nationalityPool, usedNames, rng);
  const targetOverall =
    BASE_OVERALL_LEVELS[levelIndex] ?? (BASE_OVERALL_LEVELS[BASE_OVERALL_LEVELS.length - 1] + (levelIndex - (BASE_OVERALL_LEVELS.length - 1)) * 2);
  const skills = createSkillsByRole(preferredPos, targetOverall, rng);

  const rawPlayer = {
    id: `${sanitizeForId(preferredPos)}_${String(levelIndex + 1).padStart(2, "0")}_${sanitizeForId(nameData.name)}`,
    name: nameData.name,
    firstName: nameData.firstName,
    lastName: nameData.lastName,
    age: rollAge(rng),
    nationality: nationalityPool.country,
    appearance: rollAppearance(rng),
    preferredPos,
    ...skills,
  };

  return enforceDistinctLevel(rawPlayer, preferredPos, targetOverall);
};

export const createGeneratedPlayers = ({ seed = "generated-players", perPosition = 10 } = {}) => {
  const rng = createSeededRng(seed);
  const usedNames = new Set();
  const players = [];

  const positions = [POSITION.GK, POSITION.DEF, POSITION.MID, POSITION.FWR];
  positions.forEach((preferredPos) => {
    let previousOverall = 0;
    for (let levelIndex = 0; levelIndex < perPosition; levelIndex += 1) {
      const player = createPlayer({ preferredPos, levelIndex, rng, usedNames });
      if (player.overall <= previousOverall) {
        player.overall = clamp(previousOverall + 1, 1, 99);
      }
      previousOverall = player.overall;
      players.push(player);
    }
  });

  return players;
};
