import { autoFillLineup } from "../../../features/matchSim/utils/lineup";
import { clamp } from "../../../features/matchSim/utils/math";
import {
  ATTACKING_TACTIC,
  ATTACKING_TACTIC_OPTIONS,
  DEFENSIVE_TACTIC,
  DEFENSIVE_TACTIC_OPTIONS,
  POSITION,
} from "../../../features/matchSim/utils/matchSimTypes";
import { createGeneratedPlayers } from "../../../features/matchSim/utils/playerFactory";
import { createSeededRng } from "../../../features/matchSim/utils/seededRng";
import { TOTAL_SEASON_DAYS } from "./calendarModel";
import { applyCupMatchResultToCups, createCareerCupTeamsById } from "./cupMatchFlow";
import { createLeagueTablesFromFixtures } from "./leagueTableState";
import {
  autoFillCareerLineup,
  createCareerLineupFromLegacySlots,
  DEFAULT_CAREER_FORMATION,
  isCareerLineupComplete,
  isValidCareerFormation,
  normalizeCareerLineup,
} from "./teamSetup";

const CAREER_MATCH_FORMATION = DEFAULT_CAREER_FORMATION;

const DEFAULT_PLAYER_TACTICS = Object.freeze({
  attacking: ATTACKING_TACTIC.DIRECT,
  defensive: DEFENSIVE_TACTIC.MID_BLOCK,
});
const DEFAULT_HOME_COLOR = "#1d4ed8";
const DEFAULT_AWAY_COLOR = "#b91c1c";

const resolveTeamColor = (team, fallbackColor) =>
  (typeof team?.homeColor === "string" && team.homeColor) ||
  (typeof team?.awayColor === "string" && team.awayColor) ||
  fallbackColor;

const pickNearestByOverall = ({
  candidates,
  count,
  targetOverall,
  usedIds,
  rng,
}) => {
  const sorted = [...candidates]
    .filter((player) => player && !usedIds.has(player.id))
    .sort((playerA, playerB) => {
      const deltaA = Math.abs((Number(playerA.overall) || 70) - targetOverall);
      const deltaB = Math.abs((Number(playerB.overall) || 70) - targetOverall);
      if (deltaA !== deltaB) return deltaA - deltaB;
      return rng.random() - 0.5;
    });

  const selected = sorted.slice(0, count);
  selected.forEach((player) => usedIds.add(player.id));
  return selected;
};

const sanitizeLineupToSquad = (lineup, squadIds, formation) => {
  const normalized = normalizeCareerLineup(lineup, formation);
  const usedIds = new Set();
  const sanitizeId = (playerId) => {
    if (!playerId || !squadIds.has(playerId) || usedIds.has(playerId)) {
      return "";
    }
    usedIds.add(playerId);
    return playerId;
  };

  return {
    gkId: sanitizeId(normalized.gkId),
    [POSITION.DEF]: normalized[POSITION.DEF].map((playerId) => sanitizeId(playerId)),
    [POSITION.MID]: normalized[POSITION.MID].map((playerId) => sanitizeId(playerId)),
    [POSITION.FWR]: normalized[POSITION.FWR].map((playerId) => sanitizeId(playerId)),
  };
};

const resolvePlayerTeamFormation = (playerTeam) => {
  const matchSetupFormation = playerTeam?.matchSetup?.formation;
  if (isValidCareerFormation(matchSetupFormation)) return matchSetupFormation;
  if (isValidCareerFormation(playerTeam?.formation)) return playerTeam.formation;
  return CAREER_MATCH_FORMATION;
};

const createPlayerTeamLineup = (playerTeam, squad, formation) => {
  const squadIds = new Set((Array.isArray(squad) ? squad : []).map((player) => player.id));
  const matchSetupLineup = playerTeam?.matchSetup?.lineup;
  const legacySlots =
    playerTeam?.lineup && typeof playerTeam.lineup === "object" ? playerTeam.lineup : {};

  const baseLineup =
    matchSetupLineup && typeof matchSetupLineup === "object"
      ? normalizeCareerLineup(matchSetupLineup, formation)
      : createCareerLineupFromLegacySlots(legacySlots, formation);
  const sanitizedLineup = sanitizeLineupToSquad(baseLineup, squadIds, formation);

  if (isCareerLineupComplete(sanitizedLineup, formation, squadIds)) {
    return sanitizedLineup;
  }

  return autoFillCareerLineup(squad, formation);
};

