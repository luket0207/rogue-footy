import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import { useMatchSim } from "../hooks/useMatchSim";
import { TEAM_KEY } from "../utils/matchSimTypes";
import { applyCareerMatchResultToGameState } from "../../../game/career/utils/careerMatchFlow";
import CurrentEventBanner from "./currentEventBanner";
import Scoreboard from "./scoreboard";
import MatchLog from "./MatchLog";
import MatchDebug from "./matchDebug";
import GoalOverlay from "./GoalOverlay";
import "./matchScreen.scss";

const MATCH_SPEED_OPTIONS = Object.freeze([
  { key: "VERY_FAST", label: "Very Fast", seconds: 0.3 },
  { key: "FAST", label: "Fast", seconds: 1 },
  { key: "NORMAL", label: "Normal", seconds: 2 },
  { key: "SLOW", label: "Slow", seconds: 3 },
]);

const Match = () => {
  const navigate = useNavigate();
  const { gameState, setGameState, setGameValue } = useGame();
  const pendingConfig = gameState.match?.pendingConfig || null;
  const autoKickOffToken = gameState.match?.autoKickOffToken || "";
  const isCareerMatch = pendingConfig?.meta?.source === "career";
  const hasCommittedCareerResultRef = useRef(false);
  const consumedAutoKickOffTokenRef = useRef("");

  const { matchState, isPlaying, goalOverlayEvent, playbackSpeed, initializeMatch, kickOff, setPlaybackSpeed } =
    useMatchSim();

  useEffect(() => {
    if (!pendingConfig) return;
    if (matchState.status !== "idle") return;
    initializeMatch(pendingConfig);
  }, [initializeMatch, matchState.status, pendingConfig]);

  useEffect(() => {
    hasCommittedCareerResultRef.current = false;
    consumedAutoKickOffTokenRef.current = "";
  }, [pendingConfig?.meta?.fixtureId]);

  useEffect(() => {
    if (!autoKickOffToken) return;
    if (consumedAutoKickOffTokenRef.current === autoKickOffToken) return;
    if (matchState.status === "idle") return;
    if (matchState.phase !== "pre_kickoff") return;

    consumedAutoKickOffTokenRef.current = autoKickOffToken;
    setGameValue("match.autoKickOffToken", "");
    kickOff();
  }, [
    autoKickOffToken,
    kickOff,
    matchState.phase,
    matchState.status,
    setGameValue,
  ]);

  useEffect(() => {
    if (!isCareerMatch) return;
    if (matchState.phase !== "finished") return;
    if (hasCommittedCareerResultRef.current) return;

    hasCommittedCareerResultRef.current = true;
    const scoreA = Number(matchState.score?.[TEAM_KEY.A]) || 0;
    const scoreB = Number(matchState.score?.[TEAM_KEY.B]) || 0;

    setGameState((previous) =>
      applyCareerMatchResultToGameState({
        previousState: previous,
        pendingConfig,
        scoreA,
        scoreB,
      })
    );
    navigate("/career/match-summary", { replace: true });
  }, [isCareerMatch, matchState.phase, matchState.score, navigate, pendingConfig, setGameState]);

  const kickOffLabel = useMemo(() => {
    if (matchState.phase === "half_time") return "Kick Off Second Half";
    if (matchState.phase === "finished") return "Match Finished";
    if (isPlaying) return "In Play...";
    return "Kick Off";
  }, [isPlaying, matchState.phase]);

  if (!pendingConfig) {
    return (
      <div className="matchSim">
        <section className="matchSim__panel">
          <h2>No Match Config Found</h2>
          {gameState?.mode === "career" ? (
            <>
              <p>No active career match was found.</p>
              <Button variant={BUTTON_VARIANT.PRIMARY} to="/career/calendar">
                Back to Calendar
              </Button>
            </>
          ) : (
            <>
              <p>Start from team selection to create a debug match.</p>
              <Button variant={BUTTON_VARIANT.PRIMARY} to="/team-selection">
                Go to Team Selection
              </Button>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="matchSim">
      <GoalOverlay event={goalOverlayEvent} setup={matchState.setup} />

      <header className="matchSim__header">
        <div>
          <h1>Match</h1>
          <p>Interactive match playback. 60 minutes total, 30 per half, 30 chunks fixed.</p>
        </div>

        <div className="matchSim__headerActions">
          {!isCareerMatch && (
            <Button variant={BUTTON_VARIANT.TERTIARY} to="/team-selection">
              Back to Team Selection
            </Button>
          )}
        </div>
      </header>

      <CurrentEventBanner matchState={matchState} isPlaying={isPlaying} />

      <section className="matchSim__panel">
        <div className="matchSim__kickOffRow">
          <Button
            variant={BUTTON_VARIANT.PRIMARY}
            onClick={kickOff}
            disabled={isPlaying || matchState.phase === "finished"}
          >
            {kickOffLabel}
          </Button>
          <div className="matchSim__phaseText">
            Phase: {matchState.phase === "pre_kickoff" ? "Ready" : matchState.phase} | Minute: {matchState.currentMinute}'
          </div>
        </div>

        <div className="matchSim__speedRow">
          <div className="matchSim__speedLabel">Match Speed:</div>
          {MATCH_SPEED_OPTIONS.map((option) => (
            <Button
              key={option.key}
              variant={playbackSpeed === option.key ? BUTTON_VARIANT.PRIMARY : BUTTON_VARIANT.SECONDARY}
              onClick={() => setPlaybackSpeed(option.key)}
              disabled={matchState.phase === "finished"}
            >
              {option.label} ({option.seconds}s)
            </Button>
          ))}
        </div>
      </section>

      <div className="matchSim__resultsGrid">
        <Scoreboard matchState={matchState} />
        <MatchLog matchState={matchState} />
      </div>

      <div className="matchSim__timelineWrap">
        <MatchDebug matchState={matchState} />
      </div>
    </div>
  );
};

export default Match;

