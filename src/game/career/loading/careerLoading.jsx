import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../../../engine/gameContext/gameContext";
import { createTimer } from "../../../engine/utils/timer/timer";
import { CAREER_AI_TEAM_COUNT, createCareerAiTeams } from "../utils/teamGeneration";
import { createCareerLeagues } from "../utils/leagueGeneration";
import { ensureSeasonModel } from "../utils/calendarModel";
import {
  createCareerFixtures,
  isValidCareerFixtures,
} from "../utils/fixtureGeneration";
import {
  createLeagueTablesFromFixtures,
  isValidLeagueTables,
} from "../utils/leagueTableState";
import {
  applyCupCompetitionToTeams,
  createCupEligibilityState,
} from "../utils/cupEligibility";
import { createCareerCupsState } from "../utils/swapCupStructure";
import { applyLeagueStrengthDistribution } from "../utils/teamStrengthDistribution";
import "./careerLoading.scss";

const GENERATION_STEPS = Object.freeze([
  Object.freeze({ id: "teams", label: "Generating teams" }),
  Object.freeze({ id: "leagues", label: "Creating leagues" }),
  Object.freeze({ id: "calendar", label: "Preparing calendar" }),
]);

const STEP_FREQUENCY_MS = 900;

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

const logGeneratedLeaguesSnapshot = ({ leagues = [], playerTeam, aiTeams = [] }) => {
  const teamsById = {};
  if (playerTeam?.id) {
    teamsById[playerTeam.id] = playerTeam;
  }
  (Array.isArray(aiTeams) ? aiTeams : []).forEach((team) => {
    if (team?.id) teamsById[team.id] = team;
  });

  const sortedLeagues = [...(Array.isArray(leagues) ? leagues : [])].sort(
    (leagueA, leagueB) => Number(leagueA?.tier) - Number(leagueB?.tier)
  );

  console.groupCollapsed("[Career Init] League team allocation snapshot");
  sortedLeagues.forEach((league) => {
    const tierLabel = `Tier ${Number(league?.tier) || 0}`;
    const leagueName = league?.name || tierLabel;
    const teamIds = Array.isArray(league?.teamIds) ? league.teamIds : [];
    console.group(`${leagueName} (${teamIds.length} teams)`);
    teamIds.forEach((teamId, index) => {
      const team = teamsById[teamId] || null;
      const teamName = team?.name || teamId || `Team ${index + 1}`;
      const overall = resolveTeamDebugOverall(team);
      console.log(`${String(index + 1).padStart(2, "0")}. ${teamName} (OVR ${overall})`);
    });
    console.groupEnd();
  });
  console.groupEnd();
};