const resolvePlayerTeamStrength = (playerTeam) => {
  const squad = Array.isArray(playerTeam?.squad) ? playerTeam.squad : [];
  if (squad.length === 0) return 75;
  const avgOverall =
    squad.reduce((sum, player) => sum + (Number(player.overall) || 70), 0) / squad.length;
  return clamp(Math.round(avgOverall), 50, 98);
};

const resolvePlayerTeamTactics = (playerTeam) => {
  const rawTactics =
    playerTeam?.matchSetup?.tactics && typeof playerTeam.matchSetup.tactics === "object"
      ? playerTeam.matchSetup.tactics
      : playerTeam?.tactics && typeof playerTeam.tactics === "object"
        ? playerTeam.tactics
        : null;

  const attacking = ATTACKING_TACTIC_OPTIONS.includes(rawTactics?.attacking)
    ? rawTactics.attacking
    : DEFAULT_PLAYER_TACTICS.attacking;
  const defensive = DEFENSIVE_TACTIC_OPTIONS.includes(rawTactics?.defensive)
    ? rawTactics.defensive
    : DEFAULT_PLAYER_TACTICS.defensive;

  return {
    attacking,
    defensive,
  };
};

const resolveAiTactics = (teamStrength, rng) => {
  if (teamStrength >= 90) {
    return {
      attacking: rng.random() < 0.5 ? ATTACKING_TACTIC.POSSESSION : ATTACKING_TACTIC.COUNTER,
      defensive: DEFENSIVE_TACTIC.HIGH_PRESS,
    };
  }
  if (teamStrength >= 84) {
    return {
      attacking: rng.random() < 0.5 ? ATTACKING_TACTIC.POSSESSION : ATTACKING_TACTIC.DIRECT,
      defensive: DEFENSIVE_TACTIC.MID_BLOCK,
    };
  }
  if (teamStrength >= 76) {
    return {
      attacking: ATTACKING_TACTIC.DIRECT,
      defensive: DEFENSIVE_TACTIC.MID_BLOCK,
    };
  }
  return {
    attacking: ATTACKING_TACTIC.DIRECT,
    defensive: DEFENSIVE_TACTIC.LOW_BLOCK,
  };
};

const createAiLineupPlayers = ({ teamId, teamStrength, seed }) => {
  const rng = createSeededRng(`${seed}:order`);
  const generatedPool = createGeneratedPlayers({
    seed: `${seed}:pool:${teamId}`,
    perPosition: 10,
  }).map((player, index) => ({
    ...player,
    id: `${teamId}_mx_${String(index + 1).padStart(2, "0")}_${player.id}`,
  }));

  const byRole = generatedPool.reduce(
    (result, player) => {
      const role = player.preferredPos;
      if (!result[role]) return result;
      result[role].push(player);
      return result;
    },
    {
      [POSITION.GK]: [],
      [POSITION.DEF]: [],
      [POSITION.MID]: [],
      [POSITION.FWR]: [],
    }
  );

  const usedIds = new Set();
  const gk = pickNearestByOverall({
    candidates: byRole[POSITION.GK],
    count: 1,
    targetOverall: teamStrength,
    usedIds,
    rng,
  });
  const defs = pickNearestByOverall({
    candidates: byRole[POSITION.DEF],
    count: 2,
    targetOverall: teamStrength,
    usedIds,
    rng,
  });
  const mids = pickNearestByOverall({
    candidates: byRole[POSITION.MID],
    count: 2,
    targetOverall: teamStrength + 1,
    usedIds,
    rng,
  });
  const fwrs = pickNearestByOverall({
    candidates: byRole[POSITION.FWR],
    count: 1,
    targetOverall: teamStrength + 2,
    usedIds,
    rng,
  });

  const lineupPlayers = [...gk, ...defs, ...mids, ...fwrs];
  const fallbackPool = generatedPool.filter((player) => !usedIds.has(player.id));
  while (lineupPlayers.length < 6 && fallbackPool.length > 0) {
    const next = fallbackPool.shift();
    if (!next) break;
    lineupPlayers.push(next);
  }

  return lineupPlayers;
};

const createAiTeamConfig = ({ team, seed }) => {
  const teamStrength = clamp(Number(team?.teamStrength) || 75, 50, 99);
  const rng = createSeededRng(`${seed}:tactics:${team?.id || "ai_team"}`);
  const selectedPlayers = createAiLineupPlayers({
    teamId: team.id,
    teamStrength,
    seed,
  });
  const lineup = autoFillLineup(selectedPlayers, CAREER_MATCH_FORMATION, 0);

  return {
    players: selectedPlayers,
    teamConfig: {
      name: team?.name || "Opposition",
      formation: CAREER_MATCH_FORMATION,
      tactics: resolveAiTactics(teamStrength, rng),
      lineup,
    },
  };
};

