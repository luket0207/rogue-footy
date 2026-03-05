import { average, clamp, clamp01, safeDivide } from "./math";
import { FORMATIONS, OUTFIELD_POSITIONS, POSITION } from "./matchSimTypes";

const ATTRIBUTE_KEYS = Object.freeze([
  "finishing",
  "passing",
  "control",
  "defending",
  "offBall",
  "workRate",
  "goalkeeping",
]);

const ZERO_ATTRIBUTES = Object.freeze({
  finishing: 0,
  passing: 0,
  control: 0,
  defending: 0,
  offBall: 0,
  workRate: 0,
  goalkeeping: 0,
});

const ROLE_MULTIPLIERS = Object.freeze({
  [POSITION.DEF]: Object.freeze({
    finishing: 0.6,
    passing: 0.7,
    control: 0.8,
    defending: 1.0,
    offBall: 0.7,
    workRate: 1.0,
    goalkeeping: 0.05,
  }),
  [POSITION.MID]: Object.freeze({
    finishing: 0.8,
    passing: 1.0,
    control: 1.0,
    defending: 0.7,
    offBall: 1.0,
    workRate: 1.0,
    goalkeeping: 0.05,
  }),
  [POSITION.FWR]: Object.freeze({
    finishing: 1.0,
    passing: 0.7,
    control: 0.9,
    defending: 0.4,
    offBall: 1.0,
    workRate: 0.9,
    goalkeeping: 0.05,
  }),
  [POSITION.GK]: Object.freeze({
    finishing: 0.1,
    passing: 0.3,
    control: 0.3,
    defending: 0.2,
    offBall: 0.1,
    workRate: 0.4,
    goalkeeping: 1.0,
  }),
});

const ATTRIBUTES_BY_ROLE_FOR_AUTOFILL = Object.freeze({
  [POSITION.GK]: Object.freeze({
    goalkeeping: 0.82,
    passing: 0.1,
    control: 0.05,
    workRate: 0.03,
  }),
  [POSITION.DEF]: Object.freeze({
    defending: 0.62,
    passing: 0.15,
    control: 0.12,
    workRate: 0.11,
  }),
  [POSITION.MID]: Object.freeze({
    passing: 0.34,
    control: 0.3,
    offBall: 0.18,
    workRate: 0.1,
    defending: 0.08,
  }),
  [POSITION.FWR]: Object.freeze({
    finishing: 0.55,
    offBall: 0.22,
    control: 0.1,
    passing: 0.08,
    workRate: 0.05,
  }),
});

export const playersArrayToMap = (players) =>
  players.reduce((result, player) => {
    result[player.id] = player;
    return result;
  }, {});

export const computeOverallRating = (metrics, finishingIndex, gkIndex) =>
  computeOverallRatingBreakdown(metrics, finishingIndex, gkIndex).total;

export const computeOverallRatingBreakdown = (metrics, finishingIndex, gkIndex) => {
  const control = 0.22 * metrics.control;
  const buildUp = 0.2 * metrics.buildUp;
  const threat = 0.23 * metrics.threat;
  const resistance = 0.2 * metrics.resistance;
  const finishing = 0.1 * finishingIndex;
  const goalkeeping = 0.05 * gkIndex;

  return {
    control,
    buildUp,
    threat,
    resistance,
    finishing,
    goalkeeping,
    total: clamp(control + buildUp + threat + resistance + finishing + goalkeeping, 0, 99),
  };
};

export const applyPositionFit = (preferredPos, assignedRole) => {
  if (preferredPos === assignedRole) return 1.0;

  if (preferredPos === POSITION.GK && assignedRole !== POSITION.GK) return 0.4;
  if (preferredPos !== POSITION.GK && assignedRole === POSITION.GK) return 0.1;

  if (
    (preferredPos === POSITION.DEF && assignedRole === POSITION.MID) ||
    (preferredPos === POSITION.MID && assignedRole === POSITION.DEF)
  ) {
    return 0.9;
  }

  if (
    (preferredPos === POSITION.MID && assignedRole === POSITION.FWR) ||
    (preferredPos === POSITION.FWR && assignedRole === POSITION.MID)
  ) {
    return 0.9;
  }

  if (
    (preferredPos === POSITION.DEF && assignedRole === POSITION.FWR) ||
    (preferredPos === POSITION.FWR && assignedRole === POSITION.DEF)
  ) {
    return 0.75;
  }

  return 0.75;
};

