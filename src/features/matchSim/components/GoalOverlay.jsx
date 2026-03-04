/* eslint-disable react/prop-types */

import { TEAM_KEY } from "../utils/matchSimTypes";

const GoalOverlay = ({ event, setup }) => {
  if (!event) return null;

  const teamName = setup?.[event.teamId]?.name || (event.teamId === TEAM_KEY.A ? "Team A" : "Team B");

  return (
    <div className="matchSim__goalOverlay">
      <div className="matchSim__goalOverlayCard">
        <div className="matchSim__goalOverlayTitle">GOAL</div>
        <div className="matchSim__goalOverlayTeam">{teamName}</div>
        <div className="matchSim__goalOverlayText">{event.text}</div>
        {event.scoreAfter && (
          <div className="matchSim__goalOverlayScore">
            {event.scoreAfter.a} - {event.scoreAfter.b}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalOverlay;