const createPlayerTeamConfig = (playerTeam) => {
  const squad = Array.isArray(playerTeam?.squad) ? playerTeam.squad : [];
  const tactics = resolvePlayerTeamTactics(playerTeam);
  const formation = resolvePlayerTeamFormation(playerTeam);

  return {
    players: squad,
    teamConfig: {
      name: playerTeam?.name || "Player Team",
      formation,
      tactics,
      lineup: createPlayerTeamLineup(playerTeam, squad, formation),
    },
  };
};

export const createCareerTeamsById = ({ playerTeam, aiTeams }) => {
  const map = {};
  if (playerTeam?.id) {
    map[playerTeam.id] = {
      ...playerTeam,
      teamStrength: resolvePlayerTeamStrength(playerTeam),
    };
  }
  (Array.isArray(aiTeams) ? aiTeams : []).forEach((team) => {
    map[team.id] = team;
  });
  return map;
};

export const createCareerTeamsByIdWithCups = ({ playerTeam, aiTeams, cups }) =>
  createCareerCupTeamsById({
    teamsById: createCareerTeamsById({ playerTeam, aiTeams }),
    cups,
  });

export const createCareerMatchPendingConfig = ({
  careerState,
  fixture,
  dayNumber,
}) => {
  const playerTeam = careerState?.playerTeam || null;
  const aiTeams = Array.isArray(careerState?.aiTeams) ? careerState.aiTeams : [];
  if (!playerTeam?.id || !fixture) return null;

  const opponentId =
    fixture.homeTeamId === playerTeam.id ? fixture.awayTeamId : fixture.homeTeamId;
  const opponentTeam = aiTeams.find((team) => team.id === opponentId) || null;
  if (!opponentTeam) return null;

  const seed = `${careerState?.createdAt || "career"}:fixture:${fixture.id}:day:${dayNumber}`;
  const playerSide = createPlayerTeamConfig(playerTeam);
  const aiSide = createAiTeamConfig({
    team: opponentTeam,
    seed,
  });

  const isPlayerHome = fixture.homeTeamId === playerTeam.id;
  const homeTeam = isPlayerHome ? playerTeam : opponentTeam;
  const awayTeam = isPlayerHome ? opponentTeam : playerTeam;
  const teamA = isPlayerHome ? playerSide.teamConfig : aiSide.teamConfig;
  const teamB = isPlayerHome ? aiSide.teamConfig : playerSide.teamConfig;
  const players = [...playerSide.players, ...aiSide.players];

  return {
    seed,
    chunkCount: 30,
    players,
    teamA,
    teamB,
    meta: {
      source: "career",
      competitionType: "LEAGUE",
      fixtureId: fixture.id,
      dayNumber: Number(dayNumber),
      leagueId: fixture.leagueId,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeTeamName: homeTeam?.name || "Home",
      awayTeamName: awayTeam?.name || "Away",
      teamAName: teamA.name,
      teamBName: teamB.name,
      teamAColor: resolveTeamColor(teamA === playerSide.teamConfig ? playerTeam : opponentTeam, DEFAULT_HOME_COLOR),
      teamBColor: resolveTeamColor(teamB === playerSide.teamConfig ? playerTeam : opponentTeam, DEFAULT_AWAY_COLOR),
      playerTeamId: playerTeam.id,
      returnPath: "/career/calendar",
      playerTeamKey: isPlayerHome ? "A" : "B",
    },
  };
};

