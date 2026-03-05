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

const getPairKey = (defensive, attacking) => `${defensive}|${attacking}`;

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
      control: -0.07,
      buildUp: -0.04,
      resistance: 0.11,
    }),
    masteryDelta: Object.freeze({
      resistance: 0.03,
    }),
    supportDelta: Object.freeze({
      control: 0.01,
      buildUp: 0.01,
      resistance: 0.03,
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

// Quality spectrum matrix from design request:
// score: GG=2, G=1, N=0, B=-1, BB=-2
const PAIR_QUALITY_SCORE = Object.freeze({
  good: Object.freeze({
    [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.DIRECT)]: 1,
    [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.POSSESSION)]: 0,
    [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.COUNTER)]: 1,
    [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.DIRECT)]: 1,
    [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.POSSESSION)]: 1,
    [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.COUNTER)]: 0,
    [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.DIRECT)]: -1,
    [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.POSSESSION)]: 2,
    [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.COUNTER)]: 2,
  }),
  mid: Object.freeze({
    [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.DIRECT)]: 1,
    [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.POSSESSION)]: 0,
    [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.COUNTER)]: 2,
    [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.DIRECT)]: 0,
    [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.POSSESSION)]: 1,
    [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.COUNTER)]: 0,
    [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.DIRECT)]: -2,
    [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.POSSESSION)]: 0,
    [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.COUNTER)]: 1,
  }),
  bad: Object.freeze({
    [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.DIRECT)]: 2,
    [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.POSSESSION)]: 0,
    [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.COUNTER)]: 2,
    [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.DIRECT)]: 1,
    [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.POSSESSION)]: 0,
    [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.COUNTER)]: 0,
    [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.DIRECT)]: -2,
    [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.POSSESSION)]: -2,
    [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.COUNTER)]: -2,
  }),
});

// Positive profile is applied when pair score > 0.
// Negative profile is applied when pair score < 0.
const PAIR_EFFECT_PROFILE = Object.freeze({
  [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.DIRECT)]: Object.freeze({
    positive: Object.freeze({ resistance: 0.07, threat: 0.05, buildUp: 0.01 }),
    negative: Object.freeze({ resistance: -0.04, threat: -0.03, buildUp: -0.02 }),
  }),
  [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.POSSESSION)]: Object.freeze({
    positive: Object.freeze({ resistance: 0.03, control: 0.01, buildUp: -0.01 }),
    negative: Object.freeze({ resistance: -0.02, control: -0.04, buildUp: -0.04 }),
  }),
  [getPairKey(DEFENSIVE_TACTIC.LOW_BLOCK, ATTACKING_TACTIC.COUNTER)]: Object.freeze({
    positive: Object.freeze({ resistance: 0.07, threat: 0.09, buildUp: 0.01, control: -0.01 }),
    negative: Object.freeze({ resistance: -0.04, threat: -0.06, buildUp: -0.03 }),
  }),
  [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.DIRECT)]: Object.freeze({
    positive: Object.freeze({ resistance: 0.04, buildUp: 0.03, threat: 0.03 }),
    negative: Object.freeze({ resistance: -0.04, buildUp: -0.03, threat: -0.03 }),
  }),
  [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.POSSESSION)]: Object.freeze({
    positive: Object.freeze({ resistance: 0.05, control: 0.05, buildUp: 0.04, threat: 0.02 }),
    negative: Object.freeze({ resistance: -0.04, control: -0.04, buildUp: -0.03, threat: -0.02 }),
  }),
  [getPairKey(DEFENSIVE_TACTIC.MID_BLOCK, ATTACKING_TACTIC.COUNTER)]: Object.freeze({
    positive: Object.freeze({ resistance: 0.03, threat: 0.04 }),
    negative: Object.freeze({ resistance: -0.03, threat: -0.04, control: -0.02 }),
  }),
  [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.DIRECT)]: Object.freeze({
    positive: Object.freeze({ control: 0.03, buildUp: 0.02, threat: 0.02, resistance: -0.03 }),
    negative: Object.freeze({ control: -0.05, buildUp: -0.05, threat: -0.05, resistance: -0.09 }),
  }),
  [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.POSSESSION)]: Object.freeze({
    positive: Object.freeze({ control: 0.08, buildUp: 0.07, threat: 0.04, resistance: 0.04 }),
    negative: Object.freeze({ control: -0.07, buildUp: -0.08, threat: -0.04, resistance: -0.07 }),
  }),
  [getPairKey(DEFENSIVE_TACTIC.HIGH_PRESS, ATTACKING_TACTIC.COUNTER)]: Object.freeze({
    positive: Object.freeze({ control: 0.04, buildUp: 0.05, threat: 0.1, resistance: -0.04 }),
    negative: Object.freeze({ control: -0.06, buildUp: -0.05, threat: -0.08, resistance: -0.08 }),
  }),
});

