import { clamp } from "../../../features/matchSim/utils/math";
import { createSeededRng } from "../../../features/matchSim/utils/seededRng";
import { createSeasonModel, TOTAL_SEASON_DAYS } from "./calendarModel";
import { createCareerFixtures } from "./fixtureGeneration";
import { createLeagueTablesFromFixtures } from "./leagueTableState";
import {
  applyCurrentTierToTeams,
  createLeaguesAfterPromotionRelegation,
} from "./promotionRelegation";
import {
  applyCupCompetitionToTeams,
  createCupEligibilityState,
} from "./cupEligibility";
import { createCareerCupsState } from "./swapCupStructure";
import { applyLeagueStrengthDistribution } from "./teamStrengthDistribution";

const PLAYOFF_MATCHDAY = 8;
const PLAYOFF_STAGE = "PLAYOFF_FINAL";
const LEAGUE_STAGE = "LEAGUE";

const resolveTeamStrength = (teamsById, teamId) =>
  Number(teamsById?.[teamId]?.teamStrength) || 70;

const rollGoalsFromExpected = (expectedGoals, rng) => {
  const chanceCount = 6;
  const baseChance = clamp(expectedGoals / chanceCount, 0.02, 0.88);
  let goals = 0;

  for (let chance = 0; chance < chanceCount; chance += 1) {
    if (rng.random() < baseChance) {
      goals += 1;
    }
  }

  const bonusChance = clamp((expectedGoals - 2.1) * 0.2, 0, 0.28);
  if (rng.random() < bonusChance) {
    goals += 1;
  }

  return goals;
};

const simulateFixtureResult = ({ fixture, teamsById, seedBase, isPlayoff = false }) => {
  const rng = createSeededRng(`${seedBase}:${fixture.id}:${fixture.dayNumber}`);
  const homeStrength = resolveTeamStrength(teamsById, fixture.homeTeamId);
  const awayStrength = resolveTeamStrength(teamsById, fixture.awayTeamId);
  const strengthDiff = homeStrength - awayStrength;

  const homeExpected = clamp(1.35 + 0.2 + strengthDiff / 22, 0.2, 4.6);
  const awayExpected = clamp(1.35 - strengthDiff / 22, 0.2, 4.6);

  let homeGoals = rollGoalsFromExpected(homeExpected, rng);
  let awayGoals = rollGoalsFromExpected(awayExpected, rng);
  if (isPlayoff) {
    while (homeGoals === awayGoals) {
      homeGoals += rng.random() < 0.5 ? 1 : 0;
      awayGoals += homeGoals === awayGoals ? 1 : 0;
    }
  }

  return { homeGoals, awayGoals };
};

const getStandingsRows = ({ league, leagueTables }) => {
  const rows = Array.isArray(leagueTables?.[league.id]?.rows) ? leagueTables[league.id].rows : [];
  if (rows.length > 1) return rows;

  return (Array.isArray(league.teamIds) ? league.teamIds : []).map((teamId) => ({
    teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  }));
};

export const getPlayoffFinalDayNumber = ({ fixturesData, season }) => {
  const reserved = Number(fixturesData?.playoffFinalReservation?.dayNumber) || 0;
  if (reserved > 0) return reserved;

  const days = Array.isArray(season?.days) ? season.days : [];
  const sunday = days
    .filter((day) => day.dayName === "Sun")
    .sort((dayA, dayB) => dayB.dayNumber - dayA.dayNumber)[0];
  return sunday?.dayNumber || TOTAL_SEASON_DAYS;
};

