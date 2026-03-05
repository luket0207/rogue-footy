import { clamp } from "../../../features/matchSim/utils/math";
import { createSeededRng } from "../../../features/matchSim/utils/seededRng";

const KNOCKOUT_ROUND_KEYS = Object.freeze(["R32", "R16", "QF", "SF", "FINAL"]);

const getCupEntries = (cups) =>
  Object.entries(cups || {}).filter(([, cup]) => cup && typeof cup === "object");

const getRoundSchedule = (cup, round) =>
  round?.schedule ||
  (Array.isArray(cup?.roundSchedule)
    ? cup.roundSchedule.find((entry) => entry.roundKey === round?.key)
    : null) ||
  null;

const getMatchScheduledDayNumber = ({ cup, round, match }) =>
  Number(match?.scheduledDayNumber) ||
  Number(getRoundSchedule(cup, round)?.dayNumber) ||
  0;

const getMatchScheduledDayName = ({ cup, round, match }) =>
  match?.scheduledDayName || getRoundSchedule(cup, round)?.dayName || "";

const getMatchScheduledWeek = ({ cup, round, match }) =>
  Number(match?.scheduledWeekOfSeason) ||
  Number(getRoundSchedule(cup, round)?.weekOfSeason) ||
  0;

const isRoundRevealedForPlay = (cup, roundKey) => {
  const drawnRounds = cup?.drawnRounds;
  if (!drawnRounds || typeof drawnRounds !== "object") return true;
  return !!drawnRounds[roundKey];
};

const resolveTeamStrength = (teamsById, teamId) =>
  Number(teamsById?.[teamId]?.teamStrength) || 72;

const rollGoalsFromExpected = (expectedGoals, rng) => {
  const chanceCount = 6;
  const baseChance = clamp(expectedGoals / chanceCount, 0.02, 0.88);
  let goals = 0;

  for (let chance = 0; chance < chanceCount; chance += 1) {
    if (rng.random() < baseChance) {
      goals += 1;
    }
  }

  const bonusChance = clamp((expectedGoals - 2.2) * 0.22, 0, 0.3);
  if (rng.random() < bonusChance) {
    goals += 1;
  }

  return goals;
};

const simulateCupFixtureResult = ({ fixture, teamsById, seedBase }) => {
  const rng = createSeededRng(`${seedBase}:${fixture.matchId}:${fixture.dayNumber}`);
  const homeStrength = resolveTeamStrength(teamsById, fixture.homeTeamId);
  const awayStrength = resolveTeamStrength(teamsById, fixture.awayTeamId);
  const strengthDiff = homeStrength - awayStrength;

  const homeExpected = clamp(1.45 + strengthDiff / 22, 0.25, 4.8);
  const awayExpected = clamp(1.35 - strengthDiff / 22, 0.25, 4.8);

  return {
    homeGoals: rollGoalsFromExpected(homeExpected, rng),
    awayGoals: rollGoalsFromExpected(awayExpected, rng),
  };
};

const createPenaltyWinner = ({ homeTeamId, awayTeamId, seedBase }) => {
  const rng = createSeededRng(`${seedBase}:penalties`);
  return rng.random() < 0.5 ? homeTeamId : awayTeamId;
};

const resolveWinnerFromScore = ({
  homeTeamId,
  awayTeamId,
  homeGoals,
  awayGoals,
  seedBase,
}) => {
  if (homeGoals > awayGoals) {
    return {
      winnerTeamId: homeTeamId,
      decidedBy: "FT",
      penaltyWinnerTeamId: "",
    };
  }
  if (awayGoals > homeGoals) {
    return {
      winnerTeamId: awayTeamId,
      decidedBy: "FT",
      penaltyWinnerTeamId: "",
    };
  }

  const penaltyWinnerTeamId = createPenaltyWinner({
    homeTeamId,
    awayTeamId,
    seedBase,
  });
  return {
    winnerTeamId: penaltyWinnerTeamId,
    decidedBy: "PEN",
    penaltyWinnerTeamId,
  };
};

