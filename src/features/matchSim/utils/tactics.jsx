import { clamp, logistic } from "./math";
import { ATTACKING_TACTIC, DEFENSIVE_TACTIC, POSITION } from "./matchSimTypes";
import { applyPositionFit, computeOverallRatingBreakdown } from "./ratings";

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

const SKILL_BAND = Object.freeze({
  BAD: 0,
  BELOW_AVERAGE: 1,
  OK: 2,
  GOOD: 3,
  VERY_GOOD: 4,
  ELITE: 5,
});

const ATTACKING_ROLE_WEIGHTS = Object.freeze({
  [POSITION.DEF]: 0.55,
  [POSITION.MID]: 0.85,
  [POSITION.FWR]: 1.0,
});

const DEFENSIVE_ROLE_WEIGHTS = Object.freeze({
  [POSITION.DEF]: 1.0,
  [POSITION.MID]: 0.85,
  [POSITION.FWR]: 0.45,
});

const PLAYER_ROLE_BLEND = Object.freeze({
  [POSITION.GK]: Object.freeze({ attack: 0.2, defense: 0.8 }),
  [POSITION.DEF]: Object.freeze({ attack: 0.35, defense: 0.65 }),
  [POSITION.MID]: Object.freeze({ attack: 0.55, defense: 0.45 }),
  [POSITION.FWR]: Object.freeze({ attack: 0.7, defense: 0.3 }),
});

const PLAYER_ATTACK_ROLE_INFLUENCE = Object.freeze({
  [POSITION.GK]: 0.15,
  [POSITION.DEF]: 0.55,
  [POSITION.MID]: 0.85,
  [POSITION.FWR]: 1.0,
});

const PLAYER_DEFENSE_ROLE_INFLUENCE = Object.freeze({
  [POSITION.GK]: 0.35,
  [POSITION.DEF]: 1.0,
  [POSITION.MID]: 0.85,
  [POSITION.FWR]: 0.45,
});

const PLAYER_SKILL_KEYS = Object.freeze([
  "finishing",
  "passing",
  "control",
  "defending",
  "offBall",
  "workRate",
]);

export const TACTIC_SKILL_MATRIX = Object.freeze({
  defensive: Object.freeze({
    [DEFENSIVE_TACTIC.LOW_BLOCK]: Object.freeze({
      finishing: 0,
      passing: 1,
      control: 1,
      defending: 1,
      offBall: 0,
      workRate: 0,
    }),
    [DEFENSIVE_TACTIC.MID_BLOCK]: Object.freeze({
      finishing: 0,
      passing: 1,
      control: 2,
      defending: 3,
      offBall: 1,
      workRate: 1,
    }),
    [DEFENSIVE_TACTIC.HIGH_PRESS]: Object.freeze({
      finishing: 0,
      passing: 1,
      control: 3,
      defending: 5,
      offBall: 2,
      workRate: 3,
    }),
    [DEFENSIVE_TACTIC.ZONAL]: Object.freeze({
      finishing: 0,
      passing: 0,
      control: 3,
      defending: 2,
      offBall: 0,
      workRate: 1,
    }),
  }),
  attacking: Object.freeze({
    [ATTACKING_TACTIC.POSSESSION]: Object.freeze({
      finishing: 3,
      passing: 5,
      control: 3,
      defending: 0,
      offBall: 2,
      workRate: 4,
    }),
    [ATTACKING_TACTIC.COUNTER]: Object.freeze({
      finishing: 2,
      passing: 1,
      control: 2,
      defending: 0,
      offBall: 2,
      workRate: 3,
    }),
    [ATTACKING_TACTIC.DIRECT]: Object.freeze({
      finishing: 2,
      passing: 1,
      control: 1,
      defending: 0,
      offBall: 1,
      workRate: 1,
    }),
    [ATTACKING_TACTIC.CROSSES]: Object.freeze({
      finishing: 4,
      passing: 3,
      control: 1,
      defending: 0,
      offBall: 2,
      workRate: 1,
    }),
    [ATTACKING_TACTIC.TIKI_TAKA]: Object.freeze({
      finishing: 2,
      passing: 5,
      control: 5,
      defending: 0,
      offBall: 5,
      workRate: 2,
    }),
    [ATTACKING_TACTIC.LONG_SHOTS]: Object.freeze({
      finishing: 5,
      passing: 1,
      control: 3,
      defending: 0,
      offBall: 1,
      workRate: 1,
    }),
    [ATTACKING_TACTIC.HOLD_UP_PLAY]: Object.freeze({
      finishing: 1,
      passing: 2,
      control: 2,
      defending: 1,
      offBall: 3,
      workRate: 3,
    }),
  }),
});