export const ensurePlayoffFinalFixtures = ({
  fixturesData,
  leagues = [],
  leagueTables = {},
  season,
  seedBase = "career-playoff",
}) => {
  if (!fixturesData || !Array.isArray(fixturesData.fixtures) || leagues.length === 0) {
    return fixturesData;
  }

  const existingFinalByLeague = fixturesData.fixtures
    .filter((fixture) => fixture.stage === PLAYOFF_STAGE)
    .reduce((result, fixture) => {
      result[fixture.leagueId] = fixture;
      return result;
    }, {});
  if (Object.keys(existingFinalByLeague).length >= leagues.length) {
    return fixturesData;
  }

  const finalDayNumber = getPlayoffFinalDayNumber({ fixturesData, season });
  const dayData = (Array.isArray(season?.days) ? season.days : []).find(
    (day) => day.dayNumber === finalDayNumber
  );
  const dayName = dayData?.dayName || fixturesData?.playoffFinalReservation?.dayName || "Sun";
  const weekOfSeason =
    Number(dayData?.weekOfSeason) || Number(fixturesData?.playoffFinalReservation?.weekOfSeason) || PLAYOFF_MATCHDAY;
  const rng = createSeededRng(`${seedBase}:pairings:${season?.seasonNumber || 1}`);
  const newFinals = [];

  leagues.forEach((league) => {
    if (existingFinalByLeague[league.id]) return;
    const rows = getStandingsRows({ league, leagueTables });
    if (rows.length < 2) return;

    const first = rows[0];
    const second = rows[1];
    const homeFirst = rng.random() < 0.5;
    const homeTeamId = homeFirst ? first.teamId : second.teamId;
    const awayTeamId = homeFirst ? second.teamId : first.teamId;

    newFinals.push({
      id: `${league.id}_playoff_final_s${String(season?.seasonNumber || 1).padStart(2, "0")}`,
      leagueId: league.id,
      tier: league.tier,
      stage: PLAYOFF_STAGE,
      matchday: PLAYOFF_MATCHDAY,
      weekOfSeason,
      dayNumber: finalDayNumber,
      dayName,
      homeTeamId,
      awayTeamId,
      played: false,
      simulated: false,
      result: null,
    });
  });

  if (newFinals.length === 0) return fixturesData;
  return {
    ...fixturesData,
    fixtures: [...fixturesData.fixtures, ...newFinals],
  };
};

export const simulateNonPlayerPlayoffFinalsForDay = ({
  fixturesData,
  dayNumber,
  playerTeamId,
  teamsById,
  seedBase = "career-playoff-day",
} = {}) => {
  const fixtures = Array.isArray(fixturesData?.fixtures) ? fixturesData.fixtures : [];
  let simulatedCount = 0;

  const nextFixtures = fixtures.map((fixture) => {
    if (fixture.played) return fixture;
    if (fixture.stage !== PLAYOFF_STAGE) return fixture;
    if (Number(fixture.dayNumber) !== Number(dayNumber)) return fixture;
    if (fixture.homeTeamId === playerTeamId || fixture.awayTeamId === playerTeamId) {
      return fixture;
    }

    simulatedCount += 1;
    return {
      ...fixture,
      played: true,
      simulated: true,
      result: simulateFixtureResult({
        fixture,
        teamsById,
        seedBase,
        isPlayoff: true,
      }),
    };
  });

  return {
    ...fixturesData,
    fixtures: nextFixtures,
    simulationMeta: {
      ...(fixturesData?.simulationMeta && typeof fixturesData.simulationMeta === "object"
        ? fixturesData.simulationMeta
        : {}),
      lastPlayoffSimulatedDay: Number(dayNumber),
      simulatedPlayoffCount: simulatedCount,
    },
  };
};

export const areAllPlayoffFinalsPlayed = (fixturesData) => {
  const finals = Array.isArray(fixturesData?.fixtures)
    ? fixturesData.fixtures.filter((fixture) => fixture.stage === PLAYOFF_STAGE)
    : [];
  if (finals.length === 0) return false;
  return finals.every((fixture) => fixture.played);
};

const getResultWinnerId = (fixture) => {
  const homeGoals = Number(fixture?.result?.homeGoals) || 0;
  const awayGoals = Number(fixture?.result?.awayGoals) || 0;
  if (homeGoals > awayGoals) return fixture.homeTeamId;
  if (awayGoals > homeGoals) return fixture.awayTeamId;
  return "";
};

const buildSeasonStandingsSummary = ({ seasonNumber, leagues, leagueTables, teamsById }) =>
  leagues.map((league) => {
    const rows = getStandingsRows({ league, leagueTables });
    return {
      leagueId: league.id,
      tier: league.tier,
      championTeamId: rows[0]?.teamId || "",
      championTeamName: teamsById?.[rows[0]?.teamId]?.name || rows[0]?.teamId || "",
      runnerUpTeamId: rows[1]?.teamId || "",
      runnerUpTeamName: teamsById?.[rows[1]?.teamId]?.name || rows[1]?.teamId || "",
      table: rows.map((row, index) => ({
        position: index + 1,
        teamId: row.teamId,
        teamName: teamsById?.[row.teamId]?.name || row.teamId,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDiff: row.goalDiff,
        points: row.points,
      })),
      seasonNumber,
    };
  });

