import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import { applyCupDrawReveal } from "../utils/cupDrawEvent";
import "./careerCupDraw.scss";

const formatFixtureLabel = (fixture) =>
  `${fixture.matchIndex}. ${fixture.homeTeamName} vs ${fixture.awayTeamName}`;

const normalizePendingDraws = (pendingCupDraw) => {
  if (Array.isArray(pendingCupDraw?.draws) && pendingCupDraw.draws.length > 0) {
    return pendingCupDraw.draws;
  }
  if (pendingCupDraw?.cupKey && pendingCupDraw?.roundKey) {
    return [pendingCupDraw];
  }
  return [];
};

const buildPendingDrawBundle = (draws, previousPending, revealedAt) => {
  const safeDraws = Array.isArray(draws) ? draws : [];
  if (safeDraws.length === 0) return null;

  const firstDraw = safeDraws[0];
  const triggerDayNumber = Number(firstDraw?.triggeredDayNumber) || 0;

  return {
    ...(previousPending && typeof previousPending === "object" ? previousPending : {}),
    id: `draw_day_d${String(triggerDayNumber).padStart(2, "0")}_n${safeDraws.length}`,
    type: "DRAW_DAY_BUNDLE",
    triggeredDayNumber: triggerDayNumber,
    triggeredDayName: String(firstDraw?.triggeredDayName || ""),
    drawCount: safeDraws.length,
    draws: safeDraws,
    createdAt: previousPending?.createdAt || revealedAt,
  };
};

const CareerCupDraw = () => {
  const navigate = useNavigate();
  const { gameState, setGameState, setGameValue } = useGame();
  const [revealedById, setRevealedById] = useState({});
  const [activeDrawIndex, setActiveDrawIndex] = useState(0);
  const pendingCupDraw = gameState?.career?.pendingCupDraw || null;

  useEffect(() => {
    setGameValue("mode", "career");
  }, [setGameValue]);

  useEffect(() => {
    setRevealedById({});
    setActiveDrawIndex(0);
  }, [pendingCupDraw?.id, pendingCupDraw?.drawCount]);

  const drawEntries = useMemo(() => normalizePendingDraws(pendingCupDraw), [pendingCupDraw]);
  const activeDraw = drawEntries[activeDrawIndex] || null;
  const fixtures = useMemo(
    () => (Array.isArray(activeDraw?.fixtures) ? activeDraw.fixtures : []),
    [activeDraw?.fixtures]
  );
  const isCurrentRevealed = !!(activeDraw?.id && revealedById[activeDraw.id]);

  const handleApplyDraws = (drawsToApply) => {
    const entries = Array.isArray(drawsToApply) ? drawsToApply : [];
    if (entries.length === 0) return;

    const revealedAt = new Date().toISOString();
    const entryIds = new Set(entries.map((entry) => entry.id));
    const remainingDraws = drawEntries.filter((entry) => !entryIds.has(entry.id));

    setGameState((previous) => {
      const previousCareer = previous?.career;
      const nextCups = applyCupDrawReveal({
        cups: previousCareer?.cups,
        pendingCupDraw: { draws: entries },
        revealedAt,
      });

      return {
        ...previous,
        career: {
          ...(previousCareer && typeof previousCareer === "object" ? previousCareer : {}),
          cups: nextCups,
          pendingCupDraw: buildPendingDrawBundle(
            remainingDraws,
            previousCareer?.pendingCupDraw,
            revealedAt
          ),
          lastCupDraw: {
            drawType: entries.length > 1 ? "BUNDLE" : "SINGLE",
            revealedAt,
            draws: entries,
          },
        },
      };
    });

    if (remainingDraws.length === 0) {
      navigate("/career/calendar", { replace: true });
      return;
    }

    setRevealedById({});
    setActiveDrawIndex(0);
  };

  const handleConfirmCurrent = () => {
    if (!activeDraw || !isCurrentRevealed) return;
    handleApplyDraws([activeDraw]);
  };

  const handleCompleteAll = () => {
    if (drawEntries.length === 0) return;
    handleApplyDraws(drawEntries);
  };

  const handleRevealCurrent = () => {
    if (!activeDraw?.id) return;
    setRevealedById((previous) => ({
      ...previous,
      [activeDraw.id]: true,
    }));
  };

  if (!pendingCupDraw || drawEntries.length === 0) {
    return (
      <div className="careerCupDraw">
        <section className="careerCupDraw__panel">
          <h1>Cup Draw</h1>
          <p>No pending cup draw event.</p>
          <div className="careerCupDraw__actions">
            <Button variant={BUTTON_VARIANT.SECONDARY} to="/career/calendar">
              Back to Calendar
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="careerCupDraw">
      <section className="careerCupDraw__panel">
        <h1>Cup Draw Day</h1>
        <p>
          Draw day: {pendingCupDraw.triggeredDayName} Day {pendingCupDraw.triggeredDayNumber}
        </p>
        <p>Pending draws: {drawEntries.length}</p>

        <section className="careerCupDraw__drawQueue">
          <h2>Draw Queue</h2>
          <ol>
            {drawEntries.map((draw, index) => (
              <li key={draw.id} className={index === activeDrawIndex ? "is-active" : ""}>
                {draw.competitionLabel} - {draw.roundLabel} ({draw.scheduledDayName} Day {draw.scheduledDayNumber})
              </li>
            ))}
          </ol>
        </section>

        <div className="careerCupDraw__actions">
          <Button
            variant={BUTTON_VARIANT.PRIMARY}
            onClick={handleRevealCurrent}
            disabled={isCurrentRevealed || !activeDraw}
          >
            {isCurrentRevealed ? "Current Draw Revealed" : "Reveal Current Draw"}
          </Button>
          <Button
            variant={BUTTON_VARIANT.SECONDARY}
            onClick={handleConfirmCurrent}
            disabled={!isCurrentRevealed || !activeDraw}
          >
            Confirm Current Draw
          </Button>
          <Button variant={BUTTON_VARIANT.SECONDARY} onClick={handleCompleteAll}>
            Complete All Cups
          </Button>
          <Button
            variant={BUTTON_VARIANT.TERTIARY}
            onClick={() => setActiveDrawIndex((previous) => Math.max(0, previous - 1))}
            disabled={activeDrawIndex <= 0}
          >
            Prev Draw
          </Button>
          <Button
            variant={BUTTON_VARIANT.TERTIARY}
            onClick={() =>
              setActiveDrawIndex((previous) => Math.min(drawEntries.length - 1, previous + 1))
            }
            disabled={activeDrawIndex >= drawEntries.length - 1}
          >
            Next Draw
          </Button>
        </div>

        <section className="careerCupDraw__fixtures">
          <h2>
            {activeDraw?.competitionLabel} - {activeDraw?.roundLabel}
          </h2>
          <p>
            Scheduled match day: {activeDraw?.scheduledDayName} Day {activeDraw?.scheduledDayNumber}
          </p>
          {!isCurrentRevealed ? (
            <p>Press "Reveal Current Draw" to show pairings.</p>
          ) : fixtures.length === 0 ? (
            <p>No fixtures available for this draw.</p>
          ) : (
            <ol>
              {fixtures.map((fixture) => (
                <li key={fixture.id}>{formatFixtureLabel(fixture)}</li>
              ))}
            </ol>
          )}
        </section>
      </section>
    </div>
  );
};

export default CareerCupDraw;
