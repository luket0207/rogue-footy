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
import {
  autoFillCareerLineup,
  CAREER_FORMATION_KEYS,
  CAREER_FORMATIONS,
  createCareerLineupFromLegacySlots,
  DEFAULT_CAREER_FORMATION,
  getCareerLineupPlayerIds,
  isCareerLineupComplete,
  isValidCareerFormation,
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

const ROLE_DISPLAY_NAME = Object.freeze({
  [POSITION.GK]: "Goalkeeper",
  [POSITION.DEF]: "Defender",
  [POSITION.MID]: "Midfielder",
  [POSITION.FWR]: "Forward",
});
const DEFAULT_PLAYER_TACTICS = Object.freeze({
  attacking: ATTACKING_TACTIC.DIRECT,
  defensive: DEFENSIVE_TACTIC.MID_BLOCK,
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

const formatFormation = (formation) => {
  const counts = CAREER_FORMATIONS[formation];
  if (!counts) return formation;
  return `${counts[POSITION.DEF]}-${counts[POSITION.MID]}-${counts[POSITION.FWR]}`;
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

  const [formation, setFormation] = useState(DEFAULT_CAREER_FORMATION);
  const [lineup, setLineup] = useState(() =>
    normalizeCareerLineup(null, DEFAULT_CAREER_FORMATION)
  );
  const [tactics, setTactics] = useState(DEFAULT_PLAYER_TACTICS);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    setGameValue("mode", "career");
  }, [setGameValue]);

  useEffect(() => {
    if (!playerTeam) return;
    const nextFormation = isValidCareerFormation(playerTeam?.matchSetup?.formation)
      ? playerTeam.matchSetup.formation
      : isValidCareerFormation(playerTeam?.formation)
        ? playerTeam.formation
        : DEFAULT_CAREER_FORMATION;

    const baseLineup =
      playerTeam?.matchSetup?.lineup && typeof playerTeam.matchSetup.lineup === "object"
        ? normalizeCareerLineup(playerTeam.matchSetup.lineup, nextFormation)
        : createCareerLineupFromLegacySlots(playerTeam?.lineup, nextFormation);
    const normalized = sanitizeLineup(baseLineup, nextFormation, validIds);
    const fallback = autoFillCareerLineup(squad, nextFormation);
    const complete = isCareerLineupComplete(normalized, nextFormation, validIds);
    const nextTactics = normalizeTactics(
      playerTeam?.matchSetup?.tactics && typeof playerTeam.matchSetup.tactics === "object"
        ? playerTeam.matchSetup.tactics
        : playerTeam?.tactics
    );

    setFormation(nextFormation);
    setLineup(complete ? normalized : fallback);
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

  const assignedIds = useMemo(() => new Set(getCareerLineupPlayerIds(lineup)), [lineup]);
  const isComplete = isCareerLineupComplete(lineup, formation, validIds);
  const hasNoTeam = !playerTeam || squad.length === 0;

  const getPlayersSortedForRole = (role) =>
    [...sortedSquad].sort((playerA, playerB) => {
      const aPreferred = playerA.preferredPos === role ? 0 : 1;
      const bPreferred = playerB.preferredPos === role ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return (Number(playerB.overall) || 0) - (Number(playerA.overall) || 0);
    });

  const getUsedByOthers = (currentId) => {
    const next = new Set(assignedIds);
    if (currentId) next.delete(currentId);
    return next;
  };

  const updateSlot = (role, index, playerId) => {
    if (role === POSITION.GK) {
      setLineup((previous) => ({
        ...previous,
        gkId: playerId,
      }));
      return;
    }

    setLineup((previous) => {
      const nextRole = [...previous[role]];
      nextRole[index] = playerId;
      return {
        ...previous,
        [role]: nextRole,
      };
    });
  };

  const handleFormationChange = (nextFormation) => {
    if (!isValidCareerFormation(nextFormation)) return;
    setFormation(nextFormation);
    setLineup((previous) => normalizeCareerLineup(previous, nextFormation));
    setSavedAt("");
  };

  const handleAutoFill = () => {
    setLineup(autoFillCareerLineup(squad, formation));
    setSavedAt("");
  };

  const handleTacticChange = (type, value) => {
    setTactics((previous) => normalizeTactics({ ...previous, [type]: value }));
    setSavedAt("");
  };

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
        <p>Set formation and assign positions for career matches.</p>

        <section className="careerTeamManagement__controls">
          <div className="careerTeamManagement__controlField">
            <label htmlFor="career-formation">Formation</label>
            <select
              id="career-formation"
              value={formation}
              onChange={(event) => handleFormationChange(event.target.value)}
            >
              {CAREER_FORMATION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {formatFormation(key)}
                </option>
              ))}
            </select>
          </div>

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

          <Button variant={BUTTON_VARIANT.SECONDARY} onClick={handleAutoFill}>
            Auto Fill
          </Button>
        </section>

        <div className="careerTeamManagement__layout">
          <section className="careerTeamManagement__lineup">
            <h2>Lineup Assignment</h2>
            <div className="careerTeamManagement__pitch">
              {PITCH_ROLE_ORDER.map((role) => (
                <div className="careerTeamManagement__pitchRow" key={`pitch-${role}`}>
                  {lineup[role].map((playerId, index) => {
                    const slotLabel = `${ROLE_DISPLAY_NAME[role]} ${index + 1}`;
                    const usedByOthers = getUsedByOthers(playerId);
                    return (
                      <div className="careerTeamManagement__pitchSlot" key={`${role}-${index}`}>
                        <label htmlFor={`pitch-slot-${role}-${index}`}>{slotLabel}</label>
                        <select
                          id={`pitch-slot-${role}-${index}`}
                          value={playerId || ""}
                          onChange={(event) => updateSlot(role, index, event.target.value)}
                        >
                          <option value="">Select player</option>
                          {getPlayersSortedForRole(role).map((player) => {
                            const disabled =
                              player.id !== playerId && usedByOthers.has(player.id);
                            return (
                              <option key={player.id} value={player.id} disabled={disabled}>
                                {getPlayerLabel(player)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="careerTeamManagement__pitchRow careerTeamManagement__pitchRow--gk">
                <div className="careerTeamManagement__pitchSlot">
                  <label htmlFor="pitch-slot-gk">Goalkeeper</label>
                  <select
                    id="pitch-slot-gk"
                    value={lineup.gkId || ""}
                    onChange={(event) => updateSlot(POSITION.GK, 0, event.target.value)}
                  >
                    <option value="">Select player</option>
                    {getPlayersSortedForRole(POSITION.GK).map((player) => {
                      const usedByOthers = getUsedByOthers(lineup.gkId);
                      const disabled = player.id !== lineup.gkId && usedByOthers.has(player.id);
                      return (
                        <option key={player.id} value={player.id} disabled={disabled}>
                          {getPlayerLabel(player)}
                        </option>
                      );
                    })}
                  </select>
                </div>
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