export const applyRoleMultipliers = (player, role) => {
  const multipliers = ROLE_MULTIPLIERS[role] || ROLE_MULTIPLIERS[POSITION.MID];
  const result = {};

  ATTRIBUTE_KEYS.forEach((attributeKey) => {
    result[attributeKey] = player[attributeKey] * multipliers[attributeKey];
  });

  return result;
};

const addAttributes = (current, toAdd) => {
  const result = { ...current };

  ATTRIBUTE_KEYS.forEach((attributeKey) => {
    result[attributeKey] = (result[attributeKey] || 0) + (toAdd[attributeKey] || 0);
  });

  return result;
};

const scaleAttributes = (attributes, scalar) => {
  const result = {};

  ATTRIBUTE_KEYS.forEach((attributeKey) => {
    result[attributeKey] = clamp(attributes[attributeKey] * scalar, 0, 100);
  });

  return result;
};

const getRoleLoadFactor = (slotCount) => 1 + (slotCount - 2) * 0.08;

const aggregateRoleAttributes = (playerIds, role, playersById, slotCount) => {
  const validPlayers = playerIds
    .map((playerId) => playersById[playerId])
    .filter((player) => player != null);

  if (validPlayers.length === 0) {
    return {
      ...ZERO_ATTRIBUTES,
      quality: 0,
      count: 0,
    };
  }

  const summed = validPlayers.reduce((acc, player) => {
    const fit = applyPositionFit(player.preferredPos, role);
    const byRole = applyRoleMultipliers(player, role);

    const adjusted = {};
    ATTRIBUTE_KEYS.forEach((attributeKey) => {
      adjusted[attributeKey] = byRole[attributeKey] * fit;
    });

    return addAttributes(acc, adjusted);
  }, { ...ZERO_ATTRIBUTES });

  const averaged = scaleAttributes(summed, 1 / validPlayers.length);
  const loadAdjusted = scaleAttributes(averaged, getRoleLoadFactor(slotCount));

  return {
    ...loadAdjusted,
    quality: average([loadAdjusted.control, loadAdjusted.passing, loadAdjusted.workRate]),
    count: validPlayers.length,
  };
};

const getFormationCounts = (formationKey, lineup) => {
  if (FORMATIONS[formationKey]) return FORMATIONS[formationKey];
  return {
    [POSITION.DEF]: Math.max(
      0,
      Array.isArray(lineup?.[POSITION.DEF]) ? lineup[POSITION.DEF].length : 0
    ),
    [POSITION.MID]: Math.max(
      0,
      Array.isArray(lineup?.[POSITION.MID]) ? lineup[POSITION.MID].length : 0
    ),
    [POSITION.FWR]: Math.max(
      0,
      Array.isArray(lineup?.[POSITION.FWR]) ? lineup[POSITION.FWR].length : 0
    ),
  };
};

const getWeightedOffBall = (roleAverages, counts) => {
  const totalSlots =
    counts[POSITION.DEF] + counts[POSITION.MID] + counts[POSITION.FWR];
  if (totalSlots <= 0) return 0;

  const weighted =
    roleAverages[POSITION.DEF].offBall * counts[POSITION.DEF] +
    roleAverages[POSITION.MID].offBall * counts[POSITION.MID] +
    roleAverages[POSITION.FWR].offBall * counts[POSITION.FWR];

  return safeDivide(weighted, totalSlots);
};

export const getRoleSelectionScore = (player, role) => {
  const roleWeights = ATTRIBUTES_BY_ROLE_FOR_AUTOFILL[role];
  const fit = applyPositionFit(player.preferredPos, role);
  const preferredBonus = player.preferredPos === role ? 4 : 0;

  const weightedScore = Object.entries(roleWeights).reduce(
    (score, [attribute, weight]) => score + player[attribute] * weight,
    0
  );

  return weightedScore * fit + preferredBonus;
};