const MATRIX_ATTACK_METRIC_SHAPE = Object.freeze({
  control: 0.05,
  buildUp: 0.08,
  threat: 0.11,
  resistance: -0.01,
});

const MATRIX_DEFENSE_METRIC_SHAPE = Object.freeze({
  control: 0.03,
  buildUp: -0.01,
  threat: -0.02,
  resistance: 0.1,
});

const TACTIC_BONUS_LEVEL = Object.freeze({
  defensive: Object.freeze({
    [DEFENSIVE_TACTIC.LOW_BLOCK]: 1,
    [DEFENSIVE_TACTIC.MID_BLOCK]: 2,
    [DEFENSIVE_TACTIC.HIGH_PRESS]: 3,
    [DEFENSIVE_TACTIC.ZONAL]: 2,
  }),
  attacking: Object.freeze({
    [ATTACKING_TACTIC.POSSESSION]: 4,
    [ATTACKING_TACTIC.COUNTER]: 3,
    [ATTACKING_TACTIC.DIRECT]: 1,
    [ATTACKING_TACTIC.CROSSES]: 3,
    [ATTACKING_TACTIC.TIKI_TAKA]: 5,
    [ATTACKING_TACTIC.LONG_SHOTS]: 3,
    [ATTACKING_TACTIC.HOLD_UP_PLAY]: 2,
  }),
});

const MATRIX_IMPACT_PROFILE_DEFAULT = Object.freeze({
  requirementShift: 0,
  rewardScale: 0.25,
  penaltyScale: 0.5,
});

const getCanonicalAttackingTactic = (attacking) => {
  if (attacking === ATTACKING_TACTIC.CROSSES) return ATTACKING_TACTIC.DIRECT;
  if (attacking === ATTACKING_TACTIC.TIKI_TAKA) return ATTACKING_TACTIC.POSSESSION;
  if (attacking === ATTACKING_TACTIC.LONG_SHOTS) return ATTACKING_TACTIC.DIRECT;
  if (attacking === ATTACKING_TACTIC.HOLD_UP_PLAY) return ATTACKING_TACTIC.DIRECT;
  return attacking;
};

const getCanonicalDefensiveTactic = (defensive) => {
  if (defensive === DEFENSIVE_TACTIC.ZONAL) return DEFENSIVE_TACTIC.MID_BLOCK;
  return defensive;
};

export const getRatingBandScore = (rating) => {
  if (rating <= 59) return SKILL_BAND.BAD;
  if (rating <= 73) return SKILL_BAND.BELOW_AVERAGE;
  if (rating <= 79) return SKILL_BAND.OK;
  if (rating <= 85) return SKILL_BAND.GOOD;
  if (rating <= 90) return SKILL_BAND.VERY_GOOD;
  return SKILL_BAND.ELITE;
};

export const getMatrixDemandProfile = (style, quality = 0.5) => {
  const q = clamp(quality, 0, 1);

  if (style === TACTIC_STYLE.CONSERVATIVE) {
    // Conservative tactics are deliberately more forgiving for weaker squads.
    return {
      requirementShift: -clamp(0.55 + (1 - q) * 0.45, 0.4, 1.0),
      rewardScale: 0.2,
      penaltyScale: 0.28,
    };
  }

  if (style === TACTIC_STYLE.ADVANCED) {
    // Advanced tactics demand more technical quality; weak teams get punished more.
    return {
      requirementShift: clamp(0.2 + (1 - q) * 0.7, 0.2, 0.95),
      rewardScale: 0.27,
      penaltyScale: 0.62,
    };
  }

  return {
    requirementShift: -clamp(0.2 + (1 - q) * 0.25, 0.15, 0.45),
    rewardScale: 0.23,
    penaltyScale: 0.38,
  };
};