const buildPlayoffSummary = ({ fixturesData, teamsById }) => {
  const finals = Array.isArray(fixturesData?.fixtures)
    ? fixturesData.fixtures.filter((fixture) => fixture.stage === PLAYOFF_STAGE && fixture.played)
    : [];
  return finals.map((fixture) => ({
    fixtureId: fixture.id,
    leagueId: fixture.leagueId,
    tier: fixture.tier,
    dayNumber: fixture.dayNumber,
    homeTeamId: fixture.homeTeamId,
    homeTeamName: teamsById?.[fixture.homeTeamId]?.name || fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    awayTeamName: teamsById?.[fixture.awayTeamId]?.name || fixture.awayTeamId,
    homeGoals: Number(fixture?.result?.homeGoals) || 0,
    awayGoals: Number(fixture?.result?.awayGoals) || 0,
    winnerTeamId: getResultWinnerId(fixture),
    winnerTeamName: teamsById?.[getResultWinnerId(fixture)]?.name || getResultWinnerId(fixture),
  }));
};

const computeVictoryProgress = ({
  previousCareer,
  standings,
  resolvedAt,
}) => {
  const current =
    previousCareer?.victoryProgress && typeof previousCareer.victoryProgress === "object"
      ? previousCareer.victoryProgress
      : {};
  const playerTeamId = previousCareer?.playerTeam?.id || "";
  const topTierStanding = (Array.isArray(standings) ? standings : []).find(
    (entry) => Number(entry.tier) === 1
  );

  const previousWonTopLeague =
    !!current.wonTopLeague || !!previousCareer?.wonTopLeague;
  const previousWonChampionsCup =
    !!current.wonChampionsCup || !!previousCareer?.wonChampionsCup;

  const wonTopLeagueThisSeason = topTierStanding?.championTeamId === playerTeamId;
  const wonTopLeague = previousWonTopLeague || wonTopLeagueThisSeason;
  // Champions Cup systems are added in later features. Preserve any existing flag.
  const wonChampionsCup = previousWonChampionsCup;
  const isCareerWon = wonTopLeague && wonChampionsCup;

  return {
    wonTopLeague,
    wonChampionsCup,
    isCareerWon,
    wonTopLeagueAt:
      !previousWonTopLeague && wonTopLeagueThisSeason
        ? resolvedAt
        : current.wonTopLeagueAt || "",
    wonChampionsCupAt: current.wonChampionsCupAt || "",
    careerWonAt:
      isCareerWon && !current.isCareerWon
        ? resolvedAt
        : current.careerWonAt || "",
    updatedAt: resolvedAt,
  };
};

