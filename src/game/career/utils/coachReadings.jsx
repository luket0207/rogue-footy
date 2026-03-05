import { applyPositionFit } from "../../../features/matchSim/utils/ratings";
import { ATTACKING_TACTIC, DEFENSIVE_TACTIC, POSITION } from "../../../features/matchSim/utils/matchSimTypes";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const ROLE_BLEND = Object.freeze({
  [POSITION.GK]: Object.freeze({ attack: 0.2, defense: 0.8 }),
  [POSITION.DEF]: Object.freeze({ attack: 0.35, defense: 0.65 }),
  [POSITION.MID]: Object.freeze({ attack: 0.55, defense: 0.45 }),
  [POSITION.FWR]: Object.freeze({ attack: 0.7, defense: 0.3 }),
});

const getCoachDepthForRole = (assignedRole, coachRatings) => {
  if (assignedRole === POSITION.GK || assignedRole === POSITION.DEF) {
    return clamp(Number(coachRatings?.DEF) || 1, 1, 5);
  }
  if (assignedRole === POSITION.MID) {
    return clamp(Number(coachRatings?.MID) || 1, 1, 5);
  }
  return clamp(Number(coachRatings?.FWR) || 1, 1, 5);
};

const getAttackFit = (player, role, attacking) => {
  const finishing = Number(player?.finishing) || 0;
  const passing = Number(player?.passing) || 0;
  const control = Number(player?.control) || 0;
  const defending = Number(player?.defending) || 0;
  const offBall = Number(player?.offBall) || 0;
  const workRate = Number(player?.workRate) || 0;

  if (attacking === ATTACKING_TACTIC.POSSESSION) {
    const base = 0.36 * passing + 0.34 * control + 0.2 * workRate + 0.1 * offBall;
    const roleAdjust =
      role === POSITION.MID ? 7 : role === POSITION.DEF ? -4 : role === POSITION.FWR ? -1 : -10;
    return clamp(base + roleAdjust, 0, 100);
  }

  if (attacking === ATTACKING_TACTIC.COUNTER) {
    const base = 0.4 * offBall + 0.3 * finishing + 0.2 * control + 0.1 * workRate;
    const roleAdjust =
      role === POSITION.FWR ? 7 : role === POSITION.MID ? 3 : role === POSITION.DEF ? -5 : -15;
    return clamp(base + roleAdjust, 0, 100);
  }

  // DIRECT
  const base = 0.44 * finishing + 0.24 * offBall + 0.2 * passing + 0.12 * control;
  const roleAdjust =
    role === POSITION.FWR ? 8 : role === POSITION.MID ? 1 : role === POSITION.DEF ? -6 : -16;
  return clamp(base + roleAdjust + defending * 0.02, 0, 100);
};

const getDefenseFit = (player, role, defensive) => {
  const passing = Number(player?.passing) || 0;
  const control = Number(player?.control) || 0;
  const defending = Number(player?.defending) || 0;
  const offBall = Number(player?.offBall) || 0;
  const workRate = Number(player?.workRate) || 0;
  const goalkeeping = Number(player?.goalkeeping) || 0;

  if (role === POSITION.GK) {
    if (defensive === DEFENSIVE_TACTIC.LOW_BLOCK) {
      return clamp(0.7 * goalkeeping + 0.2 * control + 0.1 * passing, 0, 100);
    }
    if (defensive === DEFENSIVE_TACTIC.HIGH_PRESS) {
      return clamp(0.42 * goalkeeping + 0.3 * passing + 0.28 * control, 0, 100);
    }
    return clamp(0.54 * goalkeeping + 0.24 * control + 0.22 * passing, 0, 100);
  }

  if (defensive === DEFENSIVE_TACTIC.HIGH_PRESS) {
    const base = 0.36 * workRate + 0.32 * defending + 0.2 * offBall + 0.12 * control;
    const roleAdjust =
      role === POSITION.MID ? 7 : role === POSITION.DEF ? 3 : role === POSITION.FWR ? -3 : -12;
    return clamp(base + roleAdjust, 0, 100);
  }

  if (defensive === DEFENSIVE_TACTIC.LOW_BLOCK) {
    const base = 0.44 * defending + 0.28 * workRate + 0.18 * control + 0.1 * goalkeeping;
    const roleAdjust =
      role === POSITION.DEF ? 5 : role === POSITION.MID ? 1 : role === POSITION.FWR ? -6 : 0;
    return clamp(base + roleAdjust, 0, 100);
  }

  // MID_BLOCK
  const base = 0.42 * defending + 0.3 * workRate + 0.16 * control + 0.12 * passing;
  const roleAdjust =
    role === POSITION.DEF ? 6 : role === POSITION.MID ? 2 : role === POSITION.FWR ? -5 : -10;
  return clamp(base + roleAdjust, 0, 100);
};

const getExactTierLabel = (score) => {
  if (score >= 85) return "elite";
  if (score >= 70) return "strong";
  if (score >= 55) return "good";
  if (score >= 40) return "mixed";
  return "poor";
};

const getFeedbackForDepth = (impactScore, depth) => {
  if (depth <= 1) return "";

  if (depth === 2) {
    return impactScore > 50 ? "Good fit." : "Bad fit.";
  }

  if (depth === 3) {
    if (impactScore > 80) return "Great fit.";
    if (impactScore > 50) return "Good fit.";
    return "Bad fit.";
  }

  if (depth === 4) {
    if (impactScore > 80) return "Amazing fit.";
    if (impactScore > 60) return "Great fit.";
    if (impactScore > 30) return "Mixed fit.";
    return "Bad, really bad.";
  }

  const exact = Math.round(impactScore);
  return `Exact impact ${exact}/100 (${getExactTierLabel(exact)}).`;
};

export const createCoachAssessment = ({ player, assignedRole, tactics, coachRatings }) => {
  const attack = getAttackFit(player, assignedRole, tactics?.attacking);
  const defense = getDefenseFit(player, assignedRole, tactics?.defensive);
  const blend = ROLE_BLEND[assignedRole] || ROLE_BLEND[POSITION.MID];
  const positionFit = applyPositionFit(player?.preferredPos, assignedRole);
  const trueImpact = clamp((attack * blend.attack + defense * blend.defense) * positionFit, 0, 100);
  const detailLevel = getCoachDepthForRole(assignedRole, coachRatings);
  const feedbackText = getFeedbackForDepth(trueImpact, detailLevel);

  return {
    trueImpact: Math.round(trueImpact),
    detailLevel,
    hasInfo: detailLevel > 1,
    feedbackText,
  };
};
