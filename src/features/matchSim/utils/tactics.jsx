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

const TACTIC_STYLE = Object.freeze({
  ADVANCED: "advanced",
  BALANCED: "balanced",
  CONSERVATIVE: "conservative",
});

const addDeltas = (base, delta) => ({
  control: (base.control || 0) + (delta.control || 0),
  buildUp: (base.buildUp || 0) + (delta.buildUp || 0),
  threat: (base.threat || 0) + (delta.threat || 0),
  resistance: (base.resistance || 0) + (delta.resistance || 0),
});

const scaleDelta = (shape, factor) => {
  const scaled = createDeltaShape();
  Object.entries(shape || {}).forEach(([metric, value]) => {
    scaled[metric] = value * 100 * factor;
  });
  return scaled;
};

const normalizeTeamQuality = (teamProfile) =>
  clamp((teamProfile.overallRating - 58) / 30, 0, 1);

const computeTeamReadiness = (teamProfile) => {
  const quality = normalizeTeamQuality(teamProfile);
  return clamp(0.65 * quality + 0.35 * teamProfile.coherence, 0, 1);
};

const computeExecutionFactors = (style, readiness, executionDemand, tacticPower) => {
  const edge = (tacticPower - 0.5) * 2;
  const edge01 = clamp(0.5 + 0.5 * edge, 0, 1);
  const underDemand = clamp((executionDemand - readiness + 0.12) / 0.62, 0, 1);
  const overDemand = clamp((readiness - executionDemand + 0.12) / 0.62, 0, 1);

  if (style === TACTIC_STYLE.ADVANCED) {
    return {
      masteryFactor: overDemand * clamp(0.55 + 0.45 * edge01, 0, 1),
      failureFactor: underDemand * clamp(0.55 + 0.45 * (1 - edge01), 0, 1),
      supportFactor: 0,
    };
  }

  if (style === TACTIC_STYLE.CONSERVATIVE) {
    return {
      masteryFactor: overDemand * 0.35 * clamp(0.45 + 0.55 * edge01, 0, 1),
      failureFactor: underDemand * 0.2 * clamp(0.6 + 0.4 * (1 - edge01), 0, 1),
      supportFactor: clamp((1 - readiness) * 0.8 + 0.15, 0, 1) * clamp(0.6 + 0.4 * edge01, 0, 1),
    };
  }

  return {
    masteryFactor: overDemand * 0.45 * clamp(0.5 + 0.5 * edge01, 0, 1),
    failureFactor: underDemand * 0.45 * clamp(0.55 + 0.45 * (1 - edge01), 0, 1),
    supportFactor: 0,
  };
};