export const computeTeamProfile = (teamConfig, playersById) => {
  const { formation, lineup } = teamConfig;
  const counts = getFormationCounts(formation, lineup);

  const roleAverages = {
    [POSITION.DEF]: aggregateRoleAttributes(
      lineup[POSITION.DEF],
      POSITION.DEF,
      playersById,
      counts[POSITION.DEF]
    ),
    [POSITION.MID]: aggregateRoleAttributes(
      lineup[POSITION.MID],
      POSITION.MID,
      playersById,
      counts[POSITION.MID]
    ),
    [POSITION.FWR]: aggregateRoleAttributes(
      lineup[POSITION.FWR],
      POSITION.FWR,
      playersById,
      counts[POSITION.FWR]
    ),
  };

  const gkPlayer = playersById[lineup.gkId];
  const gkFit = gkPlayer ? applyPositionFit(gkPlayer.preferredPos, POSITION.GK) : 0;
  const gkRoleValues = gkPlayer ? applyRoleMultipliers(gkPlayer, POSITION.GK) : ZERO_ATTRIBUTES;
  const gkGoalkeeping = gkRoleValues.goalkeeping * gkFit;
  const gkBuildSupport = (gkRoleValues.passing * 0.6 + gkRoleValues.control * 0.4) * gkFit;

  const controlBreakdown = {
    midControl: 0.6 * roleAverages[POSITION.MID].control,
    defControl: 0.2 * roleAverages[POSITION.DEF].control,
    fwrControl: 0.2 * roleAverages[POSITION.FWR].control,
    gkSupport: 0.05 * gkBuildSupport,
  };
  const buildUpBreakdown = {
    midPassing: 0.5 * roleAverages[POSITION.MID].passing,
    fwrOffBall: 0.35 * roleAverages[POSITION.FWR].offBall,
    defPassing: 0.15 * roleAverages[POSITION.DEF].passing,
    gkSupport: 0.05 * gkBuildSupport,
  };
  const threatBreakdown = {
    fwrFinishing: 0.65 * roleAverages[POSITION.FWR].finishing,
    midPassing: 0.25 * roleAverages[POSITION.MID].passing,
    midOffBall: 0.1 * roleAverages[POSITION.MID].offBall,
  };
  const resistanceBreakdown = {
    defDefending: 0.55 * roleAverages[POSITION.DEF].defending,
    midDefending: 0.25 * roleAverages[POSITION.MID].defending,
    gkGoalkeeping: 0.2 * gkGoalkeeping,
  };

  // Core phase metrics used by possession, chance creation and resistance formulas.
  const baseMetrics = {
    control: clamp(controlBreakdown.midControl + controlBreakdown.defControl + controlBreakdown.fwrControl + controlBreakdown.gkSupport, 10, 98),
    buildUp: clamp(buildUpBreakdown.midPassing + buildUpBreakdown.fwrOffBall + buildUpBreakdown.defPassing + buildUpBreakdown.gkSupport, 10, 98),
    threat: clamp(threatBreakdown.fwrFinishing + threatBreakdown.midPassing + threatBreakdown.midOffBall, 10, 98),
    resistance: clamp(resistanceBreakdown.defDefending + resistanceBreakdown.midDefending + resistanceBreakdown.gkGoalkeeping, 10, 98),
  };

  const teamOffBall = getWeightedOffBall(roleAverages, counts);
  const coherence = clamp01(
    (roleAverages[POSITION.MID].workRate + roleAverages[POSITION.MID].control + teamOffBall) / 300
  );
  const finishingIndex = clamp(
    0.85 * roleAverages[POSITION.FWR].finishing +
      0.15 * roleAverages[POSITION.MID].finishing,
    8,
    98
  );
  const gkIndex = clamp(gkGoalkeeping, 8, 98);
  const overallRatingBreakdown = computeOverallRatingBreakdown(baseMetrics, finishingIndex, gkIndex);

  return {
    teamName: teamConfig.name,
    formation,
    lineup,
    roleAverages,
    gk: {
      goalkeeping: gkGoalkeeping,
      passingSupport: gkBuildSupport,
    },
    metrics: baseMetrics,
    finishingIndex,
    gkIndex,
    teamOffBall,
    coherence,
    overallRating: overallRatingBreakdown.total,
    overallRatingBreakdown,
    metricBreakdown: {
      control: { ...controlBreakdown, total: baseMetrics.control },
      buildUp: { ...buildUpBreakdown, total: baseMetrics.buildUp },
      threat: { ...threatBreakdown, total: baseMetrics.threat },
      resistance: { ...resistanceBreakdown, total: baseMetrics.resistance },
    },
  };
};

export const getRoleOrder = () => [...OUTFIELD_POSITIONS];
