import { createSeededRng } from "../../../features/matchSim/utils/seededRng";

export const REGULAR_MATCHDAYS = 7;
export const TEAMS_PER_LEAGUE = 8;
export const MATCHES_PER_MATCHDAY = 4;
export const FINAL_WEEK_FOR_PLAYOFF = 8;

const WEEKEND_DAY_NAMES = Object.freeze(["Sat", "Sun"]);

const getWeekendDaysByWeek = (season) => {
  const byWeek = new Map();
  const days = Array.isArray(season?.days) ? season.days : [];

  days.forEach((day) => {
    if (!WEEKEND_DAY_NAMES.includes(day.dayName)) return;
    if (!byWeek.has(day.weekOfSeason)) {
      byWeek.set(day.weekOfSeason, []);
    }
    byWeek.get(day.weekOfSeason).push(day);
  });

  byWeek.forEach((weekDays, week) => {
    byWeek.set(
      week,
      [...weekDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    );
  });

  return byWeek;
};

const generateRoundRobinPairings = (teamIds) => {
  const participants = [...teamIds];
  if (participants.length % 2 !== 0) {
    participants.push("BYE");
  }

  const rounds = [];
  const fixed = participants[0];
  let rotating = participants.slice(1);

  for (let round = 0; round < participants.length - 1; round += 1) {
    const current = [fixed, ...rotating];
    const pairings = [];

    for (let index = 0; index < current.length / 2; index += 1) {
      const first = current[index];
      const second = current[current.length - 1 - index];
      if (first === "BYE" || second === "BYE") continue;
      pairings.push([first, second]);
    }

    rounds.push(pairings);

    const nextRotating = [...rotating];
    const moved = nextRotating.pop();
    nextRotating.unshift(moved);
    rotating = nextRotating;
  }

  return rounds;
};

const createFixtureId = (leagueId, matchday, fixtureIndex) =>
  `${leagueId}_md_${String(matchday).padStart(2, "0")}_fx_${String(fixtureIndex + 1).padStart(2, "0")}`;

const expectedFixtureCount = (leagueCount) =>
  leagueCount * REGULAR_MATCHDAYS * MATCHES_PER_MATCHDAY;

export const isValidCareerFixtures = (fixturesData, leagueCount) => {
  const fixtures = Array.isArray(fixturesData?.fixtures) ? fixturesData.fixtures : [];
  if (!fixturesData || typeof fixturesData !== "object") return false;
  if (!Array.isArray(fixturesData.fixtures)) return false;
  if (fixtures.length !== expectedFixtureCount(leagueCount)) return false;
  if (!fixtures.every((fixture) => WEEKEND_DAY_NAMES.includes(fixture.dayName))) return false;
  return true;
};

export const createCareerFixtures = ({
  leagues = [],
  season,
  seed = "career-fixtures-seed",
} = {}) => {
  const rng = createSeededRng(seed);
  const weekendDaysByWeek = getWeekendDaysByWeek(season);
  const fixtures = [];

  leagues.forEach((league) => {
    const teamIds = Array.isArray(league?.teamIds) ? league.teamIds.slice(0, TEAMS_PER_LEAGUE) : [];
    if (teamIds.length !== TEAMS_PER_LEAGUE) return;

    const rounds = generateRoundRobinPairings(teamIds).slice(0, REGULAR_MATCHDAYS);
    rounds.forEach((round, roundIndex) => {
      const matchday = roundIndex + 1;
      const weekOfSeason = matchday;
      const weekendDays = weekendDaysByWeek.get(weekOfSeason) || [];

      round.forEach(([teamA, teamB], fixtureIndex) => {
        const dayChoice =
          weekendDays.length > 0
            ? weekendDays[rng.randomInt(0, weekendDays.length - 1)]
            : { dayNumber: weekOfSeason * 7, dayName: "Sun", weekOfSeason };

        const swapHomeAway = rng.random() < 0.5;
        const homeTeamId = swapHomeAway ? teamB : teamA;
        const awayTeamId = swapHomeAway ? teamA : teamB;

        fixtures.push({
          id: createFixtureId(league.id, matchday, fixtureIndex),
          leagueId: league.id,
          tier: league.tier,
          stage: "LEAGUE",
          matchday,
          weekOfSeason,
          dayNumber: dayChoice.dayNumber,
          dayName: dayChoice.dayName,
          homeTeamId,
          awayTeamId,
          played: false,
          result: null,
        });
      });
    });
  });

  const finalWeekDays = weekendDaysByWeek.get(FINAL_WEEK_FOR_PLAYOFF) || [];
  const sunday = finalWeekDays.find((day) => day.dayName === "Sun") || finalWeekDays[0] || null;
  const playoffFinalReservation = sunday
    ? {
        weekOfSeason: FINAL_WEEK_FOR_PLAYOFF,
        dayNumber: sunday.dayNumber,
        dayName: sunday.dayName,
        stage: "PLAYOFF_FINAL",
      }
    : {
        weekOfSeason: FINAL_WEEK_FOR_PLAYOFF,
        dayNumber: null,
        dayName: "Sun",
        stage: "PLAYOFF_FINAL",
      };

  return {
    fixtures,
    format: {
      teamsPerLeague: TEAMS_PER_LEAGUE,
      regularMatchdays: REGULAR_MATCHDAYS,
      matchesPerMatchday: MATCHES_PER_MATCHDAY,
      weekendOnly: true,
      finalWeekReserved: FINAL_WEEK_FOR_PLAYOFF,
    },
    playoffFinalReservation,
  };
};