const ATTACKING_TACTIC_CONFIG = Object.freeze({
  [ATTACKING_TACTIC.POSSESSION]: {
    style: TACTIC_STYLE.ADVANCED,
    executionDemand: 0.74,
    baseDelta: Object.freeze({
      control: 0.1,
      buildUp: 0.08,
      threat: -0.03,
    }),
    masteryDelta: Object.freeze({
      control: 0.07,
      buildUp: 0.06,
      threat: 0.01,
    }),
    failureDelta: Object.freeze({
      control: -0.09,
      buildUp: -0.08,
      threat: -0.03,
      resistance: -0.03,
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
    style: TACTIC_STYLE.CONSERVATIVE,
    executionDemand: 0.44,
    baseDelta: Object.freeze({
      control: -0.05,
      buildUp: 0.06,
      threat: 0.08,
    }),
    masteryDelta: Object.freeze({
      threat: 0.02,
    }),
    supportDelta: Object.freeze({
      control: 0.01,
      buildUp: 0.03,
      threat: 0.04,
    }),
    failureDelta: Object.freeze({
      control: -0.01,
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
    style: TACTIC_STYLE.BALANCED,
    executionDemand: 0.58,
    baseDelta: Object.freeze({
      control: -0.08,
      buildUp: -0.02,
      threat: 0.15,
    }),
    masteryDelta: Object.freeze({
      threat: 0.04,
      control: 0.02,
    }),
    failureDelta: Object.freeze({
      control: -0.03,
      resistance: -0.02,
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
    style: TACTIC_STYLE.ADVANCED,
    executionDemand: 0.76,
    baseDelta: Object.freeze({
      control: 0.1,
      resistance: -0.05,
    }),
    masteryDelta: Object.freeze({
      control: 0.08,
      resistance: 0.05,
      threat: 0.02,
    }),
    failureDelta: Object.freeze({
      control: -0.09,
      resistance: -0.1,
      buildUp: -0.03,
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
    style: TACTIC_STYLE.BALANCED,
    executionDemand: 0.55,
    baseDelta: Object.freeze({
      control: 0.02,
      resistance: 0.08,
    }),
    masteryDelta: Object.freeze({
      resistance: 0.03,
      control: 0.01,
    }),
    failureDelta: Object.freeze({
      resistance: -0.03,
      control: -0.02,
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
    style: TACTIC_STYLE.CONSERVATIVE,
    executionDemand: 0.4,
    baseDelta: Object.freeze({
      control: -0.08,
      buildUp: -0.05,
      resistance: 0.15,
    }),
    masteryDelta: Object.freeze({
      resistance: 0.03,
    }),
    supportDelta: Object.freeze({
      control: 0.03,
      buildUp: 0.03,
      resistance: 0.07,
    }),
    failureDelta: Object.freeze({
      resistance: -0.02,
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

// Cross-team tactic matchup (rock-paper-scissors style):
// - Attack tactic vs opponent defensive tactic
// - Own defensive tactic vs opponent attack tactic
// Values are normalized deltas and later scaled into metric points.
const ATTACK_VS_DEFENSE_MATRIX = Object.freeze({
  [`${ATTACKING_TACTIC.POSSESSION}|${DEFENSIVE_TACTIC.HIGH_PRESS}`]: Object.freeze({
    control: -0.05,
    buildUp: -0.05,
  }),
  [`${ATTACKING_TACTIC.POSSESSION}|${DEFENSIVE_TACTIC.MID_BLOCK}`]: Object.freeze({
    control: 0.03,
    buildUp: 0.02,
  }),
  [`${ATTACKING_TACTIC.POSSESSION}|${DEFENSIVE_TACTIC.LOW_BLOCK}`]: Object.freeze({
    control: 0.05,
    buildUp: 0.03,
    threat: -0.02,
  }),
  [`${ATTACKING_TACTIC.DIRECT}|${DEFENSIVE_TACTIC.HIGH_PRESS}`]: Object.freeze({
    buildUp: 0.05,
    threat: 0.03,
  }),
  [`${ATTACKING_TACTIC.DIRECT}|${DEFENSIVE_TACTIC.MID_BLOCK}`]: Object.freeze({
    threat: -0.01,
  }),
  [`${ATTACKING_TACTIC.DIRECT}|${DEFENSIVE_TACTIC.LOW_BLOCK}`]: Object.freeze({
    buildUp: -0.03,
    threat: -0.05,
  }),
  [`${ATTACKING_TACTIC.COUNTER}|${DEFENSIVE_TACTIC.HIGH_PRESS}`]: Object.freeze({
    buildUp: 0.03,
    threat: 0.08,
  }),
  [`${ATTACKING_TACTIC.COUNTER}|${DEFENSIVE_TACTIC.MID_BLOCK}`]: Object.freeze({
    threat: 0.01,
  }),
  [`${ATTACKING_TACTIC.COUNTER}|${DEFENSIVE_TACTIC.LOW_BLOCK}`]: Object.freeze({
    buildUp: -0.03,
    threat: -0.09,
  }),
});

const DEFENSE_VS_ATTACK_MATRIX = Object.freeze({
  [`${DEFENSIVE_TACTIC.HIGH_PRESS}|${ATTACKING_TACTIC.POSSESSION}`]: Object.freeze({
    control: 0.05,
    resistance: 0.03,
  }),
  [`${DEFENSIVE_TACTIC.HIGH_PRESS}|${ATTACKING_TACTIC.DIRECT}`]: Object.freeze({
    resistance: -0.04,
  }),
  [`${DEFENSIVE_TACTIC.HIGH_PRESS}|${ATTACKING_TACTIC.COUNTER}`]: Object.freeze({
    resistance: -0.08,
    control: -0.03,
  }),
  [`${DEFENSIVE_TACTIC.MID_BLOCK}|${ATTACKING_TACTIC.POSSESSION}`]: Object.freeze({
    resistance: 0.03,
  }),
  [`${DEFENSIVE_TACTIC.MID_BLOCK}|${ATTACKING_TACTIC.DIRECT}`]: Object.freeze({
    resistance: 0.01,
  }),
  [`${DEFENSIVE_TACTIC.MID_BLOCK}|${ATTACKING_TACTIC.COUNTER}`]: Object.freeze({
    resistance: -0.01,
  }),
  [`${DEFENSIVE_TACTIC.LOW_BLOCK}|${ATTACKING_TACTIC.POSSESSION}`]: Object.freeze({
    resistance: 0.04,
    control: -0.02,
  }),
  [`${DEFENSIVE_TACTIC.LOW_BLOCK}|${ATTACKING_TACTIC.DIRECT}`]: Object.freeze({
    resistance: 0.05,
  }),
  [`${DEFENSIVE_TACTIC.LOW_BLOCK}|${ATTACKING_TACTIC.COUNTER}`]: Object.freeze({
    resistance: 0.08,
    threat: -0.02,
  }),
});

const computeTacticDelta = (config, team, opponent) => {
  const execScore = config.getExec(team);
  const resistScore = config.getResist(opponent);

  // Tactic power follows the requested logistic scaling.
  const tacticPower = logistic((execScore - resistScore) / 12);
  const modifier = (tacticPower - 0.5) * 2;
  const readiness = computeTeamReadiness(team);
  const executionDemand = config.executionDemand ?? 0.55;
  const style = config.style || TACTIC_STYLE.BALANCED;
  const factors = computeExecutionFactors(style, readiness, executionDemand, tacticPower);

  const delta = createDeltaShape();

  Object.entries(config.baseDelta).forEach(([metric, base]) => {
    delta[metric] = base * modifier * 100;
  });

  const masteryDelta = scaleDelta(config.masteryDelta, factors.masteryFactor);
  const supportDelta = scaleDelta(config.supportDelta, factors.supportFactor);
  const failureDelta = scaleDelta(config.failureDelta, factors.failureFactor);
  const adjustedDelta = addDeltas(addDeltas(addDeltas(delta, masteryDelta), supportDelta), failureDelta);

  return {
    execScore,
    resistScore,
    tacticPower,
    modifier,
    readiness,
    executionDemand,
    style,
    factors,
    masteryDelta,
    supportDelta,
    failureDelta,
    delta: adjustedDelta,
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

const computeMatchupDelta = (teamTactics, opponentTactics, readiness) => {
  if (!teamTactics || !opponentTactics) {
    return {
      attackKey: null,
      defenseKey: null,
      scale: 0,
      baseDelta: createDeltaShape(),
      delta: createDeltaShape(),
    };
  }

  const attackKey = `${teamTactics.attacking}|${opponentTactics.defensive}`;
  const defenseKey = `${teamTactics.defensive}|${opponentTactics.attacking}`;
  const attackBase = ATTACK_VS_DEFENSE_MATRIX[attackKey] || createDeltaShape();
  const defenseBase = DEFENSE_VS_ATTACK_MATRIX[defenseKey] || createDeltaShape();
  const baseDelta = addDeltas(attackBase, defenseBase);

  // Stronger/more coherent teams exploit tactical matchup edges more reliably.
  const scale = 0.72 + 0.28 * readiness;
  const delta = scaleDelta(baseDelta, scale);

  return {
    attackKey,
    defenseKey,
    scale,
    baseDelta,
    delta,
  };
};

const clampMetrics = (metrics) => ({
  control: clamp(metrics.control, 5, 98),
  buildUp: clamp(metrics.buildUp, 5, 98),
  threat: clamp(metrics.threat, 5, 98),
  resistance: clamp(metrics.resistance, 5, 98),
});

export const applyTeamTactics = (teamProfile, opponentProfile, tactics, opponentTactics = null) => {
  const attacking = tactics.attacking;
  const defensive = tactics.defensive;

  const attackConfig = ATTACKING_TACTIC_CONFIG[attacking];
  const defenseConfig = DEFENSIVE_TACTIC_CONFIG[defensive];

  const attackOutcome = computeTacticDelta(attackConfig, teamProfile, opponentProfile);
  const defenseOutcome = computeTacticDelta(defenseConfig, teamProfile, opponentProfile);
  const synergyDelta = computeSynergyDelta(attacking, defensive, teamProfile.coherence);
  const matchupOutcome = computeMatchupDelta(tactics, opponentTactics, computeTeamReadiness(teamProfile));

  const totalDelta = addDeltas(
    addDeltas(addDeltas(attackOutcome.delta, defenseOutcome.delta), synergyDelta),
    matchupOutcome.delta
  );
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
      matchupOutcome,
      totalDelta,
    },
  };
};