const computeRelegationProgress = ({
  previousCareer,
  previousSeasonNumber,
  previousLeagues,
  previousLeagueTables,
  movements,
  resolvedAt,
}) => {
  const current =
    previousCareer?.relegationProgress && typeof previousCareer.relegationProgress === "object"
      ? previousCareer.relegationProgress
      : {};
  const alreadyProcessedSeason = Number(current.lastProcessedSeason) || 0;
  if (alreadyProcessedSeason >= previousSeasonNumber) {
    return current;
  }

  const playerTeamId = previousCareer?.playerTeam?.id || "";
  const lowestTier = previousLeagues.reduce(
    (maxTier, league) => Math.max(maxTier, Number(league.tier) || maxTier),
    1
  );
  const playerLeague =
    previousLeagues.find((league) =>
      (Array.isArray(league.teamIds) ? league.teamIds : []).includes(playerTeamId)
    ) || null;
  const playerRows = playerLeague ? getStandingsRows({ league: playerLeague, leagueTables: previousLeagueTables }) : [];
  const playerIndex = playerRows.findIndex((row) => row.teamId === playerTeamId);
  const isBottomFinish = playerIndex >= 0 && playerRows.length > 0 && playerIndex === playerRows.length - 1;
  const isBottomTierFinish = Number(playerLeague?.tier) === lowestTier && isBottomFinish;
  const relegatedByMovement = movements.some(
    (movement) => movement.type === "RELEGATION" && movement.teamId === playerTeamId
  );
  // Bottom-tier last-place season counts as a relegation strike even though movement is capped.
  const relegatedThisSeason = relegatedByMovement || isBottomTierFinish;

  const totalRelegations = (Number(current.totalRelegations) || 0) + (relegatedThisSeason ? 1 : 0);
  const consecutiveRelegations = relegatedThisSeason
    ? (Number(current.consecutiveRelegations) || 0) + 1
    : 0;
  const bottomTierRelegations =
    (Number(current.bottomTierRelegations) || 0) + (isBottomTierFinish ? 1 : 0);

  const hitConsecutiveLimit = consecutiveRelegations >= 2;
  const hitTotalLimit = totalRelegations >= 5;
  const isGameOver = hitConsecutiveLimit || hitTotalLimit;

  let gameOverReason = "";
  if (hitConsecutiveLimit) {
    gameOverReason = "Game over: relegated in two consecutive seasons.";
  } else if (hitTotalLimit) {
    gameOverReason = "Game over: relegated five times overall.";
  }

  return {
    totalRelegations,
    consecutiveRelegations,
    bottomTierRelegations,
    lastSeasonRelegated: relegatedThisSeason,
    lastSeasonBottomTierRelegation: isBottomTierFinish,
    lastProcessedSeason: previousSeasonNumber,
    isGameOver,
    gameOverReason,
    gameOverAt:
      isGameOver && !current.gameOverAt
        ? resolvedAt
        : current.gameOverAt || "",
    updatedAt: resolvedAt,
  };
};

