import { createSeededRng } from "../../../features/matchSim/utils/seededRng";
import { CUP_COMPETITION } from "./cupEligibility";

export const SWAP_CUP_SOURCE_TIERS = Object.freeze([6, 7, 8, 9]);
export const SUPER_SWAP_CUP_SOURCE_TIERS = Object.freeze([2, 3, 4, 5]);
export const SWAP_CUP_TEAM_COUNT = 32;
export const SUPER_SWAP_CUP_TEAM_COUNT = 32;
export const CHAMPIONS_CUP_TEAM_COUNT = 32;
export const CHAMPIONS_CUP_FOREIGN_TEAM_COUNT = 31;
export const CHAMPIONS_CUP_SOURCE_TIER = 1;
const CUP_WEEK_PATTERN = Object.freeze([2, 4, 6, 8]);
const FINAL_WEEK = 8;
const WEDNESDAY = "Wed";
const SUNDAY = "Sun";

const KNOCKOUT_ROUNDS = Object.freeze([
  Object.freeze({ key: "R32", label: "Round of 32", teamCount: 32 }),
  Object.freeze({ key: "R16", label: "Round of 16", teamCount: 16 }),
  Object.freeze({ key: "QF", label: "Quarter Final", teamCount: 8 }),
  Object.freeze({ key: "SF", label: "Semi Final", teamCount: 4 }),
  Object.freeze({ key: "FINAL", label: "Final", teamCount: 2 }),
]);

const FOREIGN_COUNTRIES = Object.freeze([
  "Spain",
  "Germany",
  "Italy",
  "France",
  "Portugal",
  "Netherlands",
  "Brazil",
  "Argentina",
  "Belgium",
  "Croatia",
  "Turkey",
  "Mexico",
  "USA",
  "Switzerland",
  "Denmark",
  "Austria",
]);

const FOREIGN_PREFIXES = Object.freeze([
  "Atletico",
  "Sporting",
  "Dynamo",
  "Real",
  "Union",
  "Olympic",
  "Racing",
  "Lokomotiv",
  "Inter",
  "Nacional",
  "Estrella",
  "Academia",
  "Aurora",
  "Victoria",
  "Central",
  "River",
  "Royal",
  "Continental",
  "Porto",
  "Ciudad",
]);

const FOREIGN_ROOTS = Object.freeze([
  "Madrid",
  "Berlin",
  "Milano",
  "Paris",
  "Lisboa",
  "Amsterdam",
  "Santos",
  "Cordoba",
  "Brussels",
  "Split",
  "Ankara",
  "Monterrey",
  "Boston",
  "Zurich",
  "Copenhagen",
  "Vienna",
  "Valencia",
  "Munich",
  "Napoli",
  "Lyon",
  "Porto",
  "Rosario",
  "Ghent",
  "Izmir",
]);

const FOREIGN_SUFFIXES = Object.freeze([
  "FC",
  "SC",
  "United",
  "City",
  "Club",
  "Athletic",
  "Sport",
  "CF",
]);

const shuffleWithRandom = (items, randomFn) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    const temp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = temp;
  }
  return next;
};

const getFallbackDayNumber = (weekOfSeason, dayName) => {
  const dayOfWeek = dayName === SUNDAY ? 7 : 3;
  return (weekOfSeason - 1) * 7 + dayOfWeek;
};

const getDayNumberFromSeason = ({ season, weekOfSeason, dayName }) => {
  const days = Array.isArray(season?.days) ? season.days : [];
  const match = days.find(
    (day) =>
      Number(day.weekOfSeason) === Number(weekOfSeason) && String(day.dayName) === dayName
  );
  if (match) {
    return Number(match.dayNumber) || getFallbackDayNumber(weekOfSeason, dayName);
  }

  // Fallback for legacy/malformed season state.
  return getFallbackDayNumber(weekOfSeason, dayName);
};

const getLastDayByName = ({ season, dayName, fallbackWeek }) => {
  const days = Array.isArray(season?.days) ? season.days : [];
  const matching = days
    .filter((day) => String(day.dayName) === dayName)
    .sort((dayA, dayB) => Number(dayB.dayNumber) - Number(dayA.dayNumber));
  const latest = matching[0];
  if (latest) {
    return {
      weekOfSeason: Number(latest.weekOfSeason) || fallbackWeek,
      dayName: String(latest.dayName) || dayName,
      dayNumber: Number(latest.dayNumber) || getFallbackDayNumber(fallbackWeek, dayName),
    };
  }

  return {
    weekOfSeason: fallbackWeek,
    dayName,
    dayNumber: getFallbackDayNumber(fallbackWeek, dayName),
  };
};

