/* eslint-disable react/prop-types */

import { TEAM_KEY } from "../utils/matchSimTypes";

const CurrentEventBanner = ({ matchState, isPlaying }) => {
  if (matchState.status === "idle") {
    return (
      <section className="matchSim__panel matchSim__eventBanner">
        <h2>Current Event</h2>
        <div>Waiting for match data.</div>
      </section>
    );
  }

  const teamAName = matchState.setup?.[TEAM_KEY.A]?.name || "Team A";
  const teamBName = matchState.setup?.[TEAM_KEY.B]?.name || "Team B";

  let title = "Current Event";
  let text = "Kick off to begin.";

  if (matchState.phase === "half_time") {
    title = "Half Time";
    text = `30' Half time. ${teamAName} ${matchState.score[TEAM_KEY.A]} - ${matchState.score[TEAM_KEY.B]} ${teamBName}`;
  } else if (matchState.phase === "finished") {
    title = "Full Time";
    text = `60' Full time. ${teamAName} ${matchState.score[TEAM_KEY.A]} - ${matchState.score[TEAM_KEY.B]} ${teamBName}`;
  } else if (matchState.currentEvent) {
    const event = matchState.currentEvent;
    title = `Minute ${event.minute}' - Chunk ${event.chunk}`;
    text = event.message;
  } else if (isPlaying) {
    text = "Play is live.";
  }

  return (
    <section className="matchSim__panel matchSim__eventBanner">
      <h2>{title}</h2>
      <div>{text}</div>
    </section>
  );
};

export default CurrentEventBanner;

