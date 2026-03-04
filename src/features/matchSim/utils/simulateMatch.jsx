import { makeDecision } from "../../../engine/utils/makeDecision/makeDecision";
import { clamp, logistic } from "./math";
import { createSeededRng } from "./seededRng";
import { applyTeamTactics } from "./tactics";
import { applyPositionFit, computeTeamProfile, playersArrayToMap } from "./ratings";
import { POSITION, TEAM_KEY } from "./matchSimTypes";

// 6-a-side tuning: fewer players, more space, and faster transitions should
// produce more chances and slightly better conversion than 11-a-side baselines.
const SIX_A_SIDE_TUNING = Object.freeze({
  // Futsal/small-sided profile:
  // - Frequent high-quality transitions
  // - More shots and more conversion than 11-a-side
  chanceBase: 0.34,
  chanceSpreadDivisor: 105,
  chanceMin: 0.18,
  chanceMax: 0.9,
  tempoDivisor: 170,
  tempoMin: 0.8,
  tempoMax: 1.35,
  xgBase: 0.3,
  xgSpreadDivisor: 130,
  xgNoiseMin: -0.07,
  xgNoiseMax: 0.09,
  xgMin: 0.16,
  xgMax: 0.82,
  gkResistanceFactor: 0.72,
  conversionFloor: 0.34,
  conversionScale: 0.98,
  transitionBonusScale: 0.08,
  goalProbMin: 0.05,
  goalProbMax: 0.9,
});

const createTeamStats = () => ({
  possessionChunks: 0,
  shots: 0,
  totalXg: 0,
  goals: 0,
});

const createInitialStats = () => ({
  [TEAM_KEY.A]: createTeamStats(),
  [TEAM_KEY.B]: createTeamStats(),
});

const MATCH_MINUTES = 60;
const HALF_TIME_MINUTE = 30;

const getMinuteFromChunk = (chunk, chunkCount) =>
  clamp(Math.round((chunk / chunkCount) * MATCH_MINUTES), 1, MATCH_MINUTES);

const getHalfFromMinute = (minute) => (minute <= HALF_TIME_MINUTE ? 1 : 2);

const nextTeamKey = (teamKey) => (teamKey === TEAM_KEY.A ? TEAM_KEY.B : TEAM_KEY.A);

const pickWithProbability = (probability, rng) => {
  const clamped = clamp(probability, 0, 1);
  return makeDecision({ yes: clamped, no: 1 - clamped }, rng) === "yes";
};

const pickPossessionTeam = (chanceA, rng) =>
  makeDecision(
    {
      [TEAM_KEY.A]: clamp(chanceA, 0, 1),
      [TEAM_KEY.B]: clamp(1 - chanceA, 0, 1),
    },
    rng
  );

const SCORER_ROLE_WEIGHTS = Object.freeze({
  [POSITION.FWR]: Object.freeze({
    finishing: 0.55,
    offBall: 0.22,
    control: 0.12,
    passing: 0.06,
    workRate: 0.05,
  }),
  [POSITION.MID]: Object.freeze({
    finishing: 0.36,
    offBall: 0.2,
    control: 0.18,
    passing: 0.14,
    workRate: 0.12,
  }),
  [POSITION.DEF]: Object.freeze({
    finishing: 0.24,
    offBall: 0.16,
    control: 0.18,
    passing: 0.22,
    workRate: 0.2,
  }),
  [POSITION.GK]: Object.freeze({
    finishing: 0.08,
    offBall: 0.08,
    control: 0.2,
    passing: 0.24,
    workRate: 0.2,
    goalkeeping: 0.2,
  }),
});

const getScorerWeight = (player, assignedRole) => {
  const roleWeights = SCORER_ROLE_WEIGHTS[assignedRole];
  const fit = applyPositionFit(player.preferredPos, assignedRole);

  const rawWeight =
    Object.entries(roleWeights).reduce((score, [attribute, weight]) => {
      return score + player[attribute] * weight;
    }, 0) * fit;

  return clamp(rawWeight, 1, 200);
};

const buildScorerWeights = (teamProfile, playersById) => {
  const entries = [];
  const { lineup } = teamProfile;

  if (lineup.gkId && playersById[lineup.gkId]) {
    entries.push({
      playerId: lineup.gkId,
      role: POSITION.GK,
      player: playersById[lineup.gkId],
    });
  }

  [POSITION.DEF, POSITION.MID, POSITION.FWR].forEach((role) => {
    lineup[role].forEach((playerId) => {
      if (playerId && playersById[playerId]) {
        entries.push({
          playerId,
          role,
          player: playersById[playerId],
        });
      }
    });
  });

  return entries.reduce((weights, entry) => {
    weights[entry.playerId] = getScorerWeight(entry.player, entry.role);
    return weights;
  }, {});
};