const cloneRoundMatches = (round) =>
  Array.isArray(round?.matches) ? round.matches.map((match) => ({ ...match })) : [];

const propagateWinnersIntoNextRounds = (rounds = []) => {
  const nextRounds = rounds.map((round) => ({
    ...round,
    matches: cloneRoundMatches(round),
  }));

  for (let index = 0; index < nextRounds.length - 1; index += 1) {
    const currentRound = nextRounds[index];
    const currentMatches = Array.isArray(currentRound?.matches) ? currentRound.matches : [];
    const allCurrentResolved =
      currentMatches.length > 0 &&
      currentMatches.every((match) => match.played && !!match.winnerTeamId);
    if (!allCurrentResolved) continue;

    const winners = currentMatches.map((match) => match.winnerTeamId);
    const nextRound = nextRounds[index + 1];
    const nextMatches = Array.isArray(nextRound?.matches) ? nextRound.matches : [];

    nextRound.matches = nextMatches.map((match, matchIndex) => {
      const homeTeamId = winners[matchIndex * 2] || "";
      const awayTeamId = winners[matchIndex * 2 + 1] || "";
      if (match.played) return match;
      if (match.homeTeamId === homeTeamId && match.awayTeamId === awayTeamId) return match;

      return {
        ...match,
        homeTeamId,
        awayTeamId,
      };
    });
  }

  return nextRounds;
};

const resolveCupStatus = ({ cup, rounds, winnerTeamId }) => {
  if (winnerTeamId) return "completed";
  const hasPlayedMatch = rounds.some((round) =>
    (Array.isArray(round?.matches) ? round.matches : []).some((match) => match.played)
  );
  if (hasPlayedMatch) return "in_progress";
  return cup?.status || "ready";
};

const getRoundOrder = (round, index) => {
  const explicitOrder = Number(round?.order);
  if (explicitOrder > 0) return explicitOrder;
  const fallbackIndex = KNOCKOUT_ROUND_KEYS.indexOf(round?.key);
  return fallbackIndex >= 0 ? fallbackIndex + 1 : index + 1;
};

export const createCareerCupTeamsById = ({ teamsById = {}, cups }) => {
  const merged = {
    ...(teamsById && typeof teamsById === "object" ? teamsById : {}),
  };

  getCupEntries(cups).forEach(([, cup]) => {
    const foreignTeams = Array.isArray(cup?.foreignTeams) ? cup.foreignTeams : [];
    foreignTeams.forEach((foreignTeam) => {
      if (!foreignTeam?.id) return;
      merged[foreignTeam.id] = foreignTeam;
    });
  });

  return merged;
};

export const getUnplayedCupMatchesForDay = ({ cups, dayNumber }) => {
  const targetDayNumber = Number(dayNumber) || 0;
  if (targetDayNumber <= 0) return [];

  const matches = [];
  getCupEntries(cups).forEach(([cupKey, cup]) => {
    const rounds = Array.isArray(cup?.rounds) ? cup.rounds : [];
    rounds.forEach((round, roundIndex) => {
      if (!isRoundRevealedForPlay(cup, round?.key)) return;

      const roundMatches = Array.isArray(round?.matches) ? round.matches : [];
      roundMatches.forEach((match) => {
        if (match?.played) return;
        if (!match?.homeTeamId || !match?.awayTeamId) return;

        const scheduledDayNumber = getMatchScheduledDayNumber({ cup, round, match });
        if (scheduledDayNumber !== targetDayNumber) return;

        matches.push({
          cupKey,
          competition: cup?.competition || "",
          roundKey: round?.key || "",
          roundLabel: round?.label || round?.key || "",
          roundOrder: getRoundOrder(round, roundIndex),
          matchId: match.id,
          matchIndex: Number(match?.matchIndex) || 0,
          dayNumber: scheduledDayNumber,
          dayName: getMatchScheduledDayName({ cup, round, match }),
          weekOfSeason: getMatchScheduledWeek({ cup, round, match }),
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
        });
      });
    });
  });

  return matches.sort((matchA, matchB) => {
    if (matchA.dayNumber !== matchB.dayNumber) return matchA.dayNumber - matchB.dayNumber;
    if (matchA.roundOrder !== matchB.roundOrder) return matchA.roundOrder - matchB.roundOrder;
    if (matchA.cupKey !== matchB.cupKey) return String(matchA.cupKey).localeCompare(String(matchB.cupKey));
    return matchA.matchIndex - matchB.matchIndex;
  });
};

