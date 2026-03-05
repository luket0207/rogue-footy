import { applyTeamTactics } from "./tactics";
import { computeTeamProfile, playersArrayToMap } from "./ratings";
import { autoFillLineup, getLineupPlayerIds } from "./lineup";
import {
  ATTACKING_TACTIC_OPTIONS,
  DEFAULT_CHUNK_COUNT,
  DEFENSIVE_TACTIC_OPTIONS,
  FORMATION_KEYS,
} from "./matchSimTypes";
import { clamp } from "./math";
import { createSeededRng } from "./seededRng";

export const OPPOSITION_LEVEL_COUNT = 10;
export const OPPOSITION_LEVEL_OPTIONS = Object.freeze(
  Array.from({ length: OPPOSITION_LEVEL_COUNT }, (_, index) => ({
    value: index + 1,
    label: `Level ${index + 1}`,
  }))
);

const LEVEL_CURVE = Object.freeze([0, 0.03, 0.08, 0.15, 0.24, 0.36, 0.5, 0.66, 0.8, 0.92, 1]);
const VARIANT_COUNT = 9;

const buildCandidateConfigs = (poolPlayers, namePrefix) => {
  const candidates = [];
  FORMATION_KEYS.forEach((formation) => {
    ATTACKING_TACTIC_OPTIONS.forEach((attacking) => {
      DEFENSIVE_TACTIC_OPTIONS.forEach((defensive) => {
        for (let variant = 0; variant < VARIANT_COUNT; variant += 1) {
          candidates.push({
            name: `${namePrefix} ${formation} ${attacking}/${defensive} ${variant}`,
            formation,
            tactics: {
              attacking,
              defensive,
            },
            lineup: autoFillLineup(poolPlayers, formation, variant),
          });
        }
      });
    });
  });
  return candidates;
};

const getIntrinsicOverall = (teamConfig, playersById) => {
  const teamBase = computeTeamProfile(teamConfig, playersById);
  const teamRuntime = applyTeamTactics(teamBase, teamBase, teamConfig.tactics, teamConfig.tactics);
  return {
    overall: teamRuntime.overallRating,
    runtime: teamRuntime,
    base: teamBase,
  };
};

const toLevelByRange = (overall, minOverall, maxOverall) => {
  if (maxOverall - minOverall < 0.01) return 5;
  const normalized = clamp((overall - minOverall) / (maxOverall - minOverall), 0, 1);
  return clamp(Math.round(normalized * (OPPOSITION_LEVEL_COUNT - 1)) + 1, 1, OPPOSITION_LEVEL_COUNT);
};

const fromLevelToOverall = (level, minOverall, maxOverall) => {
  const safeLevel = clamp(level, 1, OPPOSITION_LEVEL_COUNT);
  const curveValue = LEVEL_CURVE[safeLevel] ?? LEVEL_CURVE[LEVEL_CURVE.length - 1];
  return minOverall + curveValue * (maxOverall - minOverall);
};

const getFallbackOpponentConfig = (players, difficultyLevel) => ({
  name: `Opposition L${difficultyLevel}`,
  formation: FORMATION_KEYS[0],
  tactics: {
    attacking: ATTACKING_TACTIC_OPTIONS[0],
    defensive: DEFENSIVE_TACTIC_OPTIONS[0],
  },
  lineup: autoFillLineup(players, FORMATION_KEYS[0], Math.max(0, difficultyLevel - 1)),
});

export const generateOppositionFromDifficulty = ({
  players,
  playerTeamConfig,
  difficultyLevel,
  seed = "opposition-seed",
}) => {
  const safeDifficulty = clamp(Number(difficultyLevel) || 1, 1, OPPOSITION_LEVEL_COUNT);
  const playersById = playersArrayToMap(players);
  const rng = createSeededRng(`${seed}-opp-level-${safeDifficulty}`);

  const playerOverall = playerTeamConfig
    ? getIntrinsicOverall(playerTeamConfig, playersById).overall
    : 0;

  // Opposition generation is difficulty-driven only; it does not target player-team strength.
  const selectedPlayerIds = playerTeamConfig?.lineup ? new Set(getLineupPlayerIds(playerTeamConfig.lineup)) : new Set();
  const remainingPlayers = players.filter((player) => !selectedPlayerIds.has(player.id));
  const candidatePool = remainingPlayers.length >= 6 ? remainingPlayers : players;
  const opponentCandidates = buildCandidateConfigs(candidatePool, "Opposition");

  if (opponentCandidates.length === 0) {
    const fallbackTeam = getFallbackOpponentConfig(candidatePool, safeDifficulty);
    return {
      teamConfig: fallbackTeam,
      diagnostics: {
        playerOverall,
        playerLevel: 0,
        targetOverall: 0,
        opponentOverall: playerOverall,
        opponentLevel: safeDifficulty,
        levelDiff: 0,
      },
    };
  }

  const intrinsicCandidates = opponentCandidates
    .map((candidate) => {
      const intrinsic = getIntrinsicOverall(candidate, playersById);
      return {
        candidate,
        opponentOverall: intrinsic.overall,
      };
    });

  const minOverall = Math.min(...intrinsicCandidates.map((entry) => entry.opponentOverall));
  const maxOverall = Math.max(...intrinsicCandidates.map((entry) => entry.opponentOverall));
  const targetOverall = fromLevelToOverall(safeDifficulty, minOverall, maxOverall);
  const playerLevel = toLevelByRange(playerOverall, minOverall, maxOverall);

  const rankedCandidates = [...intrinsicCandidates].sort(
    (a, b) => Math.abs(a.opponentOverall - targetOverall) - Math.abs(b.opponentOverall - targetOverall)
  );

  const topPool = rankedCandidates.slice(0, Math.min(8, rankedCandidates.length));
  const weightedTotal = topPool.reduce((sum, _, index) => sum + (topPool.length - index), 0);
  let roll = rng.random() * weightedTotal;
  let selectedEntry = topPool[0];
  for (let index = 0; index < topPool.length; index += 1) {
    const weight = topPool.length - index;
    roll -= weight;
    if (roll <= 0) {
      selectedEntry = topPool[index];
      break;
    }
  }

  return {
    teamConfig: {
      ...selectedEntry.candidate,
      name: `Opposition L${safeDifficulty}`,
    },
    diagnostics: {
      playerOverall,
      playerLevel,
      targetOverall,
      opponentOverall: selectedEntry.opponentOverall,
      opponentLevel: toLevelByRange(selectedEntry.opponentOverall, minOverall, maxOverall),
      levelDiff: safeDifficulty - playerLevel,
      chunkCount: DEFAULT_CHUNK_COUNT,
    },
  };
};
