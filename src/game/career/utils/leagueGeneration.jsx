import { createSeededRng } from "../../../features/matchSim/utils/seededRng";

export const PLAYER_TEAM_SLOT = "PLAYER_TEAM";

export const LEAGUE_TIER_DISTRIBUTION = Object.freeze({
  1: Object.freeze([1, 1, 1, 1, 2, 2, 3, 3]),
  2: Object.freeze([1, 1, 2, 2, 2, 2, 3, 3]),
  3: Object.freeze([2, 2, 3, 3, 3, 3, 4, 4]),
  4: Object.freeze([3, 3, 4, 4, 4, 4, 5, 5]),
  5: Object.freeze([4, 4, 5, 5, 5, 5, 6, 6]),
  6: Object.freeze([5, 5, 6, 6, 6, 6, 7, 7]),
  7: Object.freeze([6, 6, 7, 7, 7, 7, 8, 8]),
  8: Object.freeze([7, 7, 8, 8, 8, 8, 9, 9]),
  9: Object.freeze([8, 8, 9, 9, 9, 9, 10, 10]),
  10: Object.freeze([PLAYER_TEAM_SLOT, 8, 9, 9, 10, 10, 10, 10]),
});

const TEAM_COUNT_PER_LEAGUE = 8;
const TOTAL_LEAGUES = 10;

const createTierCountMap = () =>
  Array.from({ length: TOTAL_LEAGUES }, (_, index) => index + 1).reduce((result, tier) => {
    result[tier] = 0;
    return result;
  }, {});

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

export const getRequiredAiBaseTierCounts = () => {
  const counts = createTierCountMap();

  Object.values(LEAGUE_TIER_DISTRIBUTION).forEach((slots) => {
    slots.forEach((slot) => {
      if (typeof slot === "number") {
        counts[slot] += 1;
      }
    });
  });

  return counts;
};

const buildAiTierPools = (aiTeams, rng) => {
  const pools = createTierCountMap();
  aiTeams.forEach((team) => {
    if (!pools[team.baseTier]) {
      pools[team.baseTier] = [];
    }
    pools[team.baseTier].push(team.id);
  });

  Object.keys(pools).forEach((tierKey) => {
    pools[tierKey] = shuffleWithRng(pools[tierKey], rng);
  });

  return pools;
};

const popTeamIdForBaseTier = (baseTier, pools) => {
  const tierPool = pools[baseTier];
  if (Array.isArray(tierPool) && tierPool.length > 0) {
    return tierPool.pop();
  }

  // Safety fallback for legacy saves that may not match the current tier count model.
  for (let distance = 1; distance <= TOTAL_LEAGUES; distance += 1) {
    const lowerTier = baseTier - distance;
    const upperTier = baseTier + distance;
    if (lowerTier >= 1 && Array.isArray(pools[lowerTier]) && pools[lowerTier].length > 0) {
      return pools[lowerTier].pop();
    }
    if (upperTier <= TOTAL_LEAGUES && Array.isArray(pools[upperTier]) && pools[upperTier].length > 0) {
      return pools[upperTier].pop();
    }
  }

  return "";
};

export const createCareerLeagues = ({ aiTeams = [], playerTeam, seed = "career-leagues-seed" } = {}) => {
  const rng = createSeededRng(seed);
  const pools = buildAiTierPools(aiTeams, rng);
  const playerTeamId = playerTeam?.id || "";
  const leagues = [];

  for (let tier = 1; tier <= TOTAL_LEAGUES; tier += 1) {
    const slots = LEAGUE_TIER_DISTRIBUTION[tier] || [];
    const teamIds = slots
      .map((slot) => {
        if (slot === PLAYER_TEAM_SLOT) return playerTeamId;
        return popTeamIdForBaseTier(slot, pools);
      })
      .filter(Boolean)
      .slice(0, TEAM_COUNT_PER_LEAGUE);

    leagues.push({
      id: `league_tier_${tier}`,
      tier,
      name: `Tier ${tier}`,
      teamIds,
      slotPattern: [...slots],
    });
  }

  return leagues;
};