export const createCareerCupMatchPendingConfig = ({
  careerState,
  cupMatch,
  dayNumber,
}) => {
  const playerTeam = careerState?.playerTeam || null;
  const aiTeams = Array.isArray(careerState?.aiTeams) ? careerState.aiTeams : [];
  if (!playerTeam?.id || !cupMatch?.homeTeamId || !cupMatch?.awayTeamId) return null;

  const isPlayerHome = cupMatch.homeTeamId === playerTeam.id;
  const isPlayerAway = cupMatch.awayTeamId === playerTeam.id;
  if (!isPlayerHome && !isPlayerAway) return null;

  const opponentId = isPlayerHome ? cupMatch.awayTeamId : cupMatch.homeTeamId;
  const teamsById = createCareerTeamsByIdWithCups({
    playerTeam,
    aiTeams,
    cups: careerState?.cups,
  });
  const opponentTeam = teamsById[opponentId] || null;
  const homeTeam = teamsById[cupMatch.homeTeamId] || null;
  const awayTeam = teamsById[cupMatch.awayTeamId] || null;
  if (!opponentTeam?.id) return null;

  const matchId = cupMatch.matchId || cupMatch.id || "";
  const seed = `${careerState?.createdAt || "career"}:cup:${cupMatch.cupKey}:${matchId}:day:${dayNumber}`;
  const playerSide = createPlayerTeamConfig(playerTeam);
  const aiSide = createAiTeamConfig({
    team: opponentTeam,
    seed,
  });

  const teamA = isPlayerHome ? playerSide.teamConfig : aiSide.teamConfig;
  const teamB = isPlayerHome ? aiSide.teamConfig : playerSide.teamConfig;
  const players = [...playerSide.players, ...aiSide.players];

  return {
    seed,
    chunkCount: 30,
    players,
    teamA,
    teamB,
    meta: {
      source: "career",
      competitionType: "CUP",
      fixtureId: matchId,
      cupMatchId: matchId,
      cupKey: cupMatch.cupKey || "",
      cupCompetition: cupMatch.competition || "",
      roundKey: cupMatch.roundKey || "",
      roundLabel: cupMatch.roundLabel || cupMatch.roundKey || "",
      dayNumber: Number(dayNumber),
      homeTeamId: cupMatch.homeTeamId,
      awayTeamId: cupMatch.awayTeamId,
      homeTeamName: homeTeam?.name || "Home",
      awayTeamName: awayTeam?.name || "Away",
      teamAName: teamA.name,
      teamBName: teamB.name,
      teamAColor: resolveTeamColor(teamA === playerSide.teamConfig ? playerTeam : opponentTeam, DEFAULT_HOME_COLOR),
      teamBColor: resolveTeamColor(teamB === playerSide.teamConfig ? playerTeam : opponentTeam, DEFAULT_AWAY_COLOR),
      playerTeamId: playerTeam.id,
      returnPath: "/career/calendar",
      playerTeamKey: isPlayerHome ? "A" : "B",
    },
  };
};

const markCareerDayComplete = (season, dayNumber) => {
  if (!season || !Array.isArray(season.days)) return season;
  const safeDay = clamp(Number(dayNumber) || 1, 1, TOTAL_SEASON_DAYS);
  const completed = new Set(Array.isArray(season.completedDayIds) ? season.completedDayIds : []);
  const completedDay = season.days[safeDay - 1];
  if (completedDay?.id) {
    completed.add(completedDay.id);
  }

  return {
    ...season,
    currentDay: clamp(safeDay + 1, 1, TOTAL_SEASON_DAYS),
    completedDayIds: Array.from(completed),
  };
};

