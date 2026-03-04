import { useEffect, useMemo } from "react";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import { useMatchSim } from "../hooks/useMatchSim";
import CurrentEventBanner from "./currentEventBanner";
import Scoreboard from "./scoreboard";
import MatchLog from "./MatchLog";
import MatchTimeline from "./MatchTimeline";
import MatchDebug from "./matchDebug";
import "./matchScreen.scss";

const Match = () => {
  const { gameState } = useGame();
  const pendingConfig = gameState.match?.pendingConfig || null;

  const { matchState, isPlaying, initializeMatch, kickOff, resetMatch } = useMatchSim();

  useEffect(() => {
    if (!pendingConfig) return;
    initializeMatch(pendingConfig);
  }, [initializeMatch, pendingConfig]);

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
          <p>Start from team selection to create a debug match.</p>
          <Button variant={BUTTON_VARIANT.PRIMARY} to="/team-selection">
            Go to Team Selection
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="matchSim">
      <header className="matchSim__header">
        <div>
          <h1>Match</h1>
          <p>Interactive match playback. 60 minutes total, 30 per half, 30 chunks fixed.</p>
        </div>

        <div className="matchSim__headerActions">
          <Button variant={BUTTON_VARIANT.TERTIARY} to="/team-selection">
            Back to Team Selection
          </Button>
          <Button variant={BUTTON_VARIANT.SECONDARY} onClick={resetMatch}>
            Restart Match
          </Button>
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
            Phase: {matchState.phase === "pre_kickoff" ? "Ready" : matchState.phase}
          </div>
        </div>
      </section>

      <div className="matchSim__resultsGrid">
        <Scoreboard matchState={matchState} />
        <MatchLog matchState={matchState} />
      </div>

      <div className="matchSim__timelineWrap">
        <MatchTimeline matchState={matchState} />
      </div>

      <div className="matchSim__timelineWrap">
        <MatchDebug matchState={matchState} />
      </div>
    </div>
  );
};

export default Match;

