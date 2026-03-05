import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import "./careerMatchSummary.scss";

const FALLBACK_HOME_COLOR = "#1d4ed8";
const FALLBACK_AWAY_COLOR = "#b91c1c";

const CareerMatchSummary = () => {
  const navigate = useNavigate();
  const { gameState, setGameState, setGameValue } = useGame();
  const result = gameState?.match?.lastCareerMatchResult || null;

  useEffect(() => {
    setGameValue("mode", "career");
  }, [setGameValue]);

  const summary = useMemo(() => {
    if (!result) return null;

    const scoreA = Number(result.scoreA) || 0;
    const scoreB = Number(result.scoreB) || 0;
    const homeName = result.homeTeamName || result.teamAName || "Home";
    const awayName = result.awayTeamName || result.teamBName || "Away";
    let outcome = "Draw";
    if (scoreA > scoreB) outcome = `${homeName} won`;
    if (scoreB > scoreA) outcome = `${awayName} won`;

    return {
      scoreA,
      scoreB,
      homeName,
      awayName,
      homeColor: result.teamAColor || FALLBACK_HOME_COLOR,
      awayColor: result.teamBColor || FALLBACK_AWAY_COLOR,
      competitionLabel:
        result.competitionType === "CUP"
          ? result.cupKey
            ? `Cup (${result.cupKey})`
            : "Cup"
          : "League",
      outcome,
      dayNumber: Number(result.dayNumber) || 0,
    };
  }, [result]);

  const handleContinue = () => {
    setGameState((previous) => ({
      ...previous,
      match: {
        ...(previous?.match && typeof previous.match === "object" ? previous.match : {}),
        activeCareerMatch: null,
        lastCareerMatchResult: null,
        pendingConfig: null,
        autoKickOffToken: "",
      },
    }));
    navigate("/career/calendar", { replace: true });
  };

  return (
    <div className="careerMatchSummary">
      <section className="careerMatchSummary__panel">
        <h1>Match Summary</h1>
        {!summary ? (
          <>
            <p>No completed match result found.</p>
            <div className="careerMatchSummary__actions">
              <Button variant={BUTTON_VARIANT.PRIMARY} onClick={handleContinue}>
                Back to Calendar
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>
              {summary.competitionLabel} | Day {summary.dayNumber}
            </p>

            <div className="careerMatchSummary__scoreCard">
              <div className="careerMatchSummary__team">
                <span
                  className="careerMatchSummary__teamIcon"
                  style={{ backgroundColor: summary.homeColor }}
                />
                <span>{summary.homeName}</span>
              </div>
              <div className="careerMatchSummary__score">
                {summary.scoreA} - {summary.scoreB}
              </div>
              <div className="careerMatchSummary__team">
                <span
                  className="careerMatchSummary__teamIcon"
                  style={{ backgroundColor: summary.awayColor }}
                />
                <span>{summary.awayName}</span>
              </div>
            </div>

            <p className="careerMatchSummary__outcome">{summary.outcome}</p>

            <div className="careerMatchSummary__actions">
              <Button variant={BUTTON_VARIANT.PRIMARY} onClick={handleContinue}>
                Continue
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default CareerMatchSummary;
