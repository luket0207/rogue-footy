/* eslint-disable react/prop-types */

import { useMemo } from "react";
import { FORMATIONS, OUTFIELD_POSITIONS, POSITION } from "../utils/matchSimTypes";
import { getRoleSelectionScore } from "../utils/ratings";

const ROLE_LABEL = Object.freeze({
  [POSITION.GK]: "GK",
  [POSITION.DEF]: "DEF",
  [POSITION.MID]: "MID",
  [POSITION.FWR]: "FWR",
});

const SKILL_KEYS = Object.freeze([
  { key: "finishing", label: "FIN" },
  { key: "passing", label: "PAS" },
  { key: "control", label: "CON" },
  { key: "defending", label: "DEF" },
  { key: "offBall", label: "OFF" },
  { key: "workRate", label: "WRK" },
  { key: "goalkeeping", label: "GK" },
]);

const getSkillClassName = (rating) => {
  if (rating >= 88) return "matchSim__skillTag matchSim__skillTag--elite";
  if (rating >= 78) return "matchSim__skillTag matchSim__skillTag--strong";
  if (rating >= 65) return "matchSim__skillTag matchSim__skillTag--good";
  return "matchSim__skillTag matchSim__skillTag--base";
};

const getTopSkills = (player, count = 3) =>
  [...SKILL_KEYS]
    .map((skill) => ({ ...skill, value: player[skill.key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);

const formatPlayerLabel = (player) => {
  const topSkillText = getTopSkills(player)
    .map((skill) => `${skill.label} ${skill.value}`)
    .join(" | ");
  const overallText = Number.isFinite(player.overall) ? `OVR ${player.overall}` : "";
  const nationalityText = player.nationality ? ` ${player.nationality}` : "";
  return `${player.name}${nationalityText} (${player.preferredPos}${overallText ? ` ${overallText}` : ""}) - ${topSkillText}`;
};

const LineupPicker = ({ teamId, lineup, formation, players, onSelectPlayer }) => {
  const playersById = useMemo(
    () =>
      players.reduce((result, player) => {
        result[player.id] = player;
        return result;
      }, {}),
    [players]
  );

  const sortedByRole = useMemo(() => {
    const makeSorted = (role) =>
      [...players].sort((playerA, playerB) => {
        const playerAPrefersRole = playerA.preferredPos === role ? 1 : 0;
        const playerBPrefersRole = playerB.preferredPos === role ? 1 : 0;
        if (playerBPrefersRole !== playerAPrefersRole) {
          return playerBPrefersRole - playerAPrefersRole;
        }

        const scoreDiff = getRoleSelectionScore(playerB, role) - getRoleSelectionScore(playerA, role);
        if (scoreDiff !== 0) return scoreDiff;

        return playerA.name.localeCompare(playerB.name);
      });

    return {
      [POSITION.GK]: makeSorted(POSITION.GK),
      [POSITION.DEF]: makeSorted(POSITION.DEF),
      [POSITION.MID]: makeSorted(POSITION.MID),
      [POSITION.FWR]: makeSorted(POSITION.FWR),
    };
  }, [players]);

  const selectedIds = useMemo(
    () =>
      new Set([
        lineup.gkId,
        ...lineup[POSITION.DEF],
        ...lineup[POSITION.MID],
        ...lineup[POSITION.FWR],
      ]),
    [lineup]
  );

  const renderSelect = (role, slotIndex, value) => {
    const options = sortedByRole[role];
    const preferredOptions = options.filter((player) => player.preferredPos === role);
    const otherOptions = options.filter((player) => player.preferredPos !== role);
    const selectedPlayer = playersById[value];

    const renderPlayerOption = (player) => {
      const disabled = value !== player.id && selectedIds.has(player.id);

      return (
        <option key={player.id} value={player.id} disabled={disabled}>
          {formatPlayerLabel(player)}
        </option>
      );
    };

    return (
      <div className="matchSim__control matchSim__control--lineup" key={`${role}-${slotIndex}`}>
        <label htmlFor={`${teamId}-${role}-${slotIndex}`}>
          {ROLE_LABEL[role]} {slotIndex + 1}
        </label>

        <select
          id={`${teamId}-${role}-${slotIndex}`}
          value={value}
          onChange={(event) => onSelectPlayer(role, slotIndex, event.target.value)}
        >
          <option value="">Select player</option>
          {preferredOptions.map(renderPlayerOption)}
          {preferredOptions.length > 0 && otherOptions.length > 0 && (
            <option value="" disabled>
              ----------------------------
            </option>
          )}
          {otherOptions.map(renderPlayerOption)}
        </select>

        {selectedPlayer && (
          <div className="matchSim__playerSkillRow">
            {SKILL_KEYS.map((skill) => (
              <span
                key={`${selectedPlayer.id}-${skill.key}`}
                className={getSkillClassName(selectedPlayer[skill.key])}
                title={`${skill.key}: ${selectedPlayer[skill.key]}`}
              >
                {skill.label} {selectedPlayer[skill.key]}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="matchSim__lineup">
      {renderSelect(POSITION.GK, 0, lineup.gkId)}

      {OUTFIELD_POSITIONS.map((role) =>
        lineup[role].map((playerId, slotIndex) => renderSelect(role, slotIndex, playerId))
      )}

      <div className="matchSim__lineupHint">
        Formation {formation} requires 1 GK + {FORMATIONS[formation][POSITION.DEF]} DEF +{" "}
        {FORMATIONS[formation][POSITION.MID]} MID + {FORMATIONS[formation][POSITION.FWR]} FWR.
      </div>
    </div>
  );
};

export default LineupPicker;
