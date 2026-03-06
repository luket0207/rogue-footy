/* eslint-disable react/prop-types */

import { TEAM_KEY } from "../utils/matchSimTypes";

const MetricLine = ({ label, value }) => (
  <div className="matchSim__debugMetricLine">
    <span>{label}</span>
    <strong>{value.toFixed(2)}</strong>
  </div>
);

const BreakdownGroup = ({ title, breakdown }) => (
  <div className="matchSim__debugBreakdown">
    <h5>{title}</h5>
    {Object.entries(breakdown)
      .filter(([key]) => key !== "total")
      .map(([key, value]) => (
        <MetricLine key={`${title}-${key}`} label={key} value={value} />
      ))}
    <MetricLine label="total" value={breakdown.total} />
  </div>
);

const TeamDebugCard = ({ teamName, teamSetup, teamSnapshot }) => {
  const metrics = teamSnapshot.adjustedMetrics;
  const baseMetrics = teamSnapshot.metrics;
  const deltas = teamSnapshot.tacticBreakdown.totalDelta;
  const metricBreakdown = teamSnapshot.metricBreakdown;
  const overallBreakdown = teamSnapshot.overallRatingBreakdown;
  const selectedTactics = teamSetup?.tactics || teamSnapshot.tactics;
  const matchup = teamSnapshot.tacticBreakdown.matchupOutcome;
  const matrix = teamSnapshot.tacticBreakdown.skillMatrixOutcome;

  return (
    <div className="matchSim__debugCard">
      <h4>{teamName}</h4>
      <MetricLine label="overallRating" value={teamSnapshot.overallRating} />

      <div className="matchSim__debugBreakdown">
        <h5>Tactics</h5>
        <div className="matchSim__debugMetricLine">
          <span>attacking</span>
          <strong>{selectedTactics?.attacking || "N/A"}</strong>
        </div>
        <div className="matchSim__debugMetricLine">
          <span>defensive</span>
          <strong>{selectedTactics?.defensive || "N/A"}</strong>
        </div>
        {matchup?.attackKey && (
          <div className="matchSim__debugMetricLine">
            <span>attackVsDefense</span>
            <strong>{matchup.attackKey}</strong>
          </div>
        )}
        {matchup?.defenseKey && (
          <div className="matchSim__debugMetricLine">
            <span>defenseVsAttack</span>
            <strong>{matchup.defenseKey}</strong>
          </div>
        )}
        {matrix && (
          <>
            <div className="matchSim__debugMetricLine">
              <span>matrixAttackScore</span>
              <strong>{matrix.attackingOutcome.normalizedScore.toFixed(2)}</strong>
            </div>
            <div className="matchSim__debugMetricLine">
              <span>matrixDefenseScore</span>
              <strong>{matrix.defensiveOutcome.normalizedScore.toFixed(2)}</strong>
            </div>
            <div className="matchSim__debugMetricLine">
              <span>attackBonusLevel</span>
              <strong>{matrix.attackingBonusLevel}</strong>
            </div>
            <div className="matchSim__debugMetricLine">
              <span>defenseBonusLevel</span>
              <strong>{matrix.defensiveBonusLevel}</strong>
            </div>
            <div className="matchSim__debugMetricLine">
              <span>attackOverallAdj</span>
              <strong>{(matrix.attackingLineupImpact / 50).toFixed(2)}</strong>
            </div>
            <div className="matchSim__debugMetricLine">
              <span>defenseOverallAdj</span>
              <strong>{(matrix.defensiveLineupImpact / 50).toFixed(2)}</strong>
            </div>
            <div className="matchSim__debugMetricLine">
              <span>netLineupImpact</span>
              <strong>{matrix.netLineupImpact.toFixed(2)}</strong>
            </div>
            <div className="matchSim__debugMetricLine">
              <span>tacticSelectionContribution</span>
              <strong>{matrix.tacticSelectionContribution.toFixed(2)}</strong>
            </div>
          </>
        )}
      </div>

      <div className="matchSim__debugMetricsGrid">
        <div>
          <h5>Adjusted Metrics</h5>
          <MetricLine label="control" value={metrics.control} />
          <MetricLine label="buildUp" value={metrics.buildUp} />
          <MetricLine label="threat" value={metrics.threat} />
          <MetricLine label="resistance" value={metrics.resistance} />
        </div>

        <div>
          <h5>Base + Delta</h5>
          <MetricLine label={`control ${baseMetrics.control.toFixed(1)} + ${deltas.control.toFixed(1)}`} value={metrics.control} />
          <MetricLine label={`buildUp ${baseMetrics.buildUp.toFixed(1)} + ${deltas.buildUp.toFixed(1)}`} value={metrics.buildUp} />
          <MetricLine label={`threat ${baseMetrics.threat.toFixed(1)} + ${deltas.threat.toFixed(1)}`} value={metrics.threat} />
          <MetricLine label={`resistance ${baseMetrics.resistance.toFixed(1)} + ${deltas.resistance.toFixed(1)}`} value={metrics.resistance} />
        </div>
      </div>

      <div className="matchSim__debugBreakdownGrid">
        <BreakdownGroup title="controlBreakdown" breakdown={metricBreakdown.control} />
        <BreakdownGroup title="buildUpBreakdown" breakdown={metricBreakdown.buildUp} />
        <BreakdownGroup title="threatBreakdown" breakdown={metricBreakdown.threat} />
        <BreakdownGroup title="resistanceBreakdown" breakdown={metricBreakdown.resistance} />
        <BreakdownGroup title="overallBreakdown" breakdown={overallBreakdown} />
      </div>
    </div>
  );
};

const MatchDebug = ({ matchState }) => {
  if (matchState.status === "idle") {
    return null;
  }

  const teamAName = matchState.setup[TEAM_KEY.A].name;
  const teamBName = matchState.setup[TEAM_KEY.B].name;

  return (
    <section className="matchSim__panel">
      <h2>Match Debug</h2>
      <p className="matchSim__muted">
        Debug-only diagnostics. These values are useful for tuning and can be removed for production.
      </p>

      <div className="matchSim__debugGrid">
        <TeamDebugCard
          teamName={teamAName}
          teamSetup={matchState.setup[TEAM_KEY.A]}
          teamSnapshot={matchState.teamSnapshots[TEAM_KEY.A]}
        />
        <TeamDebugCard
          teamName={teamBName}
          teamSetup={matchState.setup[TEAM_KEY.B]}
          teamSnapshot={matchState.teamSnapshots[TEAM_KEY.B]}
        />
      </div>
    </section>
  );
};

export default MatchDebug;
