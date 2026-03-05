import { FORMATIONS, OUTFIELD_POSITIONS, POSITION } from "./matchSimTypes";
import { applyPositionFit, getRoleSelectionScore } from "./ratings";

export const createEmptyLineup = (formation) => {
  const roleCounts = FORMATIONS[formation];

  return {
    gkId: "",
    [POSITION.DEF]: Array(roleCounts[POSITION.DEF]).fill(""),
    [POSITION.MID]: Array(roleCounts[POSITION.MID]).fill(""),
    [POSITION.FWR]: Array(roleCounts[POSITION.FWR]).fill(""),
  };
};

export const normalizeLineupForFormation = (lineup, formation) => {
  const roleCounts = FORMATIONS[formation];

  const nextLineup = {
    gkId: lineup?.gkId || "",
  };

  OUTFIELD_POSITIONS.forEach((role) => {
    const current = Array.isArray(lineup?.[role]) ? lineup[role] : [];
    const expectedCount = roleCounts[role];
    nextLineup[role] = current.slice(0, expectedCount);

    while (nextLineup[role].length < expectedCount) {
      nextLineup[role].push("");
    }
  });

  return nextLineup;
};

export const getLineupPlayerIds = (lineup) => [
  lineup.gkId,
  ...lineup[POSITION.DEF],
  ...lineup[POSITION.MID],
  ...lineup[POSITION.FWR],
].filter(Boolean);

export const hasDuplicateLineupPlayers = (lineup) => {
  const ids = getLineupPlayerIds(lineup);
  return new Set(ids).size !== ids.length;
};

export const isLineupComplete = (lineup, formation) => {
  if (!lineup?.gkId) return false;

  const roleCounts = FORMATIONS[formation];
  const hasMissingSlot = OUTFIELD_POSITIONS.some((role) => {
    const ids = lineup[role] || [];
    if (ids.length !== roleCounts[role]) return true;
    return ids.some((playerId) => !playerId);
  });

  if (hasMissingSlot) return false;
  if (hasDuplicateLineupPlayers(lineup)) return false;

  return true;
};

const pickPlayerForRole = (availablePlayers, role, offset = 0) => {
  if (availablePlayers.length === 0) return null;

  const sorted = [...availablePlayers].sort(
    (playerA, playerB) => getRoleSelectionScore(playerB, role) - getRoleSelectionScore(playerA, role)
  );

  const chosen = sorted[Math.min(offset, sorted.length - 1)];
  return chosen || null;
};

export const autoFillLineup = (players, formation, variant = 0) => {
  const lineup = createEmptyLineup(formation);
  const remaining = [...players];

  const pickAndRemove = (role, offset) => {
    const chosen = pickPlayerForRole(remaining, role, offset);
    if (!chosen) return "";

    const chosenIndex = remaining.findIndex((player) => player.id === chosen.id);
    if (chosenIndex >= 0) remaining.splice(chosenIndex, 1);

    return chosen.id;
  };

  lineup.gkId = pickAndRemove(POSITION.GK, variant);

  OUTFIELD_POSITIONS.forEach((role) => {
    lineup[role] = lineup[role].map((_, index) => {
      const slotOffset = Math.max(0, variant - index);
      return pickAndRemove(role, slotOffset);
    });
  });

  return lineup;
};

const pickRandomItem = (items, randomFn = Math.random) => {
  if (!items.length) return null;
  const index = Math.floor(randomFn() * items.length);
  return items[index] || null;
};

const createRoleCandidatePool = (availablePlayers, role) => {
  const preferred = availablePlayers.filter((player) => player.preferredPos === role);
  if (preferred.length > 0) return preferred;

  const fallback = availablePlayers
    .map((player) => ({
      player,
      fit: applyPositionFit(player.preferredPos, role),
      score: getRoleSelectionScore(player, role),
    }))
    .filter((entry) => entry.fit > 0.35)
    .sort((entryA, entryB) => entryB.fit - entryA.fit || entryB.score - entryA.score)
    .map((entry) => entry.player);

  return fallback;
};

export const randomFillLineup = (players, formation, randomFn = Math.random) => {
  const lineup = createEmptyLineup(formation);
  const remaining = [...players];

  const pickAndRemoveRandom = (role) => {
    const candidates = createRoleCandidatePool(remaining, role);
    const chosen = pickRandomItem(candidates, randomFn);
    if (!chosen) return "";

    const chosenIndex = remaining.findIndex((player) => player.id === chosen.id);
    if (chosenIndex >= 0) remaining.splice(chosenIndex, 1);
    return chosen.id;
  };

  lineup.gkId = pickAndRemoveRandom(POSITION.GK);

  OUTFIELD_POSITIONS.forEach((role) => {
    lineup[role] = lineup[role].map(() => pickAndRemoveRandom(role));
  });

  return lineup;
};

export const updateLineupSlot = (lineup, role, index, playerId) => {
  if (role === POSITION.GK) {
    return {
      ...lineup,
      gkId: playerId,
    };
  }

  const nextRoleValues = [...lineup[role]];
  nextRoleValues[index] = playerId;

  return {
    ...lineup,
    [role]: nextRoleValues,
  };
};