export const resolveSeasonAndCreateNextSeasonState = ({
  previousState,
  teamsById,
  resolvedAt = new Date().toISOString(),
}) => {
  const previousCareer = previousState?.career;
  const previousSeason = previousCareer?.season;
  const previousLeagues = Array.isArray(previousCareer?.leagues) ? previousCareer.leagues : [];
  const previousFixtures = previousCareer?.fixtures;
  const previousLeagueTables = createLeagueTablesFromFixtures({
    leagues: previousLeagues,
    fixturesData: previousFixtures,
  });
  const previousSeasonNumber = Number(previousSeason?.seasonNumber) || 1;
  const nextLeaguesResolved = createLeaguesAfterPromotionRelegation({
    leagues: previousLeagues,
    leagueTables: previousLeagueTables,
    fixturesData: previousFixtures,
  });
  const relegationProgress = computeRelegationProgress({
    previousCareer,
    previousSeasonNumber,
    previousLeagues,
    previousLeagueTables,
    movements: nextLeaguesResolved.movements,
    resolvedAt,
  });

  const seasonSummary = {
    seasonNumber: previousSeasonNumber,
    resolvedAt,
    standings: buildSeasonStandingsSummary({
      seasonNumber: previousSeasonNumber,
      leagues: previousLeagues,
      leagueTables: previousLeagueTables,
      teamsById,
    }),
    playoffFinals: buildPlayoffSummary({
      fixturesData: previousFixtures,
      teamsById,
    }),
    movements: nextLeaguesResolved.movements,
    relegationProgress,
  };
  const currentCupEligibility = createCupEligibilityState({
    playerTeam: previousCareer?.playerTeam,
    aiTeams: previousCareer?.aiTeams,
    leagues: previousLeagues,
    seasonNumber: previousSeasonNumber,
    updatedAt: resolvedAt,
  });
  const currentCups =
    previousCareer?.cups && typeof previousCareer.cups === "object"
      ? previousCareer.cups
      : createCareerCupsState({
          leagues: previousLeagues,
          playerTeam: previousCareer?.playerTeam,
          season: previousSeason,
          seasonNumber: previousSeasonNumber,
          seed: `${previousCareer?.createdAt || "career"}:season:${previousSeasonNumber}`,
        });
  const victoryProgress = computeVictoryProgress({
    previousCareer,
    standings: seasonSummary.standings,
    resolvedAt,
  });

  if (relegationProgress.isGameOver) {
    return {
      ...previousState,
      career: {
        ...(previousCareer && typeof previousCareer === "object" ? previousCareer : {}),
        status: "game_over",
        season: {
          ...previousSeason,
          currentDay: TOTAL_SEASON_DAYS,
        },
        fixtures: previousFixtures,
        leagueTables: previousLeagueTables,
        relegationProgress,
        cupEligibility: currentCupEligibility,
        cups: currentCups,
        pendingCupDraw: null,
        wonTopLeague: victoryProgress.wonTopLeague,
        wonChampionsCup: victoryProgress.wonChampionsCup,
        victoryProgress,
        seasonHistory: [
          ...(Array.isArray(previousCareer?.seasonHistory) ? previousCareer.seasonHistory : []),
          {
            ...seasonSummary,
            victoryProgress,
          },
        ],
        lastSeasonSummary: {
          ...seasonSummary,
          victoryProgress,
        },
        gameOver: {
          reason: relegationProgress.gameOverReason,
          at: relegationProgress.gameOverAt || resolvedAt,
        },
      },
    };
  }

  const nextSeasonNumber = previousSeasonNumber + 1;
  const nextSeason = createSeasonModel({ seasonNumber: nextSeasonNumber });
  const nextFixtures = createCareerFixtures({
    leagues: nextLeaguesResolved.leagues,
    season: nextSeason,
    seed: `${previousCareer?.createdAt || "career"}:season:${nextSeasonNumber}:fixtures`,
  });
  const nextLeagueTables = createLeagueTablesFromFixtures({
    leagues: nextLeaguesResolved.leagues,
    fixturesData: nextFixtures,
  });
  const nextTeams = applyCurrentTierToTeams({
    playerTeam: previousCareer?.playerTeam,
    aiTeams: previousCareer?.aiTeams,
    leagues: nextLeaguesResolved.leagues,
  });
  const balancedTeams = applyLeagueStrengthDistribution({
    playerTeam: nextTeams.playerTeam,
    aiTeams: nextTeams.aiTeams,
    leagues: nextLeaguesResolved.leagues,
    seed: `${previousCareer?.createdAt || "career"}:season:${nextSeasonNumber}:strengths`,
  });
  const nextCupEligibility = createCupEligibilityState({
    playerTeam: balancedTeams.playerTeam,
    aiTeams: balancedTeams.aiTeams,
    leagues: nextLeaguesResolved.leagues,
    seasonNumber: nextSeasonNumber,
    updatedAt: resolvedAt,
  });
  const teamsWithCupData = applyCupCompetitionToTeams({
    playerTeam: balancedTeams.playerTeam,
    aiTeams: balancedTeams.aiTeams,
    cupEligibility: nextCupEligibility,
  });
  const nextCups = createCareerCupsState({
    leagues: nextLeaguesResolved.leagues,
    playerTeam: teamsWithCupData.playerTeam,
    season: nextSeason,
    seasonNumber: nextSeasonNumber,
    seed: `${previousCareer?.createdAt || "career"}:season:${nextSeasonNumber}`,
  });

  return {
    ...previousState,
    career: {
      ...(previousCareer && typeof previousCareer === "object" ? previousCareer : {}),
      status: "ready",
      playerTeam: teamsWithCupData.playerTeam,
      aiTeams: teamsWithCupData.aiTeams,
      leagues: nextLeaguesResolved.leagues,
      season: nextSeason,
      fixtures: nextFixtures,
      leagueTables: nextLeagueTables,
      relegationProgress,
      cupEligibility: nextCupEligibility,
      cups: nextCups,
      pendingCupDraw: null,
      wonTopLeague: victoryProgress.wonTopLeague,
      wonChampionsCup: victoryProgress.wonChampionsCup,
      victoryProgress,
      seasonHistory: [
        ...(Array.isArray(previousCareer?.seasonHistory) ? previousCareer.seasonHistory : []),
        {
          ...seasonSummary,
          victoryProgress,
        },
      ],
      lastSeasonSummary: {
        ...seasonSummary,
        victoryProgress,
      },
    },
  };
};

export const isSeasonTransitionDay = ({ fixturesData, season }) => {
  const dayNumber = getPlayoffFinalDayNumber({ fixturesData, season });
  return dayNumber;
};

export const STAGE = Object.freeze({
  LEAGUE: LEAGUE_STAGE,
  PLAYOFF_FINAL: PLAYOFF_STAGE,
});
