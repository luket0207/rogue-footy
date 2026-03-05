import { useEffect, useMemo, useState } from "react";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import {
  ATTACKING_TACTIC,
  ATTACKING_TACTIC_OPTIONS,
  DEFENSIVE_TACTIC,
  DEFENSIVE_TACTIC_OPTIONS,
  POSITION,
} from "../../../features/matchSim/utils/matchSimTypes";
import { createCoachAssessment } from "../utils/coachReadings";
import {
  createCareerLineupFromLegacySlots,
  DEFAULT_CAREER_FORMATION,
  isCareerLineupComplete,
  lineupToLegacySlots,
  normalizeCareerLineup,
} from "../utils/teamSetup";
import "./careerTeamManagement.scss";

const POSITION_LABEL = Object.freeze({
  [POSITION.GK]: "GK",
  [POSITION.DEF]: "DEF",
  [POSITION.MID]: "MID",
  [POSITION.FWR]: "FWR",
});

const PITCH_ROLE_ORDER = Object.freeze([POSITION.FWR, POSITION.MID, POSITION.DEF]);
const ROLE_PRIORITY = Object.freeze({
  [POSITION.GK]: 0,
  [POSITION.DEF]: 1,
  [POSITION.MID]: 2,
  [POSITION.FWR]: 3,
});

const DEFAULT_PLAYER_TACTICS = Object.freeze({
  attacking: ATTACKING_TACTIC.DIRECT,
  defensive: DEFENSIVE_TACTIC.MID_BLOCK,
});
const COACH_SKILL_OPTIONS = Object.freeze([1, 2, 3, 4, 5]);
const DEFAULT_COACH_RATINGS = Object.freeze({
  DEF: 5,
  MID: 5,
  FWR: 5,
});

const formatTacticLabel = (tactic) =>
  String(tactic || "")
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");

const normalizeTactics = (tactics) => {
  const attacking = ATTACKING_TACTIC_OPTIONS.includes(tactics?.attacking)
    ? tactics.attacking
    : DEFAULT_PLAYER_TACTICS.attacking;
  const defensive = DEFENSIVE_TACTIC_OPTIONS.includes(tactics?.defensive)
    ? tactics.defensive
    : DEFAULT_PLAYER_TACTICS.defensive;

  return { attacking, defensive };
};

const getStatToneClass = (value) => {
  const rating = Number(value) || 0;
  if (rating >= 91) return "is-legend";
  if (rating >= 86) return "is-elite";
  if (rating >= 80) return "is-strong";
  if (rating >= 74) return "is-ok";
  return "is-weak";
};

const renderStatPill = (value) => {
  const rating = Number(value) || 0;
  return (
    <span className={`careerTeamManagement__statPill ${getStatToneClass(rating)}`}>
      {rating}
    </span>
  );
};

const getPlayerLabel = (player) =>
  `${player.name} (${POSITION_LABEL[player.preferredPos] || player.preferredPos}, OVR ${Number(player.overall) || 0})`;

const sanitizeLineup = (lineup, formation, validIds) => {
  const normalized = normalizeCareerLineup(lineup, formation);
  const used = new Set();
  const normalizeId = (playerId) => {
    if (!playerId || !validIds.has(playerId) || used.has(playerId)) return "";
    used.add(playerId);
    return playerId;
  };

  return {
    gkId: normalizeId(normalized.gkId),
    [POSITION.DEF]: normalized[POSITION.DEF].map((id) => normalizeId(id)),
    [POSITION.MID]: normalized[POSITION.MID].map((id) => normalizeId(id)),
    [POSITION.FWR]: normalized[POSITION.FWR].map((id) => normalizeId(id)),
  };
};