const CareerLoading = () => {
  const navigate = useNavigate();
  const { setGameValue, setGameState } = useGame();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const timerRef = useRef(null);

  const completedStepIds = useMemo(
    () => GENERATION_STEPS.slice(0, activeStepIndex).map((step) => step.id),
    [activeStepIndex]
  );

  useEffect(() => {
    setGameValue("mode", "career");

    timerRef.current = createTimer({
      duration: GENERATION_STEPS.length,
      frequencyMs: STEP_FREQUENCY_MS,
      onTick: (tickIndex) => {
        const clamped = Math.min(GENERATION_STEPS.length, Math.max(1, tickIndex));
        setActiveStepIndex(clamped);
      },
      onFinish: () => {
        const completedAt = new Date().toISOString();
        setGameState((previous) => {
          const existingAiTeams = Array.isArray(previous?.career?.aiTeams)
            ? previous.career.aiTeams
            : [];
          const aiTeams =
            existingAiTeams.length === CAREER_AI_TEAM_COUNT
              ? existingAiTeams
              : createCareerAiTeams({
                  seed: `${previous?.career?.createdAt || "career"}:${previous?.career?.playerTeam?.name || "player"}`,
                  reservedNames: previous?.career?.playerTeam?.name
                    ? [previous.career.playerTeam.name]
                    : [],
                  avoidColors: [
                    previous?.career?.playerTeam?.homeColor,
                    previous?.career?.playerTeam?.awayColor,
                  ].filter(Boolean),
                });
          const existingLeagues = Array.isArray(previous?.career?.leagues)
            ? previous.career.leagues
            : [];
          const leagues =
            existingLeagues.length === 10
              ? existingLeagues
              : createCareerLeagues({
                  aiTeams,
                  playerTeam: previous?.career?.playerTeam,
                  seed: `${previous?.career?.createdAt || "career"}:leagues`,
                });
          const season = ensureSeasonModel(previous?.career?.season, {
            seasonNumber: previous?.career?.season?.seasonNumber || 1,
          });
          const existingFixtures = previous?.career?.fixtures;
          const fixtures = isValidCareerFixtures(existingFixtures, leagues.length)
            ? existingFixtures
            : createCareerFixtures({
                leagues,
                season,
                seed: `${previous?.career?.createdAt || "career"}:fixtures`,
              });
          const existingLeagueTables = previous?.career?.leagueTables;
          const leagueTables = isValidLeagueTables(existingLeagueTables, leagues)
            ? existingLeagueTables
            : createLeagueTablesFromFixtures({
                leagues,
                fixturesData: fixtures,
              });
          const balancedTeams = applyLeagueStrengthDistribution({
            playerTeam: previous?.career?.playerTeam,
            aiTeams,
            leagues,
            seed: `${previous?.career?.createdAt || "career"}:season:${season?.seasonNumber || 1}:strengths`,
          });
          const cupEligibility = createCupEligibilityState({
            playerTeam: balancedTeams.playerTeam,
            aiTeams: balancedTeams.aiTeams,
            leagues,
            seasonNumber: season?.seasonNumber || 1,
            updatedAt: completedAt,
          });
          const teamsWithCupData = applyCupCompetitionToTeams({
            playerTeam: balancedTeams.playerTeam,
            aiTeams: balancedTeams.aiTeams,
            cupEligibility,
          });
          const seasonNumber = season?.seasonNumber || 1;
          const cups = createCareerCupsState({
            leagues,
            playerTeam: teamsWithCupData.playerTeam,
            season,
            seasonNumber,
            seed: `${previous?.career?.createdAt || "career"}:season:${seasonNumber}`,
          });

          logGeneratedLeaguesSnapshot({
            leagues,
            playerTeam: teamsWithCupData.playerTeam,
            aiTeams: teamsWithCupData.aiTeams,
          });

          return {
            ...previous,
            mode: "career",
            career: {
              ...(previous?.career && typeof previous.career === "object" ? previous.career : {}),
              status: "ready",
              playerTeam: teamsWithCupData.playerTeam,
              aiTeams: teamsWithCupData.aiTeams,
              leagues,
              season,
              fixtures,
              leagueTables,
              cupEligibility,
              cups,
              pendingCupDraw: null,
              generation: {
                completedAt,
                completedSteps: GENERATION_STEPS.map((step) => step.id),
                teamCount: teamsWithCupData.aiTeams.length,
                leagueCount: leagues.length,
                fixtureCount: Array.isArray(fixtures?.fixtures) ? fixtures.fixtures.length : 0,
              },
            },
          };
        });
        navigate("/career/calendar", { replace: true });
      },
      autoStart: true,
    });

    return () => {
      if (timerRef.current) {
        timerRef.current.stop();
        timerRef.current = null;
      }
    };
  }, [navigate, setGameState, setGameValue]);

  return (
    <div className="careerLoading">
      <section className="careerLoading__panel">
        <h1>Starting Career</h1>
        <p>Building your new world...</p>

        <div className="careerLoading__spinner" aria-label="Loading" />

        <div className="careerLoading__steps">
          {GENERATION_STEPS.map((step, index) => {
            const isDone = completedStepIds.includes(step.id);
            const isActive = index === activeStepIndex;
            return (
              <div
                className={`careerLoading__step${isDone ? " is-done" : ""}${isActive ? " is-active" : ""}`}
                key={step.id}
              >
                {step.label}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default CareerLoading;
