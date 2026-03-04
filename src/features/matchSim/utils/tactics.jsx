import { clamp, logistic } from "./math";
import { ATTACKING_TACTIC, DEFENSIVE_TACTIC, POSITION } from "./matchSimTypes";
import { computeOverallRatingBreakdown } from "./ratings";

const getMid = (profile) => profile.roleAverages[POSITION.MID];
const getDef = (profile) => profile.roleAverages[POSITION.DEF];
const getFwr = (profile) => profile.roleAverages[POSITION.FWR];
const getGk = (profile) => profile.gk;

const createDeltaShape = () => ({
  control: 0,
  buildUp: 0,
  threat: 0,
  resistance: 0,
});

const addDeltas = (base, delta) => ({
  control: (base.control || 0) + (delta.control || 0),
  buildUp: (base.buildUp || 0) + (delta.buildUp || 0),
  threat: (base.threat || 0) + (delta.threat || 0),
  resistance: (base.resistance || 0) + (delta.resistance || 0),
});

const ATTACKING_TACTIC_CONFIG = Object.freeze({
  [ATTACKING_TACTIC.POSSESSION]: {
    baseDelta: Object.freeze({
      control: 0.1,
      buildUp: 0.08,
      threat: -0.03,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      return 0.42 * mid.passing + 0.36 * mid.control + 0.22 * mid.workRate;
    },
    getResist: (opponent) => {
      const oppMid = getMid(opponent);
      const oppDef = getDef(opponent);
      return 0.4 * oppMid.defending + 0.3 * oppDef.defending + 0.3 * oppMid.control;
    },
  },
  [ATTACKING_TACTIC.DIRECT]: {
    baseDelta: Object.freeze({
      control: -0.05,
      buildUp: 0.06,
      threat: 0.08,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      const fwr = getFwr(team);
      return 0.4 * fwr.offBall + 0.38 * fwr.finishing + 0.22 * mid.passing;
    },
    getResist: (opponent) => {
      const oppDef = getDef(opponent);
      const oppGk = getGk(opponent);
      return 0.7 * oppDef.defending + 0.3 * oppGk.goalkeeping;
    },
  },
  [ATTACKING_TACTIC.COUNTER]: {
    baseDelta: Object.freeze({
      control: -0.08,
      buildUp: -0.02,
      threat: 0.15,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      const fwr = getFwr(team);
      return 0.36 * fwr.offBall + 0.36 * fwr.finishing + 0.28 * mid.control;
    },
    getResist: (opponent) => {
      const oppDef = getDef(opponent);
      return 0.5 * opponent.metrics.control + 0.5 * oppDef.defending;
    },
  },
});

const DEFENSIVE_TACTIC_CONFIG = Object.freeze({
  [DEFENSIVE_TACTIC.HIGH_PRESS]: {
    baseDelta: Object.freeze({
      control: 0.1,
      resistance: -0.05,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      return 0.38 * mid.workRate + 0.32 * mid.defending + 0.3 * mid.offBall;
    },
    getResist: (opponent) => {
      const oppMid = getMid(opponent);
      const oppDef = getDef(opponent);
      return 0.5 * opponent.metrics.control + 0.35 * oppMid.passing + 0.15 * oppDef.passing;
    },
  },
  [DEFENSIVE_TACTIC.MID_BLOCK]: {
    baseDelta: Object.freeze({
      control: 0.02,
      resistance: 0.08,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      const def = getDef(team);
      return 0.45 * def.defending + 0.3 * mid.workRate + 0.25 * mid.defending;
    },
    getResist: (opponent) => {
      const oppMid = getMid(opponent);
      const oppFwr = getFwr(opponent);
      return 0.6 * oppMid.passing + 0.4 * oppFwr.offBall;
    },
  },
  [DEFENSIVE_TACTIC.LOW_BLOCK]: {
    baseDelta: Object.freeze({
      control: -0.08,
      buildUp: -0.05,
      resistance: 0.15,
    }),
    getExec: (team) => {
      const def = getDef(team);
      const mid = getMid(team);
      const gk = getGk(team);
      return 0.45 * def.defending + 0.35 * gk.goalkeeping + 0.2 * mid.workRate;
    },
    getResist: (opponent) => {
      const oppMid = getMid(opponent);
      return 0.55 * opponent.metrics.threat + 0.45 * oppMid.passing;
    },
  },
});

const SYNERGY_MATRIX = Object.freeze({
  [`${ATTACKING_TACTIC.COUNTER}|${DEFENSIVE_TACTIC.LOW_BLOCK}`]: Object.freeze({
    threat: 0.08,
    resistance: 0.04,
  }),
  [`${ATTACKING_TACTIC.POSSESSION}|${DEFENSIVE_TACTIC.HIGH_PRESS}`]: Object.freeze({
    control: 0.08,
    buildUp: 0.04,
    resistance: -0.03,
  }),
  [`${ATTACKING_TACTIC.DIRECT}|${DEFENSIVE_TACTIC.MID_BLOCK}`]: Object.freeze({
    buildUp: 0.03,
  }),
  [`${ATTACKING_TACTIC.POSSESSION}|${DEFENSIVE_TACTIC.LOW_BLOCK}`]: Object.freeze({
    control: -0.05,
  }),
  [`${ATTACKING_TACTIC.COUNTER}|${DEFENSIVE_TACTIC.HIGH_PRESS}`]: Object.freeze({
    threat: 0.05,
    resistance: -0.05,
  }),
});

const computeTacticDelta = (config, team, opponent) => {
  const execScore = config.getExec(team);
  const resistScore = config.getResist(opponent);

  // Tactic power follows the requested logistic scaling.
  const tacticPower = logistic((execScore - resistScore) / 12);
  const modifier = (tacticPower - 0.5) * 2;

  const delta = createDeltaShape();

  Object.entries(config.baseDelta).forEach(([metric, base]) => {
    delta[metric] = base * modifier * 100;
  });

  return {
    execScore,
    resistScore,
    tacticPower,
    modifier,
    delta,
  };
};

const computeSynergyDelta = (attacking, defensive, coherence) => {
  const key = `${attacking}|${defensive}`;
  const base = SYNERGY_MATRIX[key];
  if (!base) return createDeltaShape();

  const scale = 0.5 + 0.5 * coherence;
  const delta = createDeltaShape();

  Object.entries(base).forEach(([metric, value]) => {
    delta[metric] = value * 100 * scale;
  });

  return delta;
};

const clampMetrics = (metrics) => ({
  control: clamp(metrics.control, 5, 98),
  buildUp: clamp(metrics.buildUp, 5, 98),
  threat: clamp(metrics.threat, 5, 98),
  resistance: clamp(metrics.resistance, 5, 98),
});

export const applyTeamTactics = (teamProfile, opponentProfile, tactics) => {
  const attacking = tactics.attacking;
  const defensive = tactics.defensive;

  const attackConfig = ATTACKING_TACTIC_CONFIG[attacking];
  const defenseConfig = DEFENSIVE_TACTIC_CONFIG[defensive];

  const attackOutcome = computeTacticDelta(attackConfig, teamProfile, opponentProfile);
  const defenseOutcome = computeTacticDelta(defenseConfig, teamProfile, opponentProfile);
  const synergyDelta = computeSynergyDelta(attacking, defensive, teamProfile.coherence);

  const totalDelta = addDeltas(addDeltas(attackOutcome.delta, defenseOutcome.delta), synergyDelta);
  const adjustedMetrics = clampMetrics(addDeltas(teamProfile.metrics, totalDelta));
  const overallRatingBreakdown = computeOverallRatingBreakdown(
    adjustedMetrics,
    teamProfile.finishingIndex,
    teamProfile.gkIndex
  );
  const overallRating = overallRatingBreakdown.total;

  return {
    ...teamProfile,
    adjustedMetrics,
    overallRating,
    overallRatingBreakdown,
    tactics,
    tacticBreakdown: {
      attackOutcome,
      defenseOutcome,
      synergyDelta,
      totalDelta,
    },
  };
};