export const createMatchContext = ({ seed, chunkCount, players, teamA, teamB }) => {
  const playersById = playersArrayToMap(players);

  const baseA = computeTeamProfile(teamA, playersById);
  const baseB = computeTeamProfile(teamB, playersById);

  const runtimeA = applyTeamTactics(baseA, baseB, teamA.tactics);
  const runtimeB = applyTeamTactics(baseB, baseA, teamB.tactics);

  return {
    seed: String(seed || "match-seed"),
    chunkCount,
    rng: createSeededRng(seed),
    playersById,
    teams: {
      [TEAM_KEY.A]: runtimeA,
      [TEAM_KEY.B]: runtimeB,
    },
    scorerWeights: {
      [TEAM_KEY.A]: buildScorerWeights(runtimeA, playersById),
      [TEAM_KEY.B]: buildScorerWeights(runtimeB, playersById),
    },
    setup: {
      [TEAM_KEY.A]: {
        name: teamA.name,
        formation: teamA.formation,
        tactics: teamA.tactics,
      },
      [TEAM_KEY.B]: {
        name: teamB.name,
        formation: teamB.formation,
        tactics: teamB.tactics,
      },
    },
  };
};

export const createInitialMatchState = (context, mode) => ({
  status: "ready",
  phase: "pre_kickoff",
  mode,
  seed: context.seed,
  chunk: 0,
  chunkCount: context.chunkCount,
  score: {
    [TEAM_KEY.A]: 0,
    [TEAM_KEY.B]: 0,
  },
  stats: createInitialStats(),
  log: [],
  goalsTimeline: [],
  currentEvent: null,
  winner: null,
  lastPossession: null,
  teamSnapshots: {
    [TEAM_KEY.A]: context.teams[TEAM_KEY.A],
    [TEAM_KEY.B]: context.teams[TEAM_KEY.B],
  },
  setup: context.setup,
});

const buildChunkMessage = ({
  possessingTeamName,
  possessionSwing,
  chanceCreated,
  xg,
  goalScored,
  goalScorerName,
  minute,
  half,
  scoreA,
  scoreB,
}) => {
  const minuteLabel = `${minute}'`;

  if (goalScored) {
    return `${minuteLabel} H${half} GOAL ${possessingTeamName} (${goalScorerName}) xG ${xg.toFixed(2)} score ${scoreA}-${scoreB}`;
  }

  if (chanceCreated) {
    return `${minuteLabel} H${half} chance ${possessingTeamName} xG ${xg.toFixed(2)} no goal`;
  }

  if (possessionSwing) {
    return `${minuteLabel} H${half} possession swing to ${possessingTeamName}`;
  }

  return `${minuteLabel} H${half} controlled phase by ${possessingTeamName}`;
};

const getWinner = (score) => {
  if (score[TEAM_KEY.A] > score[TEAM_KEY.B]) return TEAM_KEY.A;
  if (score[TEAM_KEY.B] > score[TEAM_KEY.A]) return TEAM_KEY.B;
  return "DRAW";
};