// Cross-team tactic matchup (rock-paper-scissors style):
// - Attack tactic vs opponent defensive tactic
// - Own defensive tactic vs opponent attack tactic
// Values are normalized deltas and later scaled into metric points.
const MATCHUP_RESULT = Object.freeze({
  GOOD: "G",
  NEUTRAL: "N",
  BAD: "B",
});

const ATTACK_MATCHUP_EFFECT = Object.freeze({
  [MATCHUP_RESULT.GOOD]: Object.freeze({
    control: 0.02,
    buildUp: 0.04,
    threat: 0.07,
  }),
  [MATCHUP_RESULT.NEUTRAL]: Object.freeze({}),
  [MATCHUP_RESULT.BAD]: Object.freeze({
    control: -0.02,
    buildUp: -0.04,
    threat: -0.07,
  }),
});

const DEFENSE_MATCHUP_EFFECT = Object.freeze({
  [MATCHUP_RESULT.GOOD]: Object.freeze({
    control: 0.02,
    resistance: 0.07,
  }),
  [MATCHUP_RESULT.NEUTRAL]: Object.freeze({}),
  [MATCHUP_RESULT.BAD]: Object.freeze({
    control: -0.02,
    resistance: -0.07,
  }),
});

const ATTACK_VS_DEFENSE_MATRIX = Object.freeze({
  // Derived attacker perspective from defensive matrix below:
  // attacker gets inverse of defender effectiveness.
  //            Direct  Possession  Counter
  // Low Block     G        N          B
  // Mid Block     B        G          N
  // High Press    N        B          G
  [`${ATTACKING_TACTIC.DIRECT}|${DEFENSIVE_TACTIC.LOW_BLOCK}`]: ATTACK_MATCHUP_EFFECT[MATCHUP_RESULT.GOOD],
  [`${ATTACKING_TACTIC.POSSESSION}|${DEFENSIVE_TACTIC.LOW_BLOCK}`]: ATTACK_MATCHUP_EFFECT[MATCHUP_RESULT.NEUTRAL],
  [`${ATTACKING_TACTIC.COUNTER}|${DEFENSIVE_TACTIC.LOW_BLOCK}`]: ATTACK_MATCHUP_EFFECT[MATCHUP_RESULT.BAD],
  [`${ATTACKING_TACTIC.DIRECT}|${DEFENSIVE_TACTIC.MID_BLOCK}`]: ATTACK_MATCHUP_EFFECT[MATCHUP_RESULT.BAD],
  [`${ATTACKING_TACTIC.POSSESSION}|${DEFENSIVE_TACTIC.MID_BLOCK}`]: ATTACK_MATCHUP_EFFECT[MATCHUP_RESULT.GOOD],
  [`${ATTACKING_TACTIC.COUNTER}|${DEFENSIVE_TACTIC.MID_BLOCK}`]: ATTACK_MATCHUP_EFFECT[MATCHUP_RESULT.NEUTRAL],
  [`${ATTACKING_TACTIC.DIRECT}|${DEFENSIVE_TACTIC.HIGH_PRESS}`]: ATTACK_MATCHUP_EFFECT[MATCHUP_RESULT.NEUTRAL],
  [`${ATTACKING_TACTIC.POSSESSION}|${DEFENSIVE_TACTIC.HIGH_PRESS}`]: ATTACK_MATCHUP_EFFECT[MATCHUP_RESULT.BAD],
  [`${ATTACKING_TACTIC.COUNTER}|${DEFENSIVE_TACTIC.HIGH_PRESS}`]: ATTACK_MATCHUP_EFFECT[MATCHUP_RESULT.GOOD],
});

