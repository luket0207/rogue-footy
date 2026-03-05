import { createSeededRng } from "../../../features/matchSim/utils/seededRng";

export const LEAGUE_TIER_STRENGTH_RANGES = Object.freeze({
  1: Object.freeze({ min: 88, max: 93 }),
  2: Object.freeze({ min: 86, max: 91 }),
  3: Object.freeze({ min: 84, max: 89 }),
  4: Object.freeze({ min: 82, max: 87 }),
  5: Object.freeze({ min: 80, max: 85 }),
  6: Object.freeze({ min: 78, max: 83 }),
  7: Object.freeze({ min: 76, max: 81 }),
  8: Object.freeze({ min: 74, max: 79 }),
  9: Object.freeze({ min: 72, max: 77 }),
  10: Object.freeze({ min: 70, max: 75 }),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const shuffleWithRng = (items, rng) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.randomInt(0, index);
    const temp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = temp;
  }
  return next;
};

const getRangeForTier = (tier) =>
  LEAGUE_TIER_STRENGTH_RANGES[Number(tier)] || LEAGUE_TIER_STRENGTH_RANGES[10];

const splitRangeByBands = ({ min, max }) => {
  const safeMin = Number(min) || 70;
  const safeMax = Number(max) || safeMin;
  const span = Math.max(1, safeMax - safeMin + 1);
  const bandOffset = Math.max(1, Math.floor((span - 1) / 3));

  const low = {
    min: safeMin,
    max: clamp(safeMin + bandOffset, safeMin, safeMax),
  };
  const top = {
    min: clamp(safeMax - bandOffset, safeMin, safeMax),
    max: safeMax,
  };
  const mid = {
    min: clamp(low.max + 1, safeMin, safeMax),
    max: clamp(top.min - 1, safeMin, safeMax),
  };

  if (mid.min > mid.max) {
    return {
      low,
      mid: { min: safeMin, max: safeMax },
      top,
    };
  }

  return { low, mid, top };
};

const rollFromRange = (range, rng) => {
  const min = Number(range?.min) || 70;
  const max = Number(range?.max) || min;
  return rng.randomInt(Math.min(min, max), Math.max(min, max));
};

export const applyLeagueStrengthDistribution = ({
  playerTeam = null,
  aiTeams = [],
  leagues = [],
  seed = "career-strength-distribution",
} = {}) => {
  const playerTeamId = playerTeam?.id || "";
  const aiById = (Array.isArray(aiTeams) ? aiTeams : []).reduce((result, team) => {
    if (team?.id) {
      result[team.id] = { ...team };
    }
    return result;
  }, {});

  (Array.isArray(leagues) ? leagues : []).forEach((league) => {
    const teamIds = Array.isArray(league?.teamIds) ? league.teamIds : [];
    const containsPlayer = playerTeamId ? teamIds.includes(playerTeamId) : false;
    const aiTeamIds = teamIds.filter((teamId) => teamId && teamId !== playerTeamId && aiById[teamId]);
    if (aiTeamIds.length === 0) return;

    const tierRange = getRangeForTier(league?.tier);
    const bands = splitRangeByBands(tierRange);
    const rng = createSeededRng(`${seed}:${league?.id || "league"}:${league?.tier || 0}`);
    const shuffledIds = shuffleWithRng(aiTeamIds, rng);

    const topCount = Math.min(2, shuffledIds.length);
    const lowCount = Math.min(2, Math.max(0, shuffledIds.length - topCount));
    const desiredMid = containsPlayer ? 3 : 4;
    const midCount = Math.min(
      desiredMid,
      Math.max(0, shuffledIds.length - topCount - lowCount)
    );
    const unallocatedCount = Math.max(0, shuffledIds.length - topCount - midCount - lowCount);
    const finalMidCount = midCount + unallocatedCount;

    const topIds = shuffledIds.slice(0, topCount);
    const midIds = shuffledIds.slice(topCount, topCount + finalMidCount);
    const lowIds = shuffledIds.slice(topCount + finalMidCount);

    topIds.forEach((teamId) => {
      aiById[teamId].teamStrength = rollFromRange(bands.top, rng);
    });
    midIds.forEach((teamId) => {
      aiById[teamId].teamStrength = rollFromRange(bands.mid, rng);
    });
    lowIds.forEach((teamId) => {
      aiById[teamId].teamStrength = rollFromRange(bands.low, rng);
    });
  });

  return {
    playerTeam,
    aiTeams: (Array.isArray(aiTeams) ? aiTeams : []).map((team) => aiById[team.id] || team),
  };
};
