import { makeDecision } from "../../../engine/utils/makeDecision/makeDecision";
import { clamp, logistic } from "./math";
import { createSeededRng } from "./seededRng";
import { applyTeamTactics } from "./tactics";
import { createMatchTeamColors } from "./teamColors";
import { applyPositionFit, computeTeamProfile, playersArrayToMap } from "./ratings";
import {
  CHUNK_MINUTES,
  DEFAULT_CHUNK_COUNT,
  EVENT_KIND,
  MATCH_HALF,
  MATCH_TOTAL_MINUTES,
  POSITION,
  TEAM_KEY,
} from "./matchSimTypes";
import { generateChunkEvents } from "./commentary";

// 6-a-side tuning: fewer players, more space, and faster transitions should
// produce more chances and slightly better conversion than 11-a-side baselines.
const SIX_A_SIDE_TUNING = Object.freeze({
  // Futsal/small-sided profile:
  // - Frequent high-quality transitions
  // - More shots and more conversion than 11-a-side
  // Dialed back to reduce total goals by roughly ~2 per match on average.
  chanceBase: 0.29,
  chanceSpreadDivisor: 112,
  chanceMin: 0.14,
  chanceMax: 0.82,
  tempoDivisor: 170,
  tempoMin: 0.8,
  tempoMax: 1.35,
  xgBase: 0.27,
  xgSpreadDivisor: 138,
  xgNoiseMin: -0.07,
  xgNoiseMax: 0.08,
  xgMin: 0.14,
  xgMax: 0.74,
  gkResistanceFactor: 0.72,
  conversionFloor: 0.29,
  conversionScale: 0.88,
  transitionBonusScale: 0.06,
  goalProbMin: 0.05,
  goalProbMax: 0.82,
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

const getChunkMinuteBounds = (chunkIndex) => {
  const minuteStart = (chunkIndex - 1) * CHUNK_MINUTES + 1;
  const minuteEnd = Math.min(MATCH_TOTAL_MINUTES, minuteStart + 1);
  return {
    minuteStart,
    minuteEnd,
  };
};

export const getHalfForMinute = (minute) => (minute > MATCH_TOTAL_MINUTES / 2 ? MATCH_HALF.H2 : MATCH_HALF.H1);

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

const SCORER_ROLE_MULTIPLIER = Object.freeze({
  [POSITION.FWR]: 1.0,
  [POSITION.MID]: 0.62,
  [POSITION.DEF]: 0.34,
  [POSITION.GK]: 0,
});

const getScorerWeight = (player, assignedRole) => {
  if (assignedRole === POSITION.GK) return 0;

  const roleMultiplier = SCORER_ROLE_MULTIPLIER[assignedRole] || SCORER_ROLE_MULTIPLIER[POSITION.DEF];
  const fit = applyPositionFit(player.preferredPos, assignedRole);
  // Finishing dominates scorer selection, with a smaller support term.
  const finishingCore = Math.pow(Math.max(1, player.finishing), 1.45);
  const support = player.offBall * 0.45 + player.control * 0.2 + player.passing * 0.15 + player.workRate * 0.1;
  const rawWeight = (finishingCore + support) * roleMultiplier * fit;
  return clamp(rawWeight, 0, 10000);
};

const buildScorerWeights = (teamProfile, playersById) => {
  const entries = [];
  const { lineup } = teamProfile;

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
    weights[entry.playerId] = Math.max(0, getScorerWeight(entry.player, entry.role));
    return weights;
  }, {});
};

export const createMatchContext = ({ seed, chunkCount = DEFAULT_CHUNK_COUNT, players, teamA, teamB }) => {
  const playersById = playersArrayToMap(players);
  const teamColors = createMatchTeamColors(seed);

  const baseA = computeTeamProfile(teamA, playersById);
  const baseB = computeTeamProfile(teamB, playersById);

  const runtimeA = applyTeamTactics(baseA, baseB, teamA.tactics, teamB.tactics);
  const runtimeB = applyTeamTactics(baseB, baseA, teamB.tactics, teamA.tactics);

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
        colors: teamColors[TEAM_KEY.A],
      },
      [TEAM_KEY.B]: {
        name: teamB.name,
        formation: teamB.formation,
        tactics: teamB.tactics,
        colors: teamColors[TEAM_KEY.B],
      },
    },
  };
};

export const createInitialMatchState = (context, mode) => ({
  status: "ready",
  phase: "pre_kickoff",
  mode,
  seed: context.seed,
  currentMinute: 0,
  chunk: 0,
  chunkCount: context.chunkCount,
  score: {
    [TEAM_KEY.A]: 0,
    [TEAM_KEY.B]: 0,
  },
  stats: createInitialStats(),
  log: [],
  goalsTimeline: [],
  latestChunkEvents: [],
  currentEvent: null,
  winner: null,
  pauseForGoal: false,
  lastPossession: null,
  lastGoalEvent: null,
  teamSnapshots: {
    [TEAM_KEY.A]: context.teams[TEAM_KEY.A],
    [TEAM_KEY.B]: context.teams[TEAM_KEY.B],
  },
  setup: context.setup,
});

const getWinner = (score) => {
  if (score[TEAM_KEY.A] > score[TEAM_KEY.B]) return TEAM_KEY.A;
  if (score[TEAM_KEY.B] > score[TEAM_KEY.A]) return TEAM_KEY.B;
  return "DRAW";
};

export const runNextChunk = (currentState, context) => {
  if (currentState.status !== "running") return currentState;

  const nextChunkNumber = currentState.chunk + 1;
  const { minuteStart, minuteEnd } = getChunkMinuteBounds(nextChunkNumber);
  const half = getHalfForMinute(minuteStart);
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
  const chunkEvents = generateChunkEvents({
    context,
    chunkIndex: nextChunkNumber,
    half,
    minuteStart,
    minuteEnd,
    possessionTeamId: possessingTeamKey,
    defendingTeamId: defendingTeamKey,
    possessionSwing,
    chanceCreated,
    xg,
    goalScored,
    goalScorerId,
    scoreAfter: {
      a: score[TEAM_KEY.A],
      b: score[TEAM_KEY.B],
    },
  });
  const goalEvent = chunkEvents.find((event) => event.kind === EVENT_KIND.GOAL) || null;

  const goalsTimeline = goalEvent
    ? [
        ...currentState.goalsTimeline,
        {
          id: `goal-${goalEvent.id}`,
          minute: goalEvent.minute,
          half: goalEvent.half,
          teamKey: goalEvent.teamId,
          teamName: context.setup[goalEvent.teamId].name,
          scorerId: goalEvent.primaryPlayerId,
          scorerName: context.playersById[goalEvent.primaryPlayerId]?.name || goalScorerName || "Unknown",
          scoreA: score[TEAM_KEY.A],
          scoreB: score[TEAM_KEY.B],
        },
      ]
    : currentState.goalsTimeline;

  const finished = nextChunkNumber >= context.chunkCount;

  return {
    ...currentState,
    status: finished ? "finished" : "running",
    chunk: nextChunkNumber,
    score,
    stats,
    log: [...currentState.log, ...chunkEvents],
    latestChunkEvents: chunkEvents,
    goalsTimeline,
    winner: finished ? getWinner(score) : null,
    pauseForGoal: !!goalEvent,
    lastGoalEvent: goalEvent || currentState.lastGoalEvent,
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
