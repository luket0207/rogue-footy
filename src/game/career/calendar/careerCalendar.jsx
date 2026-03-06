import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import { MODAL_BUTTONS, useModal } from "../../../engine/ui/modal/modalContext";
import { TOTAL_SEASON_DAYS } from "../utils/calendarModel";
import { FINAL_WEEK_FOR_PLAYOFF } from "../utils/fixtureGeneration";
import { createLeagueTablesFromFixtures } from "../utils/leagueTableState";
import { simulateOtherLeagueMatchesForDay } from "../utils/matchdaySimulation";
import {
  createCareerCupMatchPendingConfig,
  createCareerMatchPendingConfig,
  createCareerTeamsByIdWithCups,
} from "../utils/careerMatchFlow";
import {
  getUnplayedCupMatchesForDay,
  simulateNonPlayerCupMatchesForDay,
} from "../utils/cupMatchFlow";
import {
  areAllPlayoffFinalsPlayed,
  ensurePlayoffFinalFixtures,
  getPlayoffFinalDayNumber,
  resolveSeasonAndCreateNextSeasonState,
  simulateNonPlayerPlayoffFinalsForDay,
} from "../utils/seasonResolution";
import {
  getCupCompetitionForTier,
  getCupCompetitionLabel,
} from "../utils/cupEligibility";
import { getNextPendingCupDraw } from "../utils/cupDrawEvent";
import ControlPanel from "./controlPanel";
import "./careerCalendar.scss";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const CUP_KEY_LABEL = Object.freeze({
  swapCup: "Swap",
  superSwapCup: "Super Swap",
  championsCup: "Champions",
});
const CAREER_CALENDAR_PANEL = Object.freeze({
  CALENDAR: "calendar",
  LEAGUE_TABLE: "league_table",
});

const formatDaySummary = (scheduleEntry) => {
  if (!scheduleEntry) return "TBD";
  const dayNumber = Number(scheduleEntry.dayNumber) || 0;
  const dayName = scheduleEntry.dayName || "";
  return dayNumber > 0 ? `${dayName} Day ${dayNumber}` : dayName || "TBD";
};

const resolveTeamDebugOverall = (team) => {
  if (!team || typeof team !== "object") return 0;
  const directStrength = Number(team.teamStrength);
  if (Number.isFinite(directStrength) && directStrength > 0) {
    return Math.round(directStrength);
  }
  const squad = Array.isArray(team.squad) ? team.squad : [];
  if (squad.length === 0) return 0;
  const average =
    squad.reduce((sum, player) => sum + (Number(player?.overall) || 0), 0) / squad.length;
  return Math.round(average);
};

