/* eslint-disable react/prop-types */

import { TEAM_KEY } from "../utils/matchSimTypes";
import { getTeamThemeStyle } from "../utils/teamColors";

const MatchLog = ({ matchState }) => {
  if (matchState.status === "idle") {
    return (
      <section className="matchSim__panel">
        <h2>Match Log</h2>
        <p>No events yet.</p>
      </section>
    );
  }

  const teamAName = matchState.setup[TEAM_KEY.A].name;
  const teamBName = matchState.setup[TEAM_KEY.B].name;
  const items = [...matchState.log].reverse();

  return (
    <section className="matchSim__panel">
      <h2>Match Log</h2>
      <div className="matchSim__logList">
        {items.length === 0 ? (
          <div className="matchSim__muted">No events yet.</div>
        ) : (
          items.map((item) => (
            <div
              className={`matchSim__logItem${item.teamId ? " matchSim__logItem--team" : ""}`}
              key={item.id}
              style={getTeamThemeStyle(matchState.setup, item.teamId) || undefined}
            >
              <div className="matchSim__logTop">
                <span>
                  {item.minute}' {item.half} (Chunk {item.chunkIndex})
                </span>
                <span className="matchSim__logTeamName">
                  {item.teamId && <span className="matchSim__teamColorIcon" aria-hidden="true" />}
                  {item.teamId === TEAM_KEY.A ? teamAName : item.teamId === TEAM_KEY.B ? teamBName : "Match"}
                </span>
              </div>
              <div>
                {item.minute}' {item.half}: {item.text}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default MatchLog;
