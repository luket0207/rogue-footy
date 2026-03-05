import { getCupCompetitionLabel } from "./cupEligibility";

const DRAW_TRIGGER_DAY = "Fri";
const MIN_DAYS_AHEAD = 1;
const MAX_DAYS_AHEAD = 5;
const DRAW_DAY_TYPE = "DRAW_DAY_BUNDLE";

const toForeignTeamMap = (cup) =>
  (Array.isArray(cup?.foreignTeams) ? cup.foreignTeams : []).reduce((result, team) => {
    if (team?.id) result[team.id] = team;
    return result;
  }, {});

const resolveTeamName = ({ teamId, teamsById, foreignById }) => {
  if (!teamId) return "TBD";
  if (teamsById?.[teamId]?.name) return teamsById[teamId].name;
  if (foreignById?.[teamId]?.name) return foreignById[teamId].name;
  return teamId;
};

const getRoundSchedule = (cup, round) =>
  round?.schedule ||
  (Array.isArray(cup?.roundSchedule)
    ? cup.roundSchedule.find((entry) => entry.roundKey === round?.key)
    : null) ||
  null;

const isRoundAlreadyDrawn = (cup, roundKey) =>
  !!(cup?.drawnRounds && typeof cup.drawnRounds === "object" && cup.drawnRounds[roundKey]);

const buildFixturesForRound = ({ cup, round, teamsById }) => {
  const foreignById = toForeignTeamMap(cup);
  const matches = Array.isArray(round?.matches) ? round.matches : [];
  return matches.map((match) => ({
    id: match.id,
    matchIndex: match.matchIndex,
    homeTeamId: match.homeTeamId || "",
    awayTeamId: match.awayTeamId || "",
    homeTeamName: resolveTeamName({
      teamId: match.homeTeamId,
      teamsById,
      foreignById,
    }),
    awayTeamName: resolveTeamName({
      teamId: match.awayTeamId,
      teamsById,
      foreignById,
    }),
  }));
};

const collectPendingDrawCandidates = ({ cups, currentDayNumber, teamsById }) => {
  const cupEntries = Object.entries(cups || {}).filter(([, cup]) => cup && typeof cup === "object");
  const candidates = [];

  cupEntries.forEach(([cupKey, cup]) => {
    const rounds = Array.isArray(cup.rounds) ? cup.rounds : [];
    rounds.forEach((round) => {
      if (!round?.key) return;
      if (isRoundAlreadyDrawn(cup, round.key)) return;

      const schedule = getRoundSchedule(cup, round);
      const scheduledDayNumber = Number(schedule?.dayNumber) || 0;
      const dayDelta = scheduledDayNumber - Number(currentDayNumber || 0);
      if (scheduledDayNumber <= 0) return;
      if (dayDelta < MIN_DAYS_AHEAD || dayDelta > MAX_DAYS_AHEAD) return;

      candidates.push({
        cupKey,
        cup,
        round,
        schedule,
        dayDelta,
        fixtures: buildFixturesForRound({ cup, round, teamsById }),
      });
    });
  });

  return candidates.sort((candidateA, candidateB) => {
    const dayA = Number(candidateA?.schedule?.dayNumber) || 0;
    const dayB = Number(candidateB?.schedule?.dayNumber) || 0;
    if (dayA !== dayB) return dayA - dayB;
    return String(candidateA.cupKey).localeCompare(String(candidateB.cupKey));
  });
};

const mapCandidateToDrawEntry = (candidate, currentDayNumber, currentDayName) => ({
  id: `draw_${candidate.cupKey}_${candidate.round.key}_d${String(currentDayNumber).padStart(2, "0")}`,
  cupKey: candidate.cupKey,
  competition: candidate.cup?.competition || "",
  competitionLabel: getCupCompetitionLabel(candidate.cup?.competition || ""),
  roundKey: candidate.round.key,
  roundLabel: candidate.round.label || candidate.round.key,
  scheduledDayNumber: Number(candidate.schedule?.dayNumber) || 0,
  scheduledDayName: candidate.schedule?.dayName || "",
  scheduledWeekOfSeason: Number(candidate.schedule?.weekOfSeason) || 0,
  triggeredDayNumber: Number(currentDayNumber) || 0,
  triggeredDayName: String(currentDayName || ""),
  fixtures: candidate.fixtures,
  createdAt: new Date().toISOString(),
});