const createRoundSchedule = ({ season, finalDayName }) => {
  const finalDay = getLastDayByName({
    season,
    dayName: finalDayName,
    fallbackWeek: FINAL_WEEK,
  });

  return KNOCKOUT_ROUNDS.map((round, index) => {
    if (round.key === "FINAL") {
      return {
        roundKey: round.key,
        weekOfSeason: finalDay.weekOfSeason,
        dayName: finalDay.dayName,
        dayNumber: finalDay.dayNumber,
      };
    }

    const weekOfSeason = CUP_WEEK_PATTERN[index] || CUP_WEEK_PATTERN[CUP_WEEK_PATTERN.length - 1];
    return {
      roundKey: round.key,
      weekOfSeason,
      dayName: WEDNESDAY,
      dayNumber: getDayNumberFromSeason({
        season,
        weekOfSeason,
        dayName: WEDNESDAY,
      }),
    };
  });
};

const mapScheduleByRound = (roundSchedule) =>
  (Array.isArray(roundSchedule) ? roundSchedule : []).reduce((result, entry) => {
    result[entry.roundKey] = entry;
    return result;
  }, {});

const createRoundMatches = ({
  competitionPrefix,
  seasonNumber,
  roundKey,
  teamCount,
  seededTeamIds = [],
  schedule,
}) => {
  const matchCount = Math.floor(teamCount / 2);
  return Array.from({ length: matchCount }, (_, index) => ({
    id: `${competitionPrefix}_${seasonNumber}_${roundKey}_${String(index + 1).padStart(2, "0")}`,
    round: roundKey,
    matchIndex: index + 1,
    homeTeamId: seededTeamIds[index * 2] || "",
    awayTeamId: seededTeamIds[index * 2 + 1] || "",
    played: false,
    result: null,
    winnerTeamId: "",
    scheduledDayNumber: Number(schedule?.dayNumber) || 0,
    scheduledDayName: schedule?.dayName || "",
    scheduledWeekOfSeason: Number(schedule?.weekOfSeason) || 0,
  }));
};

const getEligibleLeagues = (leagues = [], sourceTiers = []) =>
  (Array.isArray(leagues) ? leagues : [])
    .filter((league) => sourceTiers.includes(Number(league?.tier)))
    .sort((leagueA, leagueB) => Number(leagueA.tier) - Number(leagueB.tier));

const getTierOneLeague = (leagues = []) =>
  (Array.isArray(leagues) ? leagues : []).find(
    (league) => Number(league?.tier) === CHAMPIONS_CUP_SOURCE_TIER
  ) || null;

const pickRandomFrom = (items, randomFn) => {
  if (!Array.isArray(items) || items.length === 0) return "";
  const index = Math.floor(randomFn() * items.length);
  return items[index] || items[0];
};

const buildForeignTeamName = (rng) => {
  const prefix = pickRandomFrom(FOREIGN_PREFIXES, rng.random);
  const root = pickRandomFrom(FOREIGN_ROOTS, rng.random);
  const suffix = pickRandomFrom(FOREIGN_SUFFIXES, rng.random);
  return `${prefix} ${root} ${suffix}`.replace(/\s+/g, " ").trim();
};

const createForeignChampionsTeams = ({ seasonNumber, seed, count }) => {
  const rng = createSeededRng(`${seed}:foreign:${seasonNumber}`);
  const teams = [];
  const usedNames = new Set();

  while (teams.length < count) {
    const country = pickRandomFrom(FOREIGN_COUNTRIES, rng.random) || "Foreign";
    let name = buildForeignTeamName(rng);
    let guard = 0;
    while (usedNames.has(name) && guard < 20) {
      name = buildForeignTeamName(rng);
      guard += 1;
    }
    if (usedNames.has(name)) {
      name = `${name} ${teams.length + 1}`;
    }
    usedNames.add(name);

    teams.push({
      id: `foreign_cc_s${String(seasonNumber).padStart(2, "0")}_${String(teams.length + 1).padStart(2, "0")}`,
      name,
      country,
      teamStrength: 84 + rng.randomInt(0, 14),
      isForeign: true,
    });
  }

  return teams;
};

const createKnockoutRounds = ({
  competitionPrefix,
  seasonNumber,
  seededEntrants,
  roundScheduleByKey,
}) =>
  KNOCKOUT_ROUNDS.map((round, roundIndex) => ({
    key: round.key,
    label: round.label,
    order: roundIndex + 1,
    schedule: roundScheduleByKey[round.key] || null,
    matches: createRoundMatches({
      competitionPrefix,
      seasonNumber,
      roundKey: round.key,
      teamCount: round.teamCount,
      seededTeamIds: round.key === "R32" ? seededEntrants : [],
      schedule: roundScheduleByKey[round.key] || null,
    }),
  }));