const DEFENSE_VS_ATTACK_MATRIX = Object.freeze({
  // Matrix requested by design (defender perspective):
  //            Direct  Possession  Counter
  // Low Block     B        N          G
  // Mid Block     G        B          N
  // High Press    N        G          B
  [`${DEFENSIVE_TACTIC.LOW_BLOCK}|${ATTACKING_TACTIC.DIRECT}`]: DEFENSE_MATCHUP_EFFECT[MATCHUP_RESULT.BAD],
  [`${DEFENSIVE_TACTIC.LOW_BLOCK}|${ATTACKING_TACTIC.POSSESSION}`]: DEFENSE_MATCHUP_EFFECT[MATCHUP_RESULT.NEUTRAL],
  [`${DEFENSIVE_TACTIC.LOW_BLOCK}|${ATTACKING_TACTIC.COUNTER}`]: DEFENSE_MATCHUP_EFFECT[MATCHUP_RESULT.GOOD],
  [`${DEFENSIVE_TACTIC.MID_BLOCK}|${ATTACKING_TACTIC.DIRECT}`]: DEFENSE_MATCHUP_EFFECT[MATCHUP_RESULT.GOOD],
  [`${DEFENSIVE_TACTIC.MID_BLOCK}|${ATTACKING_TACTIC.POSSESSION}`]: DEFENSE_MATCHUP_EFFECT[MATCHUP_RESULT.BAD],
  [`${DEFENSIVE_TACTIC.MID_BLOCK}|${ATTACKING_TACTIC.COUNTER}`]: DEFENSE_MATCHUP_EFFECT[MATCHUP_RESULT.NEUTRAL],
  [`${DEFENSIVE_TACTIC.HIGH_PRESS}|${ATTACKING_TACTIC.DIRECT}`]: DEFENSE_MATCHUP_EFFECT[MATCHUP_RESULT.NEUTRAL],
  [`${DEFENSIVE_TACTIC.HIGH_PRESS}|${ATTACKING_TACTIC.POSSESSION}`]: DEFENSE_MATCHUP_EFFECT[MATCHUP_RESULT.GOOD],
  [`${DEFENSIVE_TACTIC.HIGH_PRESS}|${ATTACKING_TACTIC.COUNTER}`]: DEFENSE_MATCHUP_EFFECT[MATCHUP_RESULT.BAD],
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

const interpolate = (start, end, t) => start + (end - start) * t;

const getQualityPairScore = (overallRating, pairKey) => {
  const badScore = PAIR_QUALITY_SCORE.bad[pairKey] ?? 0;
  const midScore = PAIR_QUALITY_SCORE.mid[pairKey] ?? 0;
  const goodScore = PAIR_QUALITY_SCORE.good[pairKey] ?? 0;

  if (overallRating <= 80) return badScore;
  if (overallRating >= 90) return goodScore;

  if (overallRating < 85) {
    const t = (overallRating - 80) / 5;
    return interpolate(badScore, midScore, t);
  }

  const t = (overallRating - 85) / 5;
  return interpolate(midScore, goodScore, t);
};

const getAttackFit = (teamProfile, attacking) => {
  const mid = getMid(teamProfile);
  const fwr = getFwr(teamProfile);

  if (attacking === ATTACKING_TACTIC.DIRECT) {
    return clamp((0.5 * fwr.finishing + 0.3 * fwr.offBall + 0.2 * mid.passing) / 100, 0, 1);
  }

  if (attacking === ATTACKING_TACTIC.COUNTER) {
    return clamp((0.42 * fwr.offBall + 0.34 * fwr.finishing + 0.24 * mid.control) / 100, 0, 1);
  }

  return clamp((0.4 * mid.passing + 0.35 * mid.control + 0.25 * mid.workRate) / 100, 0, 1);
};

const getDefenseFit = (teamProfile, defensive) => {
  const mid = getMid(teamProfile);
  const def = getDef(teamProfile);
  const gk = getGk(teamProfile);

  if (defensive === DEFENSIVE_TACTIC.LOW_BLOCK) {
    return clamp((0.44 * def.defending + 0.32 * gk.goalkeeping + 0.24 * mid.workRate) / 100, 0, 1);
  }

  if (defensive === DEFENSIVE_TACTIC.HIGH_PRESS) {
    return clamp((0.38 * mid.workRate + 0.32 * mid.offBall + 0.3 * mid.defending) / 100, 0, 1);
  }

  return clamp((0.46 * def.defending + 0.3 * mid.defending + 0.24 * mid.workRate) / 100, 0, 1);
};

const computeSynergyDelta = (teamProfile, attacking, defensive) => {
  const pairKey = getPairKey(defensive, attacking);
  const profile = PAIR_EFFECT_PROFILE[pairKey];
  if (!profile) {
    return {
      pairKey,
      qualityScore: 0,
      attackFit: 0,
      defenseFit: 0,
      pairFit: 0,
      scale: 0,
      delta: createDeltaShape(),
    };
  }

  const qualityScore = getQualityPairScore(teamProfile.overallRating, pairKey);
  const attackFit = getAttackFit(teamProfile, attacking);
  const defenseFit = getDefenseFit(teamProfile, defensive);
  const pairFit = clamp(0.55 * attackFit + 0.45 * defenseFit, 0, 1);
  const magnitude = clamp(Math.abs(qualityScore) / 2, 0, 1);

  let baseShape = createDeltaShape();
  let scale = 0;

  if (qualityScore > 0) {
    // Positive pair quality gains more from strong tactic-fit players.
    scale = magnitude * (0.55 + 0.7 * pairFit);
    baseShape = profile.positive;
  } else if (qualityScore < 0) {
    // Negative pair quality is punished harder when the squad lacks fit.
    scale = magnitude * (0.6 + 0.8 * (1 - pairFit));
    baseShape = profile.negative;
  }

  return {
    pairKey,
    qualityScore,
    attackFit,
    defenseFit,
    pairFit,
    scale,
    delta: scaleDelta(baseShape, scale),
  };
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
  const synergyOutcome = computeSynergyDelta(teamProfile, attacking, defensive);
  const synergyDelta = synergyOutcome.delta;
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
      synergyOutcome,
      matchupOutcome,
      totalDelta,
    },
  };
};