const getRoleSlotCount = (teamProfile, role) => {
  const rolePlayers = teamProfile?.lineup?.[role];
  return Array.isArray(rolePlayers) ? rolePlayers.length : 0;
};

const getWeightedSkillValue = (teamProfile, skill, roleWeights) => {
  const roleAverages = teamProfile?.roleAverages || {};
  const roles = [POSITION.DEF, POSITION.MID, POSITION.FWR];
  let totalWeight = 0;
  let weightedSum = 0;

  roles.forEach((role) => {
    const roleWeight = roleWeights[role] || 0;
    const roleSlots = Math.max(1, getRoleSlotCount(teamProfile, role));
    const weight = roleWeight * roleSlots;
    if (weight <= 0) return;
    const roleSkill = Number(roleAverages?.[role]?.[skill]) || 0;
    weightedSum += roleSkill * weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0) return 0;
  return weightedSum / totalWeight;
};

const getEffectiveRequirement = (requirementBand, profile = MATRIX_IMPACT_PROFILE_DEFAULT) =>
  clamp(requirementBand + (profile.requirementShift || 0), 1, 5);

export const computeMatrixSkillImpact = (rating, requirementBand, profile = MATRIX_IMPACT_PROFILE_DEFAULT) => {
  if (!requirementBand) return 0;

  const effectiveRequirement = getEffectiveRequirement(requirementBand, profile);
  const playerBand = getRatingBandScore(rating);
  const gap = playerBand - effectiveRequirement;
  const baseStrength = effectiveRequirement / 5;
  const rewardScale = profile.rewardScale ?? 0.25;
  const penaltyScale = profile.penaltyScale ?? 0.5;

  if (gap >= 0) {
    return baseStrength * (1 + rewardScale * gap);
  }

  return -baseStrength * (1 + penaltyScale * Math.abs(gap));
};

const computePlayerMatrixSideFit = ({
  player,
  assignedRole,
  tacticMatrix,
  roleInfluence,
}) => {
  if (!player || !tacticMatrix) return 50;

  let rawScore = 0;
  let maxPositive = 0;
  let maxNegative = 0;

  PLAYER_SKILL_KEYS.forEach((skill) => {
    const requirementBand = Number(tacticMatrix[skill]) || 0;
    if (requirementBand <= 0) return;

    const rating = Number(player?.[skill]) || 0;
    rawScore += computeMatrixSkillImpact(rating, requirementBand, MATRIX_IMPACT_PROFILE_DEFAULT);

    const importance = requirementBand / 5;
    maxPositive += importance * (1 + 0.25 * (5 - requirementBand));
    maxNegative += importance * (1 + 0.5 * requirementBand);
  });

  const normalized =
    rawScore >= 0
      ? rawScore / Math.max(1, maxPositive)
      : rawScore / Math.max(1, maxNegative);
  const sideBaseScore = clamp(50 + 50 * normalized, 0, 100);
  const influence = roleInfluence[assignedRole] || roleInfluence[POSITION.MID] || 0.75;
  const fit = applyPositionFit(player.preferredPos, assignedRole);

  return clamp(50 + (sideBaseScore - 50) * influence * fit, 0, 100);
};

export const computePlayerTacticImpactScore = ({ player, assignedRole, tactics }) => {
  if (!player || !assignedRole || !tactics) {
    return {
      attackFit: 50,
      defenseFit: 50,
      trueImpact: 50,
    };
  }

  const attackingMatrix =
    TACTIC_SKILL_MATRIX.attacking[tactics.attacking] ||
    TACTIC_SKILL_MATRIX.attacking[ATTACKING_TACTIC.DIRECT];
  const defensiveMatrix =
    TACTIC_SKILL_MATRIX.defensive[tactics.defensive] ||
    TACTIC_SKILL_MATRIX.defensive[DEFENSIVE_TACTIC.MID_BLOCK];

  const attackFit = computePlayerMatrixSideFit({
    player,
    assignedRole,
    tacticMatrix: attackingMatrix,
    roleInfluence: PLAYER_ATTACK_ROLE_INFLUENCE,
  });
  const defenseFit = computePlayerMatrixSideFit({
    player,
    assignedRole,
    tacticMatrix: defensiveMatrix,
    roleInfluence: PLAYER_DEFENSE_ROLE_INFLUENCE,
  });
  const blend = PLAYER_ROLE_BLEND[assignedRole] || PLAYER_ROLE_BLEND[POSITION.MID];
  const fit = applyPositionFit(player.preferredPos, assignedRole);
  const trueImpact = clamp((attackFit * blend.attack + defenseFit * blend.defense) * fit, 0, 100);

  return {
    attackFit,
    defenseFit,
    trueImpact,
  };
};

const getLineupRolePlayers = (teamProfile, role) => {
  const rolePlayers = teamProfile?.lineupPlayers?.[role];
  return Array.isArray(rolePlayers) ? rolePlayers : [];
};

const computeMatrixSkillSide = ({ teamProfile, matrix, roleWeights, side, impactProfile }) => {
  if (!matrix) {
    return {
      side,
      rawScore: 0,
      normalizedScore: 0,
      maxAbsScore: 1,
      details: [],
    };
  }

  const details = Object.entries(matrix).map(([skill, requirementBand]) => {
    if (requirementBand === 0) {
      return {
        skill,
        requirementBand,
        effectiveRequirement: 0,
        weightedSkill: 0,
        playerBand: SKILL_BAND.BAD,
        gap: 0,
        impact: 0,
      };
    }

    const weightedSkill = getWeightedSkillValue(teamProfile, skill, roleWeights);
    const playerBand = getRatingBandScore(weightedSkill);
    const effectiveRequirement = getEffectiveRequirement(requirementBand, impactProfile);
    const gap = playerBand - effectiveRequirement;
    const impact = computeMatrixSkillImpact(weightedSkill, requirementBand, impactProfile);

    return {
      skill,
      requirementBand,
      effectiveRequirement,
      weightedSkill,
      playerBand,
      gap,
      impact,
    };
  });

  const rawScore = details.reduce((sum, detail) => sum + detail.impact, 0);
  const rewardScale = impactProfile?.rewardScale ?? MATRIX_IMPACT_PROFILE_DEFAULT.rewardScale;
  const penaltyScale = impactProfile?.penaltyScale ?? MATRIX_IMPACT_PROFILE_DEFAULT.penaltyScale;
  const maxPositive = Math.max(
    1,
    details.reduce((sum, detail) => {
      if (!detail.requirementBand) return sum;
      const base = detail.effectiveRequirement / 5;
      return sum + base * (1 + rewardScale * (5 - detail.effectiveRequirement));
    }, 0)
  );
  const maxNegative = Math.max(
    1,
    details.reduce((sum, detail) => {
      if (!detail.requirementBand) return sum;
      const base = detail.effectiveRequirement / 5;
      return sum + base * (1 + penaltyScale * detail.effectiveRequirement);
    }, 0)
  );
  const normalizedScore = clamp(
    rawScore >= 0 ? rawScore / maxPositive : rawScore / maxNegative,
    -1,
    1
  );
  const maxAbsScore = Math.max(maxPositive, maxNegative);

  return {
    side,
    rawScore,
    normalizedScore,
    maxAbsScore,
    details,
  };
};

const computeSkillMatrixDelta = (teamProfile, tactics) => {
  const attackingMatrix = TACTIC_SKILL_MATRIX.attacking[tactics.attacking];
  const defensiveMatrix = TACTIC_SKILL_MATRIX.defensive[tactics.defensive];
  const teamQuality = normalizeTeamQuality(teamProfile);
  const attackingStyle =
    ATTACKING_TACTIC_CONFIG[tactics.attacking]?.style || TACTIC_STYLE.BALANCED;
  const defensiveStyle =
    DEFENSIVE_TACTIC_CONFIG[tactics.defensive]?.style || TACTIC_STYLE.BALANCED;
  const attackingProfile = getMatrixDemandProfile(attackingStyle, teamQuality);
  const defensiveProfile = getMatrixDemandProfile(defensiveStyle, teamQuality);

  const attackingOutcome = computeMatrixSkillSide({
    teamProfile,
    matrix: attackingMatrix,
    roleWeights: ATTACKING_ROLE_WEIGHTS,
    side: "attacking",
    impactProfile: attackingProfile,
  });
  const defensiveOutcome = computeMatrixSkillSide({
    teamProfile,
    matrix: defensiveMatrix,
    roleWeights: DEFENSIVE_ROLE_WEIGHTS,
    side: "defensive",
    impactProfile: defensiveProfile,
  });

  const attackingDelta = scaleDelta(MATRIX_ATTACK_METRIC_SHAPE, attackingOutcome.normalizedScore);
  const defensiveDelta = scaleDelta(MATRIX_DEFENSE_METRIC_SHAPE, defensiveOutcome.normalizedScore);
  const attackingBonusLevel = TACTIC_BONUS_LEVEL.attacking[tactics.attacking] || 1;
  const defensiveBonusLevel = TACTIC_BONUS_LEVEL.defensive[tactics.defensive] || 1;
  const lineupAssignments = [
    ...getLineupRolePlayers(teamProfile, POSITION.DEF).map((player) => ({ player, role: POSITION.DEF })),
    ...getLineupRolePlayers(teamProfile, POSITION.MID).map((player) => ({ player, role: POSITION.MID })),
    ...getLineupRolePlayers(teamProfile, POSITION.FWR).map((player) => ({ player, role: POSITION.FWR })),
    ...getLineupRolePlayers(teamProfile, POSITION.GK).map((player) => ({ player, role: POSITION.GK })),
  ];

  const playerImpacts = lineupAssignments.map(({ player, role }) => ({
    role,
    playerId: player.id,
    ...computePlayerTacticImpactScore({
      player,
      assignedRole: role,
      tactics,
    }),
  }));

  const hasPlayerImpacts = playerImpacts.length > 0;
  const attackingLineupImpact = hasPlayerImpacts
    ? playerImpacts.reduce((sum, row) => sum + (row.attackFit - 50), 0)
    : attackingOutcome.normalizedScore * attackingBonusLevel * 50;
  const defensiveLineupImpact = hasPlayerImpacts
    ? playerImpacts.reduce((sum, row) => sum + (row.defenseFit - 50), 0)
    : defensiveOutcome.normalizedScore * defensiveBonusLevel * 50;
  const netLineupImpact = hasPlayerImpacts
    ? playerImpacts.reduce((sum, row) => sum + (row.trueImpact - 50), 0)
    : attackingLineupImpact + defensiveLineupImpact;
  // Requested conversion:
  // tactic contribution to overall = Net lineup impact / 50
  const tacticSelectionContribution = netLineupImpact / 50;

  return {
    attackingOutcome,
    defensiveOutcome,
    attackingDelta,
    defensiveDelta,
    attackingBonusLevel,
    defensiveBonusLevel,
    playerImpacts,
    attackingLineupImpact,
    defensiveLineupImpact,
    netLineupImpact,
    tacticSelectionContribution,
    // Backwards-compatible aliases used in debug and any existing consumers.
    attackingOverallAdjustment: attackingLineupImpact / 50,
    defensiveOverallAdjustment: defensiveLineupImpact / 50,
    overallBonusAdjustment: tacticSelectionContribution,
    delta: addDeltas(attackingDelta, defensiveDelta),
  };
};

export const computeTacticLineupImpactFromProfile = (teamProfile, tactics) =>
  computeSkillMatrixDelta(teamProfile, tactics);

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
  [ATTACKING_TACTIC.CROSSES]: {
    style: TACTIC_STYLE.BALANCED,
    executionDemand: 0.52,
    baseDelta: Object.freeze({
      control: -0.04,
      buildUp: 0.07,
      threat: 0.09,
    }),
    masteryDelta: Object.freeze({
      buildUp: 0.02,
      threat: 0.03,
    }),
    failureDelta: Object.freeze({
      control: -0.03,
      threat: -0.04,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      const def = getDef(team);
      const fwr = getFwr(team);
      return 0.32 * fwr.finishing + 0.28 * fwr.offBall + 0.28 * mid.passing + 0.12 * def.passing;
    },
    getResist: (opponent) => {
      const oppDef = getDef(opponent);
      const oppMid = getMid(opponent);
      const oppGk = getGk(opponent);
      return 0.55 * oppDef.defending + 0.25 * oppMid.defending + 0.2 * oppGk.goalkeeping;
    },
  },
  [ATTACKING_TACTIC.TIKI_TAKA]: {
    style: TACTIC_STYLE.ADVANCED,
    executionDemand: 0.82,
    baseDelta: Object.freeze({
      control: 0.12,
      buildUp: 0.11,
      threat: 0.01,
    }),
    masteryDelta: Object.freeze({
      control: 0.08,
      buildUp: 0.08,
      threat: 0.04,
    }),
    failureDelta: Object.freeze({
      control: -0.12,
      buildUp: -0.11,
      threat: -0.05,
      resistance: -0.04,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      const fwr = getFwr(team);
      return 0.34 * mid.passing + 0.34 * mid.control + 0.2 * fwr.offBall + 0.12 * mid.workRate;
    },
    getResist: (opponent) => {
      const oppMid = getMid(opponent);
      const oppDef = getDef(opponent);
      return 0.4 * oppMid.defending + 0.35 * oppDef.defending + 0.25 * opponent.metrics.control;
    },
  },
  [ATTACKING_TACTIC.LONG_SHOTS]: {
    style: TACTIC_STYLE.BALANCED,
    executionDemand: 0.5,
    baseDelta: Object.freeze({
      control: -0.04,
      buildUp: -0.01,
      threat: 0.1,
    }),
    masteryDelta: Object.freeze({
      threat: 0.05,
    }),
    failureDelta: Object.freeze({
      control: -0.03,
      buildUp: -0.03,
      threat: -0.04,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      const fwr = getFwr(team);
      return 0.5 * fwr.finishing + 0.2 * mid.finishing + 0.2 * mid.control + 0.1 * mid.passing;
    },
    getResist: (opponent) => {
      const oppDef = getDef(opponent);
      const oppGk = getGk(opponent);
      return 0.5 * oppDef.defending + 0.5 * oppGk.goalkeeping;
    },
  },
  [ATTACKING_TACTIC.HOLD_UP_PLAY]: {
    style: TACTIC_STYLE.CONSERVATIVE,
    executionDemand: 0.48,
    baseDelta: Object.freeze({
      control: 0.04,
      buildUp: 0.06,
      threat: 0.03,
      resistance: 0.02,
    }),
    masteryDelta: Object.freeze({
      buildUp: 0.03,
      threat: 0.02,
      resistance: 0.02,
    }),
    supportDelta: Object.freeze({
      control: 0.02,
      buildUp: 0.02,
    }),
    failureDelta: Object.freeze({
      control: -0.03,
      buildUp: -0.03,
      threat: -0.02,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      const fwr = getFwr(team);
      return 0.35 * fwr.control + 0.3 * fwr.offBall + 0.2 * fwr.passing + 0.15 * mid.offBall;
    },
    getResist: (opponent) => {
      const oppDef = getDef(opponent);
      const oppMid = getMid(opponent);
      return 0.55 * oppDef.defending + 0.25 * oppMid.defending + 0.2 * opponent.metrics.control;
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
  [DEFENSIVE_TACTIC.ZONAL]: {
    style: TACTIC_STYLE.BALANCED,
    executionDemand: 0.52,
    baseDelta: Object.freeze({
      control: 0.03,
      buildUp: -0.01,
      resistance: 0.06,
    }),
    masteryDelta: Object.freeze({
      resistance: 0.03,
      control: 0.02,
    }),
    failureDelta: Object.freeze({
      resistance: -0.04,
      control: -0.02,
    }),
    getExec: (team) => {
      const mid = getMid(team);
      const def = getDef(team);
      return 0.4 * def.defending + 0.35 * mid.control + 0.25 * mid.workRate;
    },
    getResist: (opponent) => {
      const oppMid = getMid(opponent);
      return 0.55 * oppMid.passing + 0.45 * opponent.metrics.threat;
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
  if (!config) {
    return {
      execScore: 0,
      resistScore: 0,
      tacticPower: 0.5,
      modifier: 0,
      readiness: computeTeamReadiness(team),
      executionDemand: 0,
      style: TACTIC_STYLE.BALANCED,
      factors: { masteryFactor: 0, failureFactor: 0, supportFactor: 0 },
      masteryDelta: createDeltaShape(),
      supportDelta: createDeltaShape(),
      failureDelta: createDeltaShape(),
      delta: createDeltaShape(),
    };
  }

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

  if (attacking === ATTACKING_TACTIC.LONG_SHOTS) {
    return clamp((0.5 * fwr.finishing + 0.25 * mid.finishing + 0.2 * mid.control + 0.05 * mid.passing) / 100, 0, 1);
  }

  if (attacking === ATTACKING_TACTIC.HOLD_UP_PLAY) {
    return clamp((0.35 * fwr.control + 0.3 * fwr.offBall + 0.2 * fwr.passing + 0.15 * mid.offBall) / 100, 0, 1);
  }

  if (attacking === ATTACKING_TACTIC.CROSSES) {
    return clamp((0.36 * mid.passing + 0.34 * fwr.finishing + 0.3 * fwr.offBall) / 100, 0, 1);
  }

  if (attacking === ATTACKING_TACTIC.TIKI_TAKA) {
    return clamp((0.42 * mid.passing + 0.4 * mid.control + 0.18 * fwr.offBall) / 100, 0, 1);
  }

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

  if (defensive === DEFENSIVE_TACTIC.ZONAL) {
    return clamp((0.4 * def.defending + 0.35 * mid.control + 0.15 * mid.workRate + 0.1 * gk.goalkeeping) / 100, 0, 1);
  }

  return clamp((0.46 * def.defending + 0.3 * mid.defending + 0.24 * mid.workRate) / 100, 0, 1);
};

const computeSynergyDelta = (teamProfile, attacking, defensive) => {
  const canonicalAttacking = getCanonicalAttackingTactic(attacking);
  const canonicalDefensive = getCanonicalDefensiveTactic(defensive);
  const pairKey = getPairKey(canonicalDefensive, canonicalAttacking);
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

  const attackKey = `${getCanonicalAttackingTactic(teamTactics.attacking)}|${getCanonicalDefensiveTactic(opponentTactics.defensive)}`;
  const defenseKey = `${getCanonicalDefensiveTactic(teamTactics.defensive)}|${getCanonicalAttackingTactic(opponentTactics.attacking)}`;
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
  const skillMatrixOutcome = computeSkillMatrixDelta(teamProfile, tactics);
  const synergyOutcome = computeSynergyDelta(teamProfile, attacking, defensive);
  const synergyDelta = synergyOutcome.delta;
  const matchupOutcome = computeMatchupDelta(tactics, opponentTactics, computeTeamReadiness(teamProfile));

  const totalDelta = addDeltas(
    addDeltas(addDeltas(addDeltas(attackOutcome.delta, defenseOutcome.delta), skillMatrixOutcome.delta), synergyDelta),
    matchupOutcome.delta
  );
  const adjustedMetrics = clampMetrics(addDeltas(teamProfile.metrics, totalDelta));
  // Keep adjusted metrics for match simulation phases, but compute displayed/base match
  // overall from non-tactic core profile so tactic selection is applied only once.
  const baseOverallRatingBreakdown = computeOverallRatingBreakdown(
    teamProfile.metrics,
    teamProfile.finishingIndex,
    teamProfile.gkIndex
  );
  const overallRating = clamp(
    baseOverallRatingBreakdown.total + skillMatrixOutcome.tacticSelectionContribution,
    0,
    99
  );
  const overallRatingBreakdown = {
    ...baseOverallRatingBreakdown,
    tacticBonus: skillMatrixOutcome.tacticSelectionContribution,
    tacticSelectionContribution: skillMatrixOutcome.tacticSelectionContribution,
    netLineupImpact: skillMatrixOutcome.netLineupImpact,
    total: overallRating,
  };

  return {
    ...teamProfile,
    adjustedMetrics,
    overallRating,
    overallRatingBreakdown,
    tactics,
    tacticBreakdown: {
      attackOutcome,
      defenseOutcome,
      skillMatrixOutcome,
      synergyDelta,
      synergyOutcome,
      matchupOutcome,
      totalDelta,
    },
  };
};