export const runNextChunk = (currentState, context) => {
  if (currentState.status !== "running") return currentState;

  const nextChunkNumber = currentState.chunk + 1;
  const minute = getMinuteFromChunk(nextChunkNumber, context.chunkCount);
  const half = getHalfFromMinute(minute);
  const teamA = context.teams[TEAM_KEY.A];
  const teamB = context.teams[TEAM_KEY.B];

  const possessionChanceA = logistic(
    (teamA.adjustedMetrics.control - teamB.adjustedMetrics.control) / 15
  );

  const possessingTeamKey = pickPossessionTeam(possessionChanceA, context.rng.random);
  const defendingTeamKey = nextTeamKey(possessingTeamKey);

  const possessingTeam = context.teams[possessingTeamKey];
  const defendingTeam = context.teams[defendingTeamKey];

  const stats = {
    [TEAM_KEY.A]: { ...currentState.stats[TEAM_KEY.A] },
    [TEAM_KEY.B]: { ...currentState.stats[TEAM_KEY.B] },
  };
  stats[possessingTeamKey].possessionChunks += 1;

  const tempoFactor = clamp(
    (possessingTeam.adjustedMetrics.buildUp + possessingTeam.adjustedMetrics.threat) /
      SIX_A_SIDE_TUNING.tempoDivisor,
    SIX_A_SIDE_TUNING.tempoMin,
    SIX_A_SIDE_TUNING.tempoMax
  );
  const chanceProbRaw =
    (SIX_A_SIDE_TUNING.chanceBase +
      (possessingTeam.adjustedMetrics.buildUp - defendingTeam.adjustedMetrics.resistance) /
        SIX_A_SIDE_TUNING.chanceSpreadDivisor) *
    tempoFactor;
  const chanceProb = clamp(
    chanceProbRaw,
    SIX_A_SIDE_TUNING.chanceMin,
    SIX_A_SIDE_TUNING.chanceMax
  );
  const chanceCreated = pickWithProbability(chanceProb, context.rng.random);

  let xg = 0;
  let goalScored = false;
  let goalScorerId = null;
  let goalScorerName = null;
  if (chanceCreated) {
    xg = clamp(
      SIX_A_SIDE_TUNING.xgBase +
        (possessingTeam.adjustedMetrics.threat - defendingTeam.adjustedMetrics.resistance) /
          SIX_A_SIDE_TUNING.xgSpreadDivisor +
        context.rng.randomFloat(SIX_A_SIDE_TUNING.xgNoiseMin, SIX_A_SIDE_TUNING.xgNoiseMax),
      SIX_A_SIDE_TUNING.xgMin,
      SIX_A_SIDE_TUNING.xgMax
    );

    const finishVsGk =
      possessingTeam.finishingIndex /
      (possessingTeam.finishingIndex + defendingTeam.gkIndex * SIX_A_SIDE_TUNING.gkResistanceFactor);
    const conversionFactor =
      SIX_A_SIDE_TUNING.conversionFloor + SIX_A_SIDE_TUNING.conversionScale * finishVsGk;
    const transitionBonus =
      SIX_A_SIDE_TUNING.transitionBonusScale *
      clamp(
        (possessingTeam.adjustedMetrics.threat - defendingTeam.adjustedMetrics.resistance + 40) /
          120,
        0,
        1
      );
    const goalProb = clamp(
      xg * conversionFactor + transitionBonus,
      SIX_A_SIDE_TUNING.goalProbMin,
      SIX_A_SIDE_TUNING.goalProbMax
    );

    goalScored = pickWithProbability(goalProb, context.rng.random);
    if (goalScored) {
      goalScorerId = makeDecision(context.scorerWeights[possessingTeamKey], context.rng.random);
      goalScorerName = context.playersById[goalScorerId]?.name || "Unknown";
    }

    stats[possessingTeamKey].shots += 1;
    stats[possessingTeamKey].totalXg += xg;
    if (goalScored) {
      stats[possessingTeamKey].goals += 1;
    }
  }

  const score = {
    [TEAM_KEY.A]: stats[TEAM_KEY.A].goals,
    [TEAM_KEY.B]: stats[TEAM_KEY.B].goals,
  };

  const possessionSwing =
    currentState.lastPossession != null && currentState.lastPossession !== possessingTeamKey;
  const goalsTimeline =
    goalScored && goalScorerId
      ? [
          ...currentState.goalsTimeline,
          {
            id: `goal-${nextChunkNumber}-${score[TEAM_KEY.A]}-${score[TEAM_KEY.B]}`,
            minute,
            half,
            teamKey: possessingTeamKey,
            teamName: possessingTeam.teamName,
            scorerId: goalScorerId,
            scorerName: goalScorerName,
            scoreA: score[TEAM_KEY.A],
            scoreB: score[TEAM_KEY.B],
          },
        ]
      : currentState.goalsTimeline;

  const nextLog = [
    ...currentState.log,
    {
      id: `chunk-${nextChunkNumber}`,
      chunk: nextChunkNumber,
      possessionTeam: possessingTeamKey,
      possessionSwing,
      chanceCreated,
      xg,
      goalScored,
      goalScorerId,
      goalScorerName,
      minute,
      half,
      scoreA: score[TEAM_KEY.A],
      scoreB: score[TEAM_KEY.B],
      message: buildChunkMessage({
        possessingTeamName: possessingTeam.teamName,
        possessionSwing,
        chanceCreated,
        xg,
        goalScored,
        goalScorerName,
        minute,
        half,
        scoreA: score[TEAM_KEY.A],
        scoreB: score[TEAM_KEY.B],
      }),
    },
  ];

  const finished = nextChunkNumber >= context.chunkCount;

  return {
    ...currentState,
    status: finished ? "finished" : "running",
    chunk: nextChunkNumber,
    score,
    stats,
    log: nextLog,
    goalsTimeline,
    winner: finished ? getWinner(score) : null,
    lastPossession: possessingTeamKey,
  };
};

export const runFullMatch = (context) => {
  let state = {
    ...createInitialMatchState(context, "instant"),
    status: "running",
  };

  while (state.status === "running" || state.chunk < state.chunkCount) {
    state = {
      ...state,
      status: "running",
    };
    state = runNextChunk(state, context);
    if (state.chunk >= state.chunkCount) {
      state = {
        ...state,
        status: "finished",
        phase: "finished",
      };
    }
  }

  return state;
};
