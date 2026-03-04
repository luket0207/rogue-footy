/* eslint-disable react/prop-types */

import { TEAM_KEY } from "../utils/matchSimTypes";

const MatchTimeline = ({ matchState }) => {
  if (matchState.status === "idle") {
    return (
      <section className="matchSim__panel">
        <h2>Goal Timeline</h2>
        <p>No events yet.</p>
      </section>
    );
  }

  const teamAName = matchState.setup[TEAM_KEY.A].name;
  const teamBName = matchState.setup[TEAM_KEY.B].name;
  const goals = matchState.goalsTimeline || [];

  return (
    <section className="matchSim__panel">
      <h2>Goal Timeline</h2>

      {goals.length === 0 ? (
        <p>No goals scored.</p>
      ) : (
        <div className="matchSim__timelineList">
          {goals.map((goal) => (
            <div className="matchSim__timelineItem" key={goal.id}>
              <div className="matchSim__timelineMinute">
                {goal.minute}' {goal.half}
              </div>
              <div className="matchSim__timelineDetails">
                <div>
                  <strong>{goal.scorerName}</strong> for{" "}
                  {goal.teamKey === TEAM_KEY.A ? teamAName : teamBName}
                </div>
                <div className="matchSim__timelineScore">
                  Score: {teamAName} {goal.scoreA} - {goal.scoreB} {teamBName}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default MatchTimeline;