const getDrawEntries = (pendingCupDraw) => {
  if (Array.isArray(pendingCupDraw?.draws) && pendingCupDraw.draws.length > 0) {
    return pendingCupDraw.draws;
  }
  if (pendingCupDraw?.cupKey && pendingCupDraw?.roundKey) {
    return [pendingCupDraw];
  }
  return [];
};

export const getNextPendingCupDraw = ({
  cups,
  currentDayNumber,
  currentDayName,
  teamsById,
}) => {
  if (String(currentDayName) !== DRAW_TRIGGER_DAY) return null;
  const candidates = collectPendingDrawCandidates({
    cups,
    currentDayNumber,
    teamsById,
  });
  if (candidates.length === 0) return null;

  const draws = candidates.map((candidate) =>
    mapCandidateToDrawEntry(candidate, currentDayNumber, currentDayName)
  );

  return {
    id: `draw_day_d${String(currentDayNumber).padStart(2, "0")}`,
    type: DRAW_DAY_TYPE,
    triggeredDayNumber: Number(currentDayNumber) || 0,
    triggeredDayName: String(currentDayName || ""),
    drawCount: draws.length,
    draws,
    createdAt: new Date().toISOString(),
  };
};

const applySingleCupDrawReveal = ({
  cups,
  drawEntry,
  revealedAt,
}) => {
  if (!cups || typeof cups !== "object" || !drawEntry?.cupKey || !drawEntry?.roundKey) {
    return cups;
  }

  const currentCup = cups[drawEntry.cupKey];
  if (!currentCup || typeof currentCup !== "object") return cups;

  const currentDrawnRounds =
    currentCup?.drawnRounds && typeof currentCup.drawnRounds === "object"
      ? currentCup.drawnRounds
      : {};
  const drawHistory = Array.isArray(currentCup?.drawHistory) ? currentCup.drawHistory : [];

  const nextCup = {
    ...currentCup,
    drawnRounds: {
      ...currentDrawnRounds,
      [drawEntry.roundKey]: {
        revealedAt,
        scheduledDayNumber: drawEntry.scheduledDayNumber,
        scheduledDayName: drawEntry.scheduledDayName,
        scheduledWeekOfSeason: drawEntry.scheduledWeekOfSeason,
        triggeredDayNumber: drawEntry.triggeredDayNumber,
        triggeredDayName: drawEntry.triggeredDayName,
      },
    },
    drawHistory: [
      ...drawHistory,
      {
        drawId: drawEntry.id,
        roundKey: drawEntry.roundKey,
        roundLabel: drawEntry.roundLabel,
        revealedAt,
        scheduledDayNumber: drawEntry.scheduledDayNumber,
        scheduledDayName: drawEntry.scheduledDayName,
      },
    ],
    lastDrawAt: revealedAt,
  };

  return {
    ...cups,
    [drawEntry.cupKey]: nextCup,
  };
};

export const applyCupDrawReveal = ({
  cups,
  pendingCupDraw,
  revealedAt = new Date().toISOString(),
}) => {
  if (!cups || typeof cups !== "object") {
    return cups;
  }

  const drawEntries = getDrawEntries(pendingCupDraw);
  if (drawEntries.length === 0) return cups;

  return drawEntries.reduce(
    (nextCups, drawEntry) =>
      applySingleCupDrawReveal({
        cups: nextCups,
        drawEntry,
        revealedAt,
      }),
    cups
  );
};