export const applyCupMatchResultToCups = ({
  cups,
  cupKey,
  matchId,
  homeGoals,
  awayGoals,
  seedBase = "career-cup",
  simulated = false,
  playedAt = new Date().toISOString(),
}) => {
  if (!cups || typeof cups !== "object" || !cupKey || !matchId) {
    return cups;
  }

  const currentCup = cups[cupKey];
  if (!currentCup || typeof currentCup !== "object") return cups;

  let didUpdateMatch = false;
  const rounds = (Array.isArray(currentCup.rounds) ? currentCup.rounds : []).map((round) => {
    const roundMatches = Array.isArray(round?.matches) ? round.matches : [];
    const nextMatches = roundMatches.map((match) => {
      if (match?.id !== matchId) return { ...match };

      didUpdateMatch = true;
      const safeHomeGoals = Math.max(0, Number(homeGoals) || 0);
      const safeAwayGoals = Math.max(0, Number(awayGoals) || 0);
      const winner = resolveWinnerFromScore({
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeGoals: safeHomeGoals,
        awayGoals: safeAwayGoals,
        seedBase: `${seedBase}:${cupKey}:${matchId}:${safeHomeGoals}-${safeAwayGoals}`,
      });

      return {
        ...match,
        played: true,
        simulated: simulated || !!match.simulated,
        winnerTeamId: winner.winnerTeamId,
        result: {
          homeGoals: safeHomeGoals,
          awayGoals: safeAwayGoals,
          decidedBy: winner.decidedBy,
          penaltyWinnerTeamId: winner.penaltyWinnerTeamId,
        },
        playedAt,
      };
    });

    return {
      ...round,
      matches: nextMatches,
    };
  });

  if (!didUpdateMatch) return cups;

  const propagatedRounds = propagateWinnersIntoNextRounds(rounds);
  const finalRound = propagatedRounds[propagatedRounds.length - 1];
  const finalMatch = Array.isArray(finalRound?.matches) ? finalRound.matches[0] : null;
  const winnerTeamId = finalMatch?.played ? finalMatch?.winnerTeamId || "" : "";

  const nextCup = {
    ...currentCup,
    rounds: propagatedRounds,
    winnerTeamId,
    status: resolveCupStatus({
      cup: currentCup,
      rounds: propagatedRounds,
      winnerTeamId,
    }),
    lastUpdatedAt: playedAt,
  };

  return {
    ...cups,
    [cupKey]: nextCup,
  };
};

export const simulateNonPlayerCupMatchesForDay = ({
  cups,
  dayNumber,
  playerTeamId,
  teamsById,
  seedBase = "career-cup-day",
} = {}) => {
  const todaysMatches = getUnplayedCupMatchesForDay({ cups, dayNumber });
  if (todaysMatches.length === 0) {
    return {
      cups,
      simulatedCount: 0,
    };
  }

  let nextCups = cups;
  let simulatedCount = 0;

  todaysMatches.forEach((match) => {
    const includesPlayer =
      match.homeTeamId === playerTeamId || match.awayTeamId === playerTeamId;
    if (includesPlayer) return;

    const result = simulateCupFixtureResult({
      fixture: match,
      teamsById,
      seedBase: `${seedBase}:d${Number(dayNumber) || 0}:${match.cupKey}:${match.roundKey}`,
    });

    nextCups = applyCupMatchResultToCups({
      cups: nextCups,
      cupKey: match.cupKey,
      matchId: match.matchId,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      seedBase: `${seedBase}:d${Number(dayNumber) || 0}:${match.matchId}`,
      simulated: true,
    });
    simulatedCount += 1;
  });

  return {
    cups: nextCups,
    simulatedCount,
  };
};