const createDomesticCupStructure = ({
  competition,
  sourceTiers = [],
  teamCount = 32,
  competitionPrefix = "cup",
  seedSegment = "cup",
  leagues = [],
  season = null,
  seasonNumber = 1,
  seed = "career-cup",
} = {}) => {
  const eligibleLeagues = getEligibleLeagues(leagues, sourceTiers);
  const sourceLeagueIds = eligibleLeagues.map((league) => league.id);
  const rawEntrants = eligibleLeagues.flatMap((league) =>
    Array.isArray(league.teamIds) ? league.teamIds : []
  );
  const entrants = rawEntrants.slice(0, teamCount);
  const rng = createSeededRng(`${seed}:${seedSegment}:${seasonNumber}`);
  const seededEntrants = shuffleWithRandom(entrants, rng.random);
  const roundSchedule = createRoundSchedule({
    season,
    finalDayName: SUNDAY,
  });
  const roundScheduleByKey = mapScheduleByRound(roundSchedule);

  const rounds = createKnockoutRounds({
    competitionPrefix,
    seasonNumber,
    seededEntrants,
    roundScheduleByKey,
  });

  return {
    competition,
    seasonNumber: Number(seasonNumber) || 1,
    status: entrants.length === teamCount ? "ready" : "incomplete",
    sourceTiers: [...sourceTiers],
    sourceLeagueIds,
    entryTeamIds: seededEntrants,
    roundSchedule,
    rounds,
    winnerTeamId: "",
    generatedAt: new Date().toISOString(),
  };
};

export const createSwapCupStructure = ({
  leagues = [],
  season = null,
  seasonNumber = 1,
  seed = "career-swap-cup",
} = {}) =>
  createDomesticCupStructure({
    competition: CUP_COMPETITION.SWAP_CUP,
    sourceTiers: SWAP_CUP_SOURCE_TIERS,
    teamCount: SWAP_CUP_TEAM_COUNT,
    competitionPrefix: "swap",
    seedSegment: "swap",
    leagues,
    season,
    seasonNumber,
    seed,
  });

export const createSuperSwapCupStructure = ({
  leagues = [],
  season = null,
  seasonNumber = 1,
  seed = "career-super-swap-cup",
} = {}) =>
  createDomesticCupStructure({
    competition: CUP_COMPETITION.SUPER_SWAP_CUP,
    sourceTiers: SUPER_SWAP_CUP_SOURCE_TIERS,
    teamCount: SUPER_SWAP_CUP_TEAM_COUNT,
    competitionPrefix: "super_swap",
    seedSegment: "super_swap",
    leagues,
    season,
    seasonNumber,
    seed,
  });

export const createChampionsCupStructure = ({
  leagues = [],
  playerTeam = null,
  season = null,
  seasonNumber = 1,
  seed = "career-champions-cup",
} = {}) => {
  const tierOneLeague = getTierOneLeague(leagues);
  const tierOneTeamIds = Array.isArray(tierOneLeague?.teamIds) ? tierOneLeague.teamIds : [];
  const playerTeamId = playerTeam?.id || "";
  const playerInTierOne = tierOneTeamIds.includes(playerTeamId);
  const domesticEntryTeamId =
    (playerInTierOne && playerTeamId) ||
    tierOneTeamIds[0] ||
    `domestic_cc_s${String(seasonNumber).padStart(2, "0")}`;

  const foreignTeams = createForeignChampionsTeams({
    seasonNumber,
    seed,
    count: CHAMPIONS_CUP_FOREIGN_TEAM_COUNT,
  });
  const entrants = [domesticEntryTeamId, ...foreignTeams.map((team) => team.id)].slice(
    0,
    CHAMPIONS_CUP_TEAM_COUNT
  );
  const rng = createSeededRng(`${seed}:champions:${seasonNumber}`);
  const seededEntrants = shuffleWithRandom(entrants, rng.random);
  const roundSchedule = createRoundSchedule({
    season,
    finalDayName: SUNDAY,
  });
  const roundScheduleByKey = mapScheduleByRound(roundSchedule);
  const rounds = createKnockoutRounds({
    competitionPrefix: "champions",
    seasonNumber,
    seededEntrants,
    roundScheduleByKey,
  });

  return {
    competition: CUP_COMPETITION.CHAMPIONS_CUP,
    seasonNumber: Number(seasonNumber) || 1,
    status:
      entrants.length === CHAMPIONS_CUP_TEAM_COUNT &&
      foreignTeams.length === CHAMPIONS_CUP_FOREIGN_TEAM_COUNT
        ? "ready"
        : "incomplete",
    domesticEntryTeamId,
    foreignTeams,
    entryTeamIds: seededEntrants,
    roundSchedule,
    rounds,
    winnerTeamId: "",
    generatedAt: new Date().toISOString(),
  };
};

export const createCareerCupsState = ({
  leagues = [],
  playerTeam = null,
  season = null,
  seasonNumber = 1,
  seed = "career-cups",
} = {}) => ({
  swapCup: createSwapCupStructure({
    leagues,
    season,
    seasonNumber,
    seed,
  }),
  superSwapCup: createSuperSwapCupStructure({
    leagues,
    season,
    seasonNumber,
    seed,
  }),
  championsCup: createChampionsCupStructure({
    leagues,
    playerTeam,
    season,
    seasonNumber,
    seed,
  }),
});