const CareerTeamManagement = () => {
  const { gameState, setGameState, setGameValue } = useGame();
  const playerTeam = gameState?.career?.playerTeam || null;
  const squad = Array.isArray(playerTeam?.squad) ? playerTeam.squad : [];
  const validIds = useMemo(() => new Set(squad.map((player) => player.id)), [squad]);

  const [formation] = useState(DEFAULT_CAREER_FORMATION);
  const [lineup, setLineup] = useState(() =>
    normalizeCareerLineup(null, DEFAULT_CAREER_FORMATION)
  );
  const [tactics, setTactics] = useState(DEFAULT_PLAYER_TACTICS);
  const [coachRatings, setCoachRatings] = useState(DEFAULT_COACH_RATINGS);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    setGameValue("mode", "career");
  }, [setGameValue]);

  useEffect(() => {
    if (!playerTeam) return;
    const nextFormation = DEFAULT_CAREER_FORMATION;

    const baseLineup =
      playerTeam?.matchSetup?.lineup && typeof playerTeam.matchSetup.lineup === "object"
        ? normalizeCareerLineup(playerTeam.matchSetup.lineup, nextFormation)
        : createCareerLineupFromLegacySlots(playerTeam?.lineup, nextFormation);
    const normalized = sanitizeLineup(baseLineup, nextFormation, validIds);
    const complete = isCareerLineupComplete(normalized, nextFormation, validIds);
    const nextTactics = normalizeTactics(
      playerTeam?.matchSetup?.tactics && typeof playerTeam.matchSetup.tactics === "object"
        ? playerTeam.matchSetup.tactics
        : playerTeam?.tactics
    );

    setLineup(complete ? normalized : createCareerLineupFromLegacySlots(playerTeam?.lineup, nextFormation));
    setTactics(nextTactics);
    setSavedAt("");
  }, [playerTeam, squad, validIds]);

  const playersById = useMemo(
    () =>
      squad.reduce((result, player) => {
        result[player.id] = player;
        return result;
      }, {}),
    [squad]
  );

  const sortedSquad = useMemo(
    () =>
      [...squad].sort((playerA, playerB) => {
        const roleDelta =
          (ROLE_PRIORITY[playerA.preferredPos] ?? 9) -
          (ROLE_PRIORITY[playerB.preferredPos] ?? 9);
        if (roleDelta !== 0) return roleDelta;
        const overallDelta =
          (Number(playerB.overall) || 0) - (Number(playerA.overall) || 0);
        if (overallDelta !== 0) return overallDelta;
        return String(playerA.name || "").localeCompare(String(playerB.name || ""));
      }),
    [squad]
  );

  const isComplete = isCareerLineupComplete(lineup, formation, validIds);
  const hasNoTeam = !playerTeam || squad.length === 0;

  const handleTacticChange = (type, value) => {
    setTactics((previous) => normalizeTactics({ ...previous, [type]: value }));
    setSavedAt("");
  };

  const handleCoachRatingChange = (roleKey, value) => {
    const nextValue = Math.min(5, Math.max(1, Number(value) || 1));
    setCoachRatings((previous) => ({
      ...previous,
      [roleKey]: nextValue,
    }));
  };

  const lineupSlots = useMemo(() => {
    const buildSlot = (role, index, label) => {
      const playerId = role === POSITION.GK ? lineup.gkId : lineup[role][index] || "";
      const player = playersById[playerId] || null;
      const coach = player
        ? createCoachAssessment({
            player,
            assignedRole: role,
            tactics,
            coachRatings,
          })
        : null;

      return {
        key: `${role}-${index}`,
        role,
        label,
        player,
        coach,
      };
    };

    return {
      [POSITION.FWR]: [buildSlot(POSITION.FWR, 0, "Forward")],
      [POSITION.MID]: [
        buildSlot(POSITION.MID, 0, "Midfielder 1"),
        buildSlot(POSITION.MID, 1, "Midfielder 2"),
      ],
      [POSITION.DEF]: [
        buildSlot(POSITION.DEF, 0, "Defender 1"),
        buildSlot(POSITION.DEF, 1, "Defender 2"),
      ],
      [POSITION.GK]: [buildSlot(POSITION.GK, 0, "Goalkeeper")],
    };
  }, [coachRatings, lineup, playersById, tactics]);

  const handleSave = () => {
    if (!playerTeam || !isComplete) return;
    const savedTime = new Date().toISOString();
    const normalized = sanitizeLineup(lineup, formation, validIds);

    setGameState((previous) => {
      const previousCareer = previous?.career;
      const previousTeam = previousCareer?.playerTeam;
      if (!previousTeam || typeof previousTeam !== "object") return previous;

      return {
        ...previous,
        career: {
          ...(previousCareer && typeof previousCareer === "object" ? previousCareer : {}),
          playerTeam: {
            ...previousTeam,
            formation,
            tactics,
            lineup: lineupToLegacySlots(normalized),
            matchSetup: {
              formation,
              lineup: normalized,
              tactics,
              updatedAt: savedTime,
            },
          },
        },
      };
    });

    setSavedAt(savedTime);
  };

  if (hasNoTeam) {
    return (
      <div className="careerTeamManagement">
        <section className="careerTeamManagement__panel">
          <h1>Team Management</h1>
          <p>No player squad found for this career save.</p>
          <div className="careerTeamManagement__actions">
            <Button variant={BUTTON_VARIANT.SECONDARY} to="/career/calendar">
              Back to Calendar
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="careerTeamManagement">
      <section className="careerTeamManagement__panel">
        <h1>Team Management</h1>
        <p>
          Team: <strong>{playerTeam.name}</strong>
        </p>
        <p>Set tactics and review coach feedback for fixed lineup positions.</p>

        <section className="careerTeamManagement__controls">
          <div className="careerTeamManagement__controlField">
            <label htmlFor="career-attacking-tactic">Attacking Tactic</label>
            <select
              id="career-attacking-tactic"
              value={tactics.attacking}
              onChange={(event) => handleTacticChange("attacking", event.target.value)}
            >
              {ATTACKING_TACTIC_OPTIONS.map((tactic) => (
                <option key={tactic} value={tactic}>
                  {formatTacticLabel(tactic)}
                </option>
              ))}
            </select>
          </div>

          <div className="careerTeamManagement__controlField">
            <label htmlFor="career-defensive-tactic">Defensive Tactic</label>
            <select
              id="career-defensive-tactic"
              value={tactics.defensive}
              onChange={(event) => handleTacticChange("defensive", event.target.value)}
            >
              {DEFENSIVE_TACTIC_OPTIONS.map((tactic) => (
                <option key={tactic} value={tactic}>
                  {formatTacticLabel(tactic)}
                </option>
              ))}
            </select>
          </div>

          <div className="careerTeamManagement__controlField">
            <label htmlFor="career-coach-def">Coach DEF (Debug)</label>
            <select
              id="career-coach-def"
              value={coachRatings.DEF}
              onChange={(event) => handleCoachRatingChange("DEF", event.target.value)}
            >
              {COACH_SKILL_OPTIONS.map((level) => (
                <option key={`def-${level}`} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="careerTeamManagement__controlField">
            <label htmlFor="career-coach-mid">Coach MID (Debug)</label>
            <select
              id="career-coach-mid"
              value={coachRatings.MID}
              onChange={(event) => handleCoachRatingChange("MID", event.target.value)}
            >
              {COACH_SKILL_OPTIONS.map((level) => (
                <option key={`mid-${level}`} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="careerTeamManagement__controlField">
            <label htmlFor="career-coach-fwr">Coach FWR (Debug)</label>
            <select
              id="career-coach-fwr"
              value={coachRatings.FWR}
              onChange={(event) => handleCoachRatingChange("FWR", event.target.value)}
            >
              {COACH_SKILL_OPTIONS.map((level) => (
                <option key={`fwr-${level}`} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="careerTeamManagement__layout">
          <section className="careerTeamManagement__lineup">
            <h2>Lineup Assignment</h2>
            <div className="careerTeamManagement__pitch">
              {PITCH_ROLE_ORDER.map((role) => (
                <div className="careerTeamManagement__pitchRow" key={`pitch-${role}`}>
                  {lineupSlots[role].map((slot) => {
                    const player = slot.player;
                    const coach = slot.coach;
                    return (
                      <div className="careerTeamManagement__pitchSlot" key={slot.key}>
                        <label>{slot.label}</label>
                        {player ? (
                          <div className="careerTeamManagement__slotMeta">
                            <div className="careerTeamManagement__slotName">{getPlayerLabel(player)}</div>
                            {coach?.hasInfo && (
                              <div className="careerTeamManagement__slotCoach">
                                <strong>Coach:</strong> {coach.feedbackText}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="careerTeamManagement__slotMeta">No player assigned</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="careerTeamManagement__pitchRow careerTeamManagement__pitchRow--gk">
                {lineupSlots[POSITION.GK].map((slot) => {
                  const player = slot.player;
                  const coach = slot.coach;
                  return (
                    <div className="careerTeamManagement__pitchSlot" key={slot.key}>
                      <label>{slot.label}</label>
                      {player ? (
                        <div className="careerTeamManagement__slotMeta">
                          <div className="careerTeamManagement__slotName">{getPlayerLabel(player)}</div>
                          {coach?.hasInfo && (
                            <div className="careerTeamManagement__slotCoach">
                              <strong>Coach:</strong> {coach.feedbackText}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="careerTeamManagement__slotMeta">No player assigned</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`careerTeamManagement__status${isComplete ? " is-valid" : " is-invalid"}`}>
              {isComplete
                ? "Lineup complete. Ready to save."
                : "Lineup incomplete. Assign unique players to all slots."}
            </div>
            {savedAt && (
              <div className="careerTeamManagement__saved">
                Saved at {new Date(savedAt).toLocaleTimeString()}
              </div>
            )}
          </section>

          <section className="careerTeamManagement__squad">
            <h2>Squad</h2>
            <div className="careerTeamManagement__squadWrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pos</th>
                    <th>OVR</th>
                    <th>Fin</th>
                    <th>Pas</th>
                    <th>Ctl</th>
                    <th>Def</th>
                    <th>Off</th>
                    <th>WR</th>
                    <th>GK</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSquad.map((player) => (
                    <tr key={player.id}>
                      <td className="careerTeamManagement__nameCell">{player.name}</td>
                      <td className="careerTeamManagement__posCell">
                        {POSITION_LABEL[player.preferredPos] || player.preferredPos}
                      </td>
                      <td className="careerTeamManagement__statCell">{renderStatPill(player.overall)}</td>
                      <td className="careerTeamManagement__statCell">{renderStatPill(player.finishing)}</td>
                      <td className="careerTeamManagement__statCell">{renderStatPill(player.passing)}</td>
                      <td className="careerTeamManagement__statCell">{renderStatPill(player.control)}</td>
                      <td className="careerTeamManagement__statCell">{renderStatPill(player.defending)}</td>
                      <td className="careerTeamManagement__statCell">{renderStatPill(player.offBall)}</td>
                      <td className="careerTeamManagement__statCell">{renderStatPill(player.workRate)}</td>
                      <td className="careerTeamManagement__statCell">{renderStatPill(player.goalkeeping)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="careerTeamManagement__actions">
          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={handleSave} disabled={!isComplete}>
            Save Team Setup
          </Button>
          <Button variant={BUTTON_VARIANT.SECONDARY} to="/career/calendar">
            Back to Calendar
          </Button>
        </div>
      </section>
    </div>
  );
};

export default CareerTeamManagement;
