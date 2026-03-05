import { getRoleSelectionScore } from "../../../features/matchSim/utils/ratings";
import { OUTFIELD_POSITIONS, POSITION } from "../../../features/matchSim/utils/matchSimTypes";

export const CAREER_FORMATIONS = Object.freeze({
  "1-2-2": Object.freeze({
    [POSITION.DEF]: 1,
    [POSITION.MID]: 2,
    [POSITION.FWR]: 2,
  }),
  "2-2-1": Object.freeze({
    [POSITION.DEF]: 2,
    [POSITION.MID]: 2,
    [POSITION.FWR]: 1,
  }),
  "2-1-2": Object.freeze({
    [POSITION.DEF]: 2,
    [POSITION.MID]: 1,
    [POSITION.FWR]: 2,
  }),
  "1-3-1": Object.freeze({
    [POSITION.DEF]: 1,
    [POSITION.MID]: 3,
    [POSITION.FWR]: 1,
  }),
});

export const CAREER_FORMATION_KEYS = Object.freeze(Object.keys(CAREER_FORMATIONS));
export const DEFAULT_CAREER_FORMATION = "2-2-1";

export const isValidCareerFormation = (formation) =>
  Object.prototype.hasOwnProperty.call(CAREER_FORMATIONS, formation);

export const getCareerFormationCounts = (formation) =>
  CAREER_FORMATIONS[formation] || CAREER_FORMATIONS[DEFAULT_CAREER_FORMATION];

export const createEmptyCareerLineup = (formation = DEFAULT_CAREER_FORMATION) => {
  const counts = getCareerFormationCounts(formation);
  return {
    gkId: "",
    [POSITION.DEF]: Array(counts[POSITION.DEF]).fill(""),
    [POSITION.MID]: Array(counts[POSITION.MID]).fill(""),
    [POSITION.FWR]: Array(counts[POSITION.FWR]).fill(""),
  };
};

export const normalizeCareerLineup = (lineup, formation = DEFAULT_CAREER_FORMATION) => {
  const counts = getCareerFormationCounts(formation);
  const normalized = {
    gkId: lineup?.gkId || "",
  };

  OUTFIELD_POSITIONS.forEach((role) => {
    const existing = Array.isArray(lineup?.[role]) ? lineup[role] : [];
    normalized[role] = existing.slice(0, counts[role]);
    while (normalized[role].length < counts[role]) {
      normalized[role].push("");
    }
  });

  return normalized;
};

export const getCareerLineupPlayerIds = (lineup) => [
  lineup?.gkId || "",
  ...(Array.isArray(lineup?.[POSITION.DEF]) ? lineup[POSITION.DEF] : []),
  ...(Array.isArray(lineup?.[POSITION.MID]) ? lineup[POSITION.MID] : []),
  ...(Array.isArray(lineup?.[POSITION.FWR]) ? lineup[POSITION.FWR] : []),
].filter(Boolean);

export const hasDuplicateCareerLineupPlayers = (lineup) => {
  const ids = getCareerLineupPlayerIds(lineup);
  return new Set(ids).size !== ids.length;
};

export const isCareerLineupComplete = (lineup, formation, validIds = null) => {
  const normalized = normalizeCareerLineup(lineup, formation);
  const ids = getCareerLineupPlayerIds(normalized);
  const counts = getCareerFormationCounts(formation);
  const requiredCount =
    1 + counts[POSITION.DEF] + counts[POSITION.MID] + counts[POSITION.FWR];

  if (ids.length !== requiredCount) return false;
  if (new Set(ids).size !== ids.length) return false;
  if (validIds && ids.some((playerId) => !validIds.has(playerId))) return false;
  return true;
};

const toLegacyOrderLineup = (legacyLineup) => ({
  gkId: legacyLineup?.GK || "",
  [POSITION.DEF]: [legacyLineup?.DEF1 || "", legacyLineup?.DEF2 || ""].filter(Boolean),
  [POSITION.MID]: [legacyLineup?.MID1 || "", legacyLineup?.MID2 || ""].filter(Boolean),
  [POSITION.FWR]: [legacyLineup?.FWD || ""].filter(Boolean),
});

export const createCareerLineupFromLegacySlots = (
  legacyLineup,
  formation = DEFAULT_CAREER_FORMATION
) => normalizeCareerLineup(toLegacyOrderLineup(legacyLineup), formation);

const toRoleCandidates = (players, role) =>
  [...players].sort((playerA, playerB) => {
    const delta =
      getRoleSelectionScore(playerB, role) - getRoleSelectionScore(playerA, role);
    if (delta !== 0) return delta;
    return (Number(playerB.overall) || 0) - (Number(playerA.overall) || 0);
  });

export const autoFillCareerLineup = (
  players,
  formation = DEFAULT_CAREER_FORMATION
) => {
  const lineup = createEmptyCareerLineup(formation);
  const remaining = Array.isArray(players) ? [...players] : [];

  const pickAndRemove = (role) => {
    if (remaining.length === 0) return "";
    const sorted = toRoleCandidates(remaining, role);
    const pick = sorted[0];
    if (!pick) return "";
    const index = remaining.findIndex((player) => player.id === pick.id);
    if (index >= 0) remaining.splice(index, 1);
    return pick.id;
  };

  lineup.gkId = pickAndRemove(POSITION.GK);
  OUTFIELD_POSITIONS.forEach((role) => {
    lineup[role] = lineup[role].map(() => pickAndRemove(role));
  });

  return lineup;
};

export const lineupToLegacySlots = (lineup) => {
  const normalized = normalizeCareerLineup(lineup, DEFAULT_CAREER_FORMATION);
  return {
    GK: normalized.gkId || "",
    DEF1: normalized[POSITION.DEF][0] || "",
    DEF2: normalized[POSITION.DEF][1] || "",
    MID1: normalized[POSITION.MID][0] || "",
    MID2: normalized[POSITION.MID][1] || "",
    FWD: normalized[POSITION.FWR][0] || "",
  };
};
