/* eslint-disable react/prop-types */

import { EVENT_KIND, TEAM_KEY } from "../utils/matchSimTypes";

const formatPossession = (chunksOwned, totalChunks) => {
  if (totalChunks <= 0) return "0.0%";
  return `${((chunksOwned / totalChunks) * 100).toFixed(1)}%`;
};

const buildScorerRows = (goalsTimeline, teamKey) => {
  return goalsTimeline.filter((goal) => goal.teamKey === teamKey);
};

const Scoreboard = ({ matchState }) => {
  if (matchState.status === "idle") {
    return (
      <section className="matchSim__panel">
        <h2>Scoreboard</h2>
        <p>Waiting for match.</p>
      </section>
    );
  }

  const teamAName = matchState.setup[TEAM_KEY.A].name;
  const teamBName = matchState.setup[TEAM_KEY.B].name;
  const totalChunks = matchState.chunk;
  const goalsTimeline = matchState.goalsTimeline || [];

  const teamAScorers = buildScorerRows(goalsTimeline, TEAM_KEY.A);
  const teamBScorers = buildScorerRows(goalsTimeline, TEAM_KEY.B);
  const keyEvents = [...matchState.log]
    .filter(
      (item) =>
        item.kind === EVENT_KIND.GOAL ||
        item.kind === EVENT_KIND.SHOT ||
        item.kind === EVENT_KIND.SHOT_SAVED ||
        item.kind === EVENT_KIND.SHOT_BLOCKED ||
        item.kind === EVENT_KIND.SHOT_WIDE ||
        item.kind === EVENT_KIND.CORNER_WON ||
        item.kind === EVENT_KIND.FREE_KICK ||
        item.kind === EVENT_KIND.COUNTER_START ||
        item.kind === EVENT_KIND.POSSESSION_SWING
    )
    .slice(-8)
    .reverse();

  return (
    <section className="matchSim__panel">
      <h2>Scoreboard</h2>

      <div className="matchSim__scoreline">
        <div>{teamAName}</div>
        <div className="matchSim__scoreNumber">
          {matchState.score[TEAM_KEY.A]} - {matchState.score[TEAM_KEY.B]}
        </div>
        <div>{teamBName}</div>
      </div>

      <div className="matchSim__scorersGrid">
        <div className="matchSim__scorerCol">
          <h4>{teamAName} scorers</h4>
          {teamAScorers.length === 0 ? (
            <div className="matchSim__muted">None</div>
          ) : (
            teamAScorers.map((goal) => (
              <div key={goal.id} className="matchSim__scorerRow">
                {goal.minute}' {goal.scorerName}
              </div>
            ))
          )}
        </div>

        <div className="matchSim__scorerCol">
          <h4>{teamBName} scorers</h4>
          {teamBScorers.length === 0 ? (
            <div className="matchSim__muted">None</div>
          ) : (
            teamBScorers.map((goal) => (
              <div key={goal.id} className="matchSim__scorerRow">
                {goal.minute}' {goal.scorerName}
              </div>
            ))
          )}
        </div>
      </div>

      <table className="matchSim__statsTable">
        <thead>
          <tr>
            <th>Team</th>
            <th>Possession</th>
            <th>Shots</th>
            <th>Total xG</th>
            <th>Goals</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{teamAName}</td>
            <td>{formatPossession(matchState.stats[TEAM_KEY.A].possessionChunks, totalChunks)}</td>
            <td>{matchState.stats[TEAM_KEY.A].shots}</td>
            <td>{matchState.stats[TEAM_KEY.A].totalXg.toFixed(2)}</td>
            <td>{matchState.stats[TEAM_KEY.A].goals}</td>
          </tr>
          <tr>
            <td>{teamBName}</td>
            <td>{formatPossession(matchState.stats[TEAM_KEY.B].possessionChunks, totalChunks)}</td>
            <td>{matchState.stats[TEAM_KEY.B].shots}</td>
            <td>{matchState.stats[TEAM_KEY.B].totalXg.toFixed(2)}</td>
            <td>{matchState.stats[TEAM_KEY.B].goals}</td>
          </tr>
        </tbody>
      </table>

      <div className="matchSim__keyEvents">
        <h4>Main Match Events</h4>
        {keyEvents.length === 0 ? (
          <div className="matchSim__muted">No key events yet.</div>
        ) : (
          keyEvents.map((event) => (
            <div key={event.id} className="matchSim__keyEventRow">
              {event.minute}' {event.half}: {event.text}
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default Scoreboard;