const CareerCalendar = () => {
  const navigate = useNavigate();
  const { gameState, setGameValue, setGameState } = useGame();
  const { openModal, closeModal } = useModal();
  const playerTeam = gameState?.career?.playerTeam || null;
  const aiTeamCount = Array.isArray(gameState?.career?.aiTeams) ? gameState.career.aiTeams.length : 0;
  const aiTeams = Array.isArray(gameState?.career?.aiTeams) ? gameState.career.aiTeams : [];
  const leagues = Array.isArray(gameState?.career?.leagues) ? gameState.career.leagues : [];
  const season = gameState?.career?.season || null;
  const seasonMonths = Array.isArray(season?.months) ? season.months : [];
  const seasonDays = Array.isArray(season?.days) ? season.days : [];
  const fixtureData = gameState?.career?.fixtures || null;
  const allFixtures = Array.isArray(fixtureData?.fixtures) ? fixtureData.fixtures : [];
  const leagueTables = gameState?.career?.leagueTables || {};
  const cupEligibility = gameState?.career?.cupEligibility || {};
  const swapCup = gameState?.career?.cups?.swapCup || null;
  const superSwapCup = gameState?.career?.cups?.superSwapCup || null;
  const championsCup = gameState?.career?.cups?.championsCup || null;
  const relegationProgress = gameState?.career?.relegationProgress || {};
  const victoryProgress = gameState?.career?.victoryProgress || {};
  const wonTopLeague = !!(victoryProgress.wonTopLeague || gameState?.career?.wonTopLeague);
  const wonChampionsCup = !!(victoryProgress.wonChampionsCup || gameState?.career?.wonChampionsCup);
  const isGameOver = gameState?.career?.status === "game_over" || !!relegationProgress?.isGameOver;
  const playerTeamId = playerTeam?.id || "";
  const playerLeague = leagues.find((league) => league.teamIds.includes(playerTeamId));
  const playerLeagueLabel = playerLeague ? playerLeague.name : "Unassigned";
  const playerCupCompetition =
    cupEligibility?.playerCup?.cupCompetition ||
    getCupCompetitionForTier(playerLeague?.tier || 10);
  const playerCupLabel =
    cupEligibility?.playerCup?.cupLabel ||
    getCupCompetitionLabel(playerCupCompetition);
  const currentDay = clamp(Number(season?.currentDay) || 1, 1, TOTAL_SEASON_DAYS);
  const currentDayData = seasonDays.find((day) => day.dayNumber === currentDay) || null;
  const canContinue =
    !!season &&
    Array.isArray(season.days) &&
    season.days.length === TOTAL_SEASON_DAYS &&
    !isGameOver;
  const [activeMonthIndex, setActiveMonthIndex] = useState(0);
  const [pendingDayNoticeDay, setPendingDayNoticeDay] = useState(0);
  const [openPanel, setOpenPanel] = useState(CAREER_CALENDAR_PANEL.CALENDAR);
  const lastLoggedDayKeyRef = useRef("");

  const teamById = useMemo(() => {
    const map = {};
    if (playerTeam?.id) {
      map[playerTeam.id] = {
        ...playerTeam,
        debugOverall: resolveTeamDebugOverall(playerTeam),
      };
    }
    aiTeams.forEach((team) => {
      map[team.id] = {
        ...team,
        debugOverall: resolveTeamDebugOverall(team),
      };
    });
    return map;
  }, [aiTeams, playerTeam]);

  const leagueTableRows = useMemo(() => {
    if (!playerLeague) return [];
    const sourceRows = Array.isArray(leagueTables?.[playerLeague.id]?.rows)
      ? leagueTables[playerLeague.id].rows
      : [];

    if (sourceRows.length > 0) {
      return sourceRows.map((row, index) => ({
        position: index + 1,
        teamName: teamById[row.teamId]?.name || row.teamId,
        teamOverall: Number(teamById[row.teamId]?.debugOverall) || 0,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDiff: row.goalDiff,
        points: row.points,
      }));
    }

    return playerLeague.teamIds.map((teamId, index) => ({
      position: index + 1,
      teamName: teamById[teamId]?.name || `Team ${index + 1}`,
      teamOverall: Number(teamById[teamId]?.debugOverall) || 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    }));
  }, [leagueTables, playerLeague, teamById]);

  const nextPlayerFixture = useMemo(() => {
    if (!playerTeamId) return null;
    const pending = allFixtures
      .filter(
        (fixture) =>
          !fixture.played &&
          (fixture.homeTeamId === playerTeamId || fixture.awayTeamId === playerTeamId) &&
          Number(fixture.dayNumber) >= currentDay
      )
      .sort((a, b) => {
        if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
        return a.matchday - b.matchday;
      });
    return pending[0] || null;
  }, [allFixtures, currentDay, playerTeamId]);
  const nextOpponentId = nextPlayerFixture
    ? nextPlayerFixture.homeTeamId === playerTeamId
      ? nextPlayerFixture.awayTeamId
      : nextPlayerFixture.homeTeamId
    : "";
  const nextOpponentName = nextOpponentId ? teamById[nextOpponentId]?.name || "TBD" : "TBD";

  const activeMonth = useMemo(() => {
    if (!Array.isArray(seasonMonths) || seasonMonths.length === 0) return null;
    const safeMonthIndex = clamp(activeMonthIndex, 0, seasonMonths.length - 1);
    return seasonMonths[safeMonthIndex] || null;
  }, [activeMonthIndex, seasonMonths]);

  const activeMonthDays = useMemo(() => {
    if (!activeMonth || !Array.isArray(activeMonth.weeks)) return [];
    return activeMonth.weeks.flatMap((week) =>
      Array.isArray(week?.days) ? week.days : []
    );
  }, [activeMonth]);

  const matchMarkersByDay = useMemo(() => {
    const byDay = {};
    const findCupDrawDay = (scheduledDayNumber) => {
      const safeScheduled = Number(scheduledDayNumber) || 0;
      if (safeScheduled <= 0) return 0;

      const fridayCandidates = seasonDays.filter(
        (day) => day.dayName === "Fri" && Number(day.dayNumber) < safeScheduled
      );
      let bestDayNumber = 0;
      fridayCandidates.forEach((day) => {
        const dayNumber = Number(day.dayNumber) || 0;
        const delta = safeScheduled - dayNumber;
        if (delta < 1 || delta > 5) return;
        if (dayNumber > bestDayNumber) {
          bestDayNumber = dayNumber;
        }
      });
      return bestDayNumber;
    };

    const addMarker = (dayNumber, marker) => {
      const safeDay = Number(dayNumber) || 0;
      if (safeDay <= 0) return;
      if (!byDay[safeDay]) {
        byDay[safeDay] = {
          hasAnyMatch: false,
          hasPlayerMatch: false,
          labels: [],
        };
      }
      const shouldMarkAsMatchDay = marker?.isMatch !== false;
      if (shouldMarkAsMatchDay) {
        byDay[safeDay].hasAnyMatch = true;
      }
      if (marker.isPlayerMatch) {
        byDay[safeDay].hasPlayerMatch = true;
      }
      if (!byDay[safeDay].labels.includes(marker.label)) {
        byDay[safeDay].labels.push(marker.label);
      }
    };

    allFixtures.forEach((fixture) => {
      const isPlayerMatch =
        fixture.homeTeamId === playerTeamId || fixture.awayTeamId === playerTeamId;
      const fixtureLabel = fixture.stage === "PLAYOFF_FINAL" ? "Playoff" : "League";
      addMarker(fixture.dayNumber, {
        label: isPlayerMatch ? "Player Match" : fixtureLabel,
        isPlayerMatch,
      });
    });

    Object.entries(gameState?.career?.cups || {}).forEach(([cupKey, cup]) => {
      const rounds = Array.isArray(cup?.rounds) ? cup.rounds : [];
      const schedules = Array.isArray(cup?.roundSchedule)
        ? cup.roundSchedule
        : rounds
            .map((round) => round?.schedule)
            .filter(Boolean);

      schedules.forEach((schedule) => {
        const drawDayNumber = findCupDrawDay(schedule?.dayNumber);
        if (!drawDayNumber) return;
        addMarker(drawDayNumber, {
          label: "Cup Draw Day",
          isPlayerMatch: false,
          isMatch: false,
        });
      });

      rounds.forEach((round) => {
        const scheduleByRound =
          round?.schedule ||
          (Array.isArray(cup?.roundSchedule)
            ? cup.roundSchedule.find((entry) => entry.roundKey === round?.key)
            : null) ||
          null;
        const matches = Array.isArray(round?.matches) ? round.matches : [];
        matches.forEach((match) => {
          if (!match?.homeTeamId || !match?.awayTeamId) return;
          const dayNumber =
            Number(match?.scheduledDayNumber) || Number(scheduleByRound?.dayNumber) || 0;
          const isPlayerMatch =
            match.homeTeamId === playerTeamId || match.awayTeamId === playerTeamId;
          addMarker(dayNumber, {
            label: isPlayerMatch
              ? "Player Match"
              : `${CUP_KEY_LABEL[cupKey] || "Cup"} Cup`,
            isPlayerMatch,
          });
        });
      });
    });

    return byDay;
  }, [allFixtures, gameState?.career?.cups, playerTeamId, seasonDays]);

  const hasPlayerMatchToday = useMemo(() => {
    const hasLeagueMatchToday = allFixtures.some(
      (fixture) =>
        !fixture.played &&
        Number(fixture.dayNumber) === currentDay &&
        (fixture.homeTeamId === playerTeamId || fixture.awayTeamId === playerTeamId)
    );
    if (hasLeagueMatchToday) return true;

    const todayCupMatches = getUnplayedCupMatchesForDay({
      cups: gameState?.career?.cups,
      dayNumber: currentDay,
    });
    return todayCupMatches.some(
      (match) => match.homeTeamId === playerTeamId || match.awayTeamId === playerTeamId
    );
  }, [allFixtures, currentDay, gameState?.career?.cups, playerTeamId]);

  const currentSeasonNumber = Number(season?.seasonNumber) || 1;
  const swapCupSummary = useMemo(
    () =>
      swapCup
        ? `${Array.isArray(swapCup.entryTeamIds) ? swapCup.entryTeamIds.length : 0} teams (${swapCup.status})`
        : "Not generated",
    [swapCup]
  );
  const swapCupScheduleSummary = useMemo(
    () =>
      `R32 ${formatDaySummary(swapCup?.roundSchedule?.[0])}, R16 ${formatDaySummary(
        swapCup?.roundSchedule?.[1]
      )}, QF ${formatDaySummary(swapCup?.roundSchedule?.[2])}, SF ${formatDaySummary(
        swapCup?.roundSchedule?.[3]
      )}, Final ${formatDaySummary(swapCup?.roundSchedule?.[4])}`,
    [swapCup]
  );
  const superSwapCupSummary = useMemo(
    () =>
      superSwapCup
        ? `${Array.isArray(superSwapCup.entryTeamIds) ? superSwapCup.entryTeamIds.length : 0} teams (${
            superSwapCup.status
          })`
        : "Not generated",
    [superSwapCup]
  );
  const superSwapCupScheduleSummary = useMemo(
    () =>
      `R32 ${formatDaySummary(superSwapCup?.roundSchedule?.[0])}, R16 ${formatDaySummary(
        superSwapCup?.roundSchedule?.[1]
      )}, QF ${formatDaySummary(superSwapCup?.roundSchedule?.[2])}, SF ${formatDaySummary(
        superSwapCup?.roundSchedule?.[3]
      )}, Final ${formatDaySummary(superSwapCup?.roundSchedule?.[4])}`,
    [superSwapCup]
  );
  const championsCupSummary = useMemo(
    () =>
      championsCup
        ? `${Array.isArray(championsCup.entryTeamIds) ? championsCup.entryTeamIds.length : 0} teams, ${
            Array.isArray(championsCup.foreignTeams) ? championsCup.foreignTeams.length : 0
          } foreign (${championsCup.status})`
        : "Not generated",
    [championsCup]
  );
  const championsCupScheduleSummary = useMemo(
    () =>
      `R32 ${formatDaySummary(championsCup?.roundSchedule?.[0])}, R16 ${formatDaySummary(
        championsCup?.roundSchedule?.[1]
      )}, QF ${formatDaySummary(championsCup?.roundSchedule?.[2])}, SF ${formatDaySummary(
        championsCup?.roundSchedule?.[3]
      )}, Final ${formatDaySummary(championsCup?.roundSchedule?.[4])}`,
    [championsCup]
  );
  const dayTransitionNotice = gameState?.career?.dayTransitionNotice || {};
  const suppressNextDayNotice = !!gameState?.career?.suppressNextDayNotice;
  const lastShownDayForSeason =
    Number(dayTransitionNotice?.seasonNumber) === currentSeasonNumber
      ? Number(dayTransitionNotice?.lastShownDay) || 1
      : 1;

  useEffect(() => {
    setGameValue("mode", "career");
  }, [setGameValue]);

  useEffect(() => {
    if (!currentDayData) return;
    const seasonDayKey = `${currentSeasonNumber}:${currentDay}`;
    if (lastLoggedDayKeyRef.current === seasonDayKey) return;

    lastLoggedDayKeyRef.current = seasonDayKey;

    console.groupCollapsed(
      `[Career Day Start] Season ${currentSeasonNumber} Day ${currentDayData.dayNumber} (${currentDayData.dayName})`
    );
    console.log("Main Career hub.");
    console.log(`AI teams generated: ${aiTeamCount}`);
    console.log(`Leagues generated: ${leagues.length}`);
    console.log(`Player league: ${playerLeagueLabel}`);
    console.log(`Cup eligibility: ${playerCupLabel}`);
    console.log(`Swap Cup: ${swapCupSummary}`);
    console.log(`Swap Cup schedule: ${swapCupScheduleSummary}`);
    console.log(`Super Swap Cup: ${superSwapCupSummary}`);
    console.log(`Super Swap Cup schedule: ${superSwapCupScheduleSummary}`);
    console.log(`Champions Cup: ${championsCupSummary}`);
    console.log(`Champions Cup schedule: ${championsCupScheduleSummary}`);
    console.log(`Season days: ${seasonDays.length}/${TOTAL_SEASON_DAYS}`);
    console.log(`Current day: ${currentDayData.dayNumber} (${currentDayData.dayName})`);
    console.log(`Regular fixtures generated: ${allFixtures.length}`);
    console.log(
      `Relegations: total ${Number(relegationProgress.totalRelegations) || 0}, consecutive ${
        Number(relegationProgress.consecutiveRelegations) || 0
      }`
    );
    console.log(
      `Victory progress: Top League ${wonTopLeague ? "Won" : "Not yet"}, Champions Cup ${
        wonChampionsCup ? "Won" : "Not yet"
      }`
    );
    console.groupEnd();
  }, [
    aiTeamCount,
    allFixtures.length,
    championsCupScheduleSummary,
    championsCupSummary,
    currentDay,
    currentDayData,
    currentSeasonNumber,
    leagues.length,
    playerCupLabel,
    playerLeagueLabel,
    relegationProgress.consecutiveRelegations,
    relegationProgress.totalRelegations,
    seasonDays.length,
    swapCupScheduleSummary,
    swapCupSummary,
    superSwapCupScheduleSummary,
    superSwapCupSummary,
    wonChampionsCup,
    wonTopLeague,
  ]);

  useEffect(() => {
    if (!Array.isArray(seasonMonths) || seasonMonths.length === 0) return;
    const monthIndexFromDay = Math.max(
      0,
      (Number(currentDayData?.monthIndex) || 1) - 1
    );
    setActiveMonthIndex((previous) => {
      if (previous >= 0 && previous < seasonMonths.length) {
        return previous;
      }
      return Math.min(monthIndexFromDay, seasonMonths.length - 1);
    });
  }, [currentDayData?.monthIndex, seasonMonths]);

  useEffect(() => {
    if (suppressNextDayNotice) {
      setGameState((previous) => ({
        ...previous,
        career: {
          ...(previous?.career && typeof previous.career === "object" ? previous.career : {}),
          suppressNextDayNotice: false,
          dayTransitionNotice: {
            seasonNumber: currentSeasonNumber,
            lastShownDay: currentDay,
            acknowledgedAt: new Date().toISOString(),
          },
        },
      }));
      setPendingDayNoticeDay(0);
      return;
    }

    if (!currentDayData) return;
    if (currentDay <= 1) return;
    if (currentDay <= lastShownDayForSeason) return;
    if (pendingDayNoticeDay === currentDay) return;

    setPendingDayNoticeDay(currentDay);
    openModal({
      modalTitle: "Day Advanced",
      modalContent: (
        <div>
          <p>
            You moved to Day {currentDayData.dayNumber} ({currentDayData.dayName}).
          </p>
        </div>
      ),
      buttons: MODAL_BUTTONS.OK,
      onClick: () => {
        setGameState((previous) => ({
          ...previous,
          career: {
            ...(previous?.career && typeof previous.career === "object" ? previous.career : {}),
            dayTransitionNotice: {
              seasonNumber: currentSeasonNumber,
              lastShownDay: currentDayData.dayNumber,
              acknowledgedAt: new Date().toISOString(),
            },
          },
        }));
        setPendingDayNoticeDay(0);
        closeModal();
      },
    });
  }, [
    closeModal,
    currentDay,
    currentDayData,
    currentSeasonNumber,
    lastShownDayForSeason,
    openModal,
    pendingDayNoticeDay,
    setPendingDayNoticeDay,
    suppressNextDayNotice,
    setGameState,
  ]);

  const handleContinue = () => {
    if (isGameOver) return;
    const careerState = gameState?.career;
    const currentSeason = careerState?.season;
    const currentFixturesData = careerState?.fixtures;
    const currentLeagues = Array.isArray(careerState?.leagues) ? careerState.leagues : [];

    if (
      !currentSeason ||
      !Array.isArray(currentSeason.days) ||
      currentSeason.days.length !== TOTAL_SEASON_DAYS
    ) {
      return;
    }

    const safeCurrentDay = clamp(Number(currentSeason.currentDay) || 1, 1, TOTAL_SEASON_DAYS);
    const currentDayInfo = currentSeason.days[safeCurrentDay - 1] || null;
    const currentDayName = currentDayInfo?.dayName || "";
    const playoffFinalDay = getPlayoffFinalDayNumber({
      fixturesData: currentFixturesData,
      season: currentSeason,
    });
    const teamsById = createCareerTeamsByIdWithCups({
      playerTeam: careerState?.playerTeam,
      aiTeams: careerState?.aiTeams,
      cups: careerState?.cups,
    });

    if (careerState?.pendingCupDraw) {
      navigate("/career/cup-draw");
      return;
    }

    const pendingCupDraw = getNextPendingCupDraw({
      cups: careerState?.cups,
      currentDayNumber: safeCurrentDay,
      currentDayName,
      teamsById,
    });
    if (pendingCupDraw) {
      setGameState((previous) => ({
        ...previous,
        career: {
          ...(previous?.career && typeof previous.career === "object" ? previous.career : {}),
          pendingCupDraw,
        },
      }));
      navigate("/career/cup-draw");
      return;
    }

    const tablesFromCurrentFixtures = createLeagueTablesFromFixtures({
      leagues: currentLeagues,
      fixturesData: currentFixturesData,
    });
    const fixturesWithPlayoffFinals =
      safeCurrentDay >= playoffFinalDay
        ? ensurePlayoffFinalFixtures({
            fixturesData: currentFixturesData,
            leagues: currentLeagues,
            leagueTables: tablesFromCurrentFixtures,
            season: currentSeason,
            seedBase: `${careerState?.createdAt || "career"}:season:${currentSeason?.seasonNumber || 1}`,
          })
        : currentFixturesData;

    const todayUnplayedFixtures = Array.isArray(fixturesWithPlayoffFinals?.fixtures)
      ? fixturesWithPlayoffFinals.fixtures.filter(
          (fixture) => !fixture.played && Number(fixture.dayNumber) === safeCurrentDay
        )
      : [];
    const playerFixtureToday = todayUnplayedFixtures.find(
      (fixture) =>
        fixture.homeTeamId === playerTeamId || fixture.awayTeamId === playerTeamId
    );
    const todayCupMatches = getUnplayedCupMatchesForDay({
      cups: careerState?.cups,
      dayNumber: safeCurrentDay,
    });
    const playerCupMatchToday = todayCupMatches.find(
      (cupMatch) =>
        cupMatch.homeTeamId === playerTeamId || cupMatch.awayTeamId === playerTeamId
    ) || null;

    if (playerFixtureToday || playerCupMatchToday) {
      const withSimulatedLeagueMatches = simulateOtherLeagueMatchesForDay({
        fixturesData: fixturesWithPlayoffFinals,
        dayNumber: safeCurrentDay,
        playerTeamId,
        teamsById,
        seedBase: `${careerState?.createdAt || "career"}:day:${safeCurrentDay}`,
      });
      const nextFixtures = simulateNonPlayerPlayoffFinalsForDay({
        fixturesData: withSimulatedLeagueMatches,
        dayNumber: safeCurrentDay,
        playerTeamId,
        teamsById,
        seedBase: `${careerState?.createdAt || "career"}:playoff:${safeCurrentDay}`,
      });
      const cupSimulation = simulateNonPlayerCupMatchesForDay({
        cups: careerState?.cups,
        dayNumber: safeCurrentDay,
        playerTeamId,
        teamsById,
        seedBase: `${careerState?.createdAt || "career"}:cup:${safeCurrentDay}`,
      });
      const nextCups = cupSimulation.cups;
      const nextLeagueTables = createLeagueTablesFromFixtures({
        leagues: currentLeagues,
        fixturesData: nextFixtures,
      });
      const pendingConfig = playerFixtureToday
        ? createCareerMatchPendingConfig({
            careerState: {
              ...(careerState && typeof careerState === "object" ? careerState : {}),
              cups: nextCups,
            },
            fixture: playerFixtureToday,
            dayNumber: safeCurrentDay,
          })
        : createCareerCupMatchPendingConfig({
            careerState: {
              ...(careerState && typeof careerState === "object" ? careerState : {}),
              cups: nextCups,
            },
            cupMatch: playerCupMatchToday,
            dayNumber: safeCurrentDay,
          });
      if (!pendingConfig) return;

      setGameState((previous) => ({
        ...previous,
        career: {
          ...(previous?.career && typeof previous.career === "object" ? previous.career : {}),
          fixtures: nextFixtures,
          leagueTables: nextLeagueTables,
          cups: nextCups,
        },
        match: {
          ...(previous?.match && typeof previous.match === "object" ? previous.match : {}),
          pendingConfig,
          activeCareerMatch: {
            fixtureId: playerFixtureToday?.id || playerCupMatchToday?.matchId || "",
            dayNumber: safeCurrentDay,
            competitionType: playerFixtureToday ? "LEAGUE" : "CUP",
            cupKey: playerCupMatchToday?.cupKey || "",
          },
        },
      }));
      navigate("/career/pre-match");
      return;
    }

    setGameState((previous) => {
      const previousSeason = previous?.career?.season;
      if (
        !previousSeason ||
        !Array.isArray(previousSeason.days) ||
        previousSeason.days.length !== TOTAL_SEASON_DAYS
      ) {
        return previous;
      }

      const previousCareer = previous?.career;
      const previousFixturesData = previousCareer?.fixtures;
      const previousLeagues = Array.isArray(previousCareer?.leagues) ? previousCareer.leagues : [];
      const seasonCurrentDay = clamp(Number(previousSeason.currentDay) || 1, 1, TOTAL_SEASON_DAYS);
      const previousTeamsById = createCareerTeamsByIdWithCups({
        playerTeam: previousCareer?.playerTeam,
        aiTeams: previousCareer?.aiTeams,
        cups: previousCareer?.cups,
      });
      const previousPlayoffDay = getPlayoffFinalDayNumber({
        fixturesData: previousFixturesData,
        season: previousSeason,
      });

      const previousTables = createLeagueTablesFromFixtures({
        leagues: previousLeagues,
        fixturesData: previousFixturesData,
      });
      const withPlayoffFinals =
        seasonCurrentDay >= previousPlayoffDay
          ? ensurePlayoffFinalFixtures({
              fixturesData: previousFixturesData,
              leagues: previousLeagues,
              leagueTables: previousTables,
              season: previousSeason,
              seedBase: `${previousCareer?.createdAt || "career"}:season:${previousSeason?.seasonNumber || 1}`,
            })
          : previousFixturesData;
      const withLeagueSim = simulateOtherLeagueMatchesForDay({
        fixturesData: withPlayoffFinals,
        dayNumber: seasonCurrentDay,
        playerTeamId,
        teamsById: previousTeamsById,
        seedBase: `${previousCareer?.createdAt || "career"}:day:${seasonCurrentDay}`,
      });
      const withPlayoffSim = simulateNonPlayerPlayoffFinalsForDay({
        fixturesData: withLeagueSim,
        dayNumber: seasonCurrentDay,
        playerTeamId,
        teamsById: previousTeamsById,
        seedBase: `${previousCareer?.createdAt || "career"}:playoff:${seasonCurrentDay}`,
      });
      const cupSimulation = simulateNonPlayerCupMatchesForDay({
        cups: previousCareer?.cups,
        dayNumber: seasonCurrentDay,
        playerTeamId,
        teamsById: previousTeamsById,
        seedBase: `${previousCareer?.createdAt || "career"}:cup:${seasonCurrentDay}`,
      });
      const withCupSim = cupSimulation.cups;
      const nextLeagueTables = createLeagueTablesFromFixtures({
        leagues: previousLeagues,
        fixturesData: withPlayoffSim,
      });

      if (seasonCurrentDay >= previousPlayoffDay && areAllPlayoffFinalsPlayed(withPlayoffSim)) {
        const transitioned = resolveSeasonAndCreateNextSeasonState({
          previousState: {
            ...previous,
            career: {
              ...(previousCareer && typeof previousCareer === "object" ? previousCareer : {}),
              fixtures: withPlayoffSim,
              leagueTables: nextLeagueTables,
              cups: withCupSim,
            },
          },
          teamsById: previousTeamsById,
        });
        return transitioned;
      }

      const completed = new Set(
        Array.isArray(previousSeason.completedDayIds) ? previousSeason.completedDayIds : []
      );
      const completedDay = previousSeason.days[seasonCurrentDay - 1];
      if (completedDay?.id) {
        completed.add(completedDay.id);
      }
      const nextDay =
        seasonCurrentDay >= TOTAL_SEASON_DAYS
          ? seasonCurrentDay
          : seasonCurrentDay + 1;

      return {
        ...previous,
        career: {
          ...(previousCareer && typeof previousCareer === "object" ? previousCareer : {}),
          season: {
            ...previousSeason,
            currentDay: nextDay,
            completedDayIds: Array.from(completed),
          },
          fixtures: withPlayoffSim,
          leagueTables: nextLeagueTables,
          cups: withCupSim,
        },
      };
    });
  };

  const handleQuit = () => {
    openModal({
      modalTitle: "Quit Career",
      modalContent: (
        <div>
          <p>Are you sure you want to quit and return to Home?</p>
        </div>
      ),
      buttons: MODAL_BUTTONS.YES_NO,
      onYes: () => {
        setGameValue("mode", "sandbox");
        closeModal();
        navigate("/");
      },
      onNo: () => {
        closeModal();
      },
    });
  };

  const continueLabel = isGameOver
    ? "Game Over"
    : hasPlayerMatchToday
      ? "Start Match"
      : currentDay >= TOTAL_SEASON_DAYS
        ? "Resolve Season"
        : "Continue";

  return (
    <div className="careerCalendar">
      <section className="careerCalendar__panel">
        {isGameOver && (
          <p>Career status: {relegationProgress.gameOverReason || "Game over."}</p>
        )}

        <div className="careerCalendar__hubGrid">
          <section className="careerCalendar__hubCard">
            <h2>Next Fixture</h2>
            {nextPlayerFixture ? (
              <>
                <p>
                  Day {nextPlayerFixture.dayNumber} ({nextPlayerFixture.dayName})
                </p>
                <p>Opponent: {nextOpponentName}</p>
                <p>Matchday: {nextPlayerFixture.matchday}</p>
              </>
            ) : (
              <p>No remaining league fixture for this season.</p>
            )}
            <p>Final week {FINAL_WEEK_FOR_PLAYOFF} reserved for playoff final.</p>
          </section>

          <ControlPanel
            continueLabel={continueLabel}
            canContinue={canContinue}
            onContinue={handleContinue}
            onQuit={handleQuit}
          />
        </div>

        <div className="careerCalendar__accordion">
          <section className={`careerCalendar__accordionPanel${openPanel === CAREER_CALENDAR_PANEL.CALENDAR ? " is-open" : ""}`}>
            <button
              type="button"
              className="careerCalendar__accordionToggle"
              onClick={() => setOpenPanel(CAREER_CALENDAR_PANEL.CALENDAR)}
              aria-expanded={openPanel === CAREER_CALENDAR_PANEL.CALENDAR}
            >
              Calendar
            </button>
            {openPanel === CAREER_CALENDAR_PANEL.CALENDAR && (
              <div className="careerCalendar__accordionBody">
                <div className="careerCalendar__season">
                  {activeMonth ? (
                    <section className="careerCalendar__month" key={activeMonth.id}>
                      <div className="careerCalendar__monthHeader">
                        <Button
                          variant={BUTTON_VARIANT.SECONDARY}
                          onClick={() =>
                            setActiveMonthIndex((previous) => Math.max(0, previous - 1))
                          }
                          disabled={activeMonthIndex <= 0}
                        >
                          Prev Month
                        </Button>
                        <h2>{activeMonth.name}</h2>
                        <Button
                          variant={BUTTON_VARIANT.SECONDARY}
                          onClick={() =>
                            setActiveMonthIndex((previous) =>
                              Math.min(seasonMonths.length - 1, previous + 1)
                            )
                          }
                          disabled={activeMonthIndex >= seasonMonths.length - 1}
                        >
                          Next Month
                        </Button>
                      </div>

                      <div className="careerCalendar__dayGrid">
                        {activeMonthDays.map((day) => {
                          const dayMarkers = matchMarkersByDay[day.dayNumber];
                          const isCurrentDay = day.dayNumber === currentDay;
                          const dayClassName = [
                            "careerCalendar__day",
                            day.isWeekend ? "is-weekend" : "",
                            isCurrentDay ? "is-current-day" : "",
                            dayMarkers?.hasAnyMatch ? "is-match-day" : "",
                            dayMarkers?.hasPlayerMatch ? "is-player-match-day" : "",
                          ]
                            .filter(Boolean)
                            .join(" ");

                          return (
                            <div className={dayClassName} key={day.id}>
                              <div className="careerCalendar__dayTop">
                                <span>{day.dayName}</span>
                                <strong>{day.dayNumber}</strong>
                              </div>
                              <div className="careerCalendar__dayMeta">
                                {isCurrentDay ? "Current Day" : `Day ${day.dayNumber}`}
                              </div>
                              {dayMarkers?.labels?.length > 0 && (
                                <div className="careerCalendar__dayTags">
                                  {dayMarkers.labels.slice(0, 2).map((label) => (
                                    <span
                                      className={`careerCalendar__dayTag${
                                        label === "Player Match" ? " is-player" : ""
                                      }`}
                                      key={`${day.id}-${label}`}
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className="careerCalendar__month">
                      <h2>No Calendar Data</h2>
                    </section>
                  )}
                </div>
              </div>
            )}
          </section>

          <section
            className={`careerCalendar__accordionPanel${
              openPanel === CAREER_CALENDAR_PANEL.LEAGUE_TABLE ? " is-open" : ""
            }`}
          >
            <button
              type="button"
              className="careerCalendar__accordionToggle"
              onClick={() => setOpenPanel(CAREER_CALENDAR_PANEL.LEAGUE_TABLE)}
              aria-expanded={openPanel === CAREER_CALENDAR_PANEL.LEAGUE_TABLE}
            >
              League Table
            </button>
            {openPanel === CAREER_CALENDAR_PANEL.LEAGUE_TABLE && (
              <div className="careerCalendar__accordionBody">
                <section className="careerCalendar__tableSection">
                  <div className="careerCalendar__tableWrap">
                    <table className="careerCalendar__table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Team</th>
                          <th>P</th>
                          <th>W</th>
                          <th>D</th>
                          <th>L</th>
                          <th>GF</th>
                          <th>GA</th>
                          <th>GD</th>
                          <th>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leagueTableRows.map((row) => (
                          <tr key={`${row.position}-${row.teamName}`}>
                            <td>{row.position}</td>
                            <td>
                              {row.teamName}
                              <span className="careerCalendar__debugOverall">
                                {" "}
                                (OVR {row.teamOverall}) [DEBUG REMOVE]
                              </span>
                            </td>
                            <td>{row.played}</td>
                            <td>{row.wins}</td>
                            <td>{row.draws}</td>
                            <td>{row.losses}</td>
                            <td>{row.goalsFor}</td>
                            <td>{row.goalsAgainst}</td>
                            <td>{row.goalDiff}</td>
                            <td>{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};

export default CareerCalendar;
