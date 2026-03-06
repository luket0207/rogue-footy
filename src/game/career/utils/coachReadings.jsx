import { applyPositionFit } from "../../../features/matchSim/utils/ratings";
import { ATTACKING_TACTIC, DEFENSIVE_TACTIC, POSITION } from "../../../features/matchSim/utils/matchSimTypes";
import { computePlayerTacticImpactScore } from "../../../features/matchSim/utils/tactics";

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

const getExactTierLabel = (score) => {
  if (score >= 91) return "world class";
  if (score >= 86) return "elite";
  if (score >= 80) return "very good";
  if (score >= 74) return "good";
  if (score >= 60) return "ok";
  if (score >= 45) return "mixed";
  return "poor";
};

const getFeedbackForDepth = (impactScore, depth) => {
  if (depth <= 1) return "";

  if (depth === 2) {
    if (impactScore >= 74) return "Looks good.";
    if (impactScore >= 56) return "Could be okay.";
    return "Looks weak.";
  }

  if (depth === 3) {
    if (impactScore >= 84) return "Great fit.";
    if (impactScore >= 66) return "Good fit.";
    if (impactScore >= 48) return "Mixed fit.";
    return "Poor fit.";
  }

  if (depth === 4) {
    if (impactScore >= 90) return "Amazing fit.";
    if (impactScore >= 76) return "Great fit.";
    if (impactScore >= 62) return "Good fit.";
    if (impactScore >= 46) return "Mixed fit.";
    return "Very poor fit.";
  }

  const exact = Math.round(impactScore);
  return `Exact impact ${exact}/100 (${getExactTierLabel(exact)}).`;
};

export const createCoachAssessment = ({ player, assignedRole, tactics, coachRatings }) => {
  const resolvedTactics = {
    attacking: tactics?.attacking || ATTACKING_TACTIC.DIRECT,
    defensive: tactics?.defensive || DEFENSIVE_TACTIC.LOW_BLOCK,
  };
  const impact = computePlayerTacticImpactScore({
    player,
    assignedRole,
    tactics: resolvedTactics,
  });
  const attack = impact.attackFit;
  const defense = impact.defenseFit;
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