export const applyCareerMatchResultToGameState = ({
  previousState,
  pendingConfig,
  scoreA,
  scoreB,
}) => {
  const career = previousState?.career;
  const fixturesData = career?.fixtures;
  const leagues = Array.isArray(career?.leagues) ? career.leagues : [];
  const fixtureId = pendingConfig?.meta?.fixtureId;
  const dayNumber = pendingConfig?.meta?.dayNumber;
  const competitionType = pendingConfig?.meta?.competitionType || "LEAGUE";
  const completedAt = new Date().toISOString();

  if (competitionType === "CUP") {
    const cupKey = pendingConfig?.meta?.cupKey || "";
    const cupMatchId = pendingConfig?.meta?.cupMatchId || fixtureId;
    if (!cupKey || !cupMatchId || !career?.cups) {
      return {
        ...previousState,
        match: {
          ...(previousState?.match && typeof previousState.match === "object"
            ? previousState.match
            : {}),
          pendingConfig: null,
          activeCareerMatch: null,
        },
      };
    }

    const nextCups = applyCupMatchResultToCups({
      cups: career.cups,
      cupKey,
      matchId: cupMatchId,
      homeGoals: Number(scoreA) || 0,
      awayGoals: Number(scoreB) || 0,
      seedBase: `${career?.createdAt || "career"}:cup:${cupKey}:${cupMatchId}:day:${Number(dayNumber) || 0}`,
      simulated: false,
      playedAt: completedAt,
    });
    const nextSeason = markCareerDayComplete(career?.season, dayNumber);

    const playerTeamId = career?.playerTeam?.id || "";
    const championsWinnerTeamId = nextCups?.championsCup?.winnerTeamId || "";
    const previousVictory =
      career?.victoryProgress && typeof career.victoryProgress === "object"
        ? career.victoryProgress
        : {};
    const wonTopLeague = !!previousVictory.wonTopLeague || !!career?.wonTopLeague;
    const wonChampionsCup =
      !!previousVictory.wonChampionsCup || championsWinnerTeamId === playerTeamId;
    const isCareerWon = wonTopLeague && wonChampionsCup;

    const nextVictoryProgress = {
      ...previousVictory,
      wonTopLeague,
      wonChampionsCup,
      isCareerWon,
      wonTopLeagueAt: previousVictory.wonTopLeagueAt || "",
      wonChampionsCupAt:
        !previousVictory.wonChampionsCup && championsWinnerTeamId === playerTeamId
          ? completedAt
          : previousVictory.wonChampionsCupAt || "",
      careerWonAt:
        isCareerWon && !previousVictory.isCareerWon
          ? completedAt
          : previousVictory.careerWonAt || "",
      updatedAt: completedAt,
    };

    return {
      ...previousState,
      career: {
        ...(career && typeof career === "object" ? career : {}),
        cups: nextCups,
        season: nextSeason,
        wonTopLeague,
        wonChampionsCup,
        victoryProgress: nextVictoryProgress,
      },
      match: {
        ...(previousState?.match && typeof previousState.match === "object"
          ? previousState.match
          : {}),
        pendingConfig: null,
        activeCareerMatch: {
          ...(previousState?.match?.activeCareerMatch &&
          typeof previousState.match.activeCareerMatch === "object"
            ? previousState.match.activeCareerMatch
            : {}),
          completed: true,
          completedAt,
        },
        lastCareerMatchResult: {
          fixtureId: cupMatchId,
          dayNumber,
          competitionType: "CUP",
          cupKey,
          roundKey: pendingConfig?.meta?.roundKey || "",
          homeTeamId: pendingConfig?.meta?.homeTeamId || "",
          awayTeamId: pendingConfig?.meta?.awayTeamId || "",
          homeTeamName: pendingConfig?.meta?.homeTeamName || "",
          awayTeamName: pendingConfig?.meta?.awayTeamName || "",
          teamAName: pendingConfig?.meta?.teamAName || "",
          teamBName: pendingConfig?.meta?.teamBName || "",
          teamAColor: pendingConfig?.meta?.teamAColor || "",
          teamBColor: pendingConfig?.meta?.teamBColor || "",
          scoreA: Number(scoreA) || 0,
          scoreB: Number(scoreB) || 0,
          completedAt,
        },
      },
    };
  }

  if (!fixtureId || !fixturesData || !Array.isArray(fixturesData.fixtures)) {
    return {
      ...previousState,
      match: {
        ...(previousState?.match && typeof previousState.match === "object"
          ? previousState.match
          : {}),
        pendingConfig: null,
        activeCareerMatch: null,
      },
    };
  }

  const nextFixtures = fixturesData.fixtures.map((fixture) => {
    if (fixture.id !== fixtureId || fixture.played) return fixture;
    return {
      ...fixture,
      played: true,
      simulated: false,
      result: {
        homeGoals: Number(scoreA) || 0,
        awayGoals: Number(scoreB) || 0,
      },
    };
  });

  const updatedFixturesData = {
    ...fixturesData,
    fixtures: nextFixtures,
  };
  const nextLeagueTables = createLeagueTablesFromFixtures({
    leagues,
    fixturesData: updatedFixturesData,
  });
  const nextSeason = markCareerDayComplete(career?.season, dayNumber);

  return {
    ...previousState,
    career: {
      ...(career && typeof career === "object" ? career : {}),
      fixtures: updatedFixturesData,
      leagueTables: nextLeagueTables,
      season: nextSeason,
    },
    match: {
      ...(previousState?.match && typeof previousState.match === "object"
        ? previousState.match
        : {}),
      pendingConfig: null,
      activeCareerMatch: {
        ...(previousState?.match?.activeCareerMatch &&
        typeof previousState.match.activeCareerMatch === "object"
          ? previousState.match.activeCareerMatch
          : {}),
        completed: true,
        completedAt,
      },
      lastCareerMatchResult: {
        fixtureId,
        dayNumber,
        competitionType: "LEAGUE",
        homeTeamId: pendingConfig?.meta?.homeTeamId || "",
        awayTeamId: pendingConfig?.meta?.awayTeamId || "",
        homeTeamName: pendingConfig?.meta?.homeTeamName || "",
        awayTeamName: pendingConfig?.meta?.awayTeamName || "",
        teamAName: pendingConfig?.meta?.teamAName || "",
        teamBName: pendingConfig?.meta?.teamBName || "",
        teamAColor: pendingConfig?.meta?.teamAColor || "",
        teamBColor: pendingConfig?.meta?.teamBColor || "",
        scoreA: Number(scoreA) || 0,
        scoreB: Number(scoreB) || 0,
        completedAt,
      },
    },
  };
};
