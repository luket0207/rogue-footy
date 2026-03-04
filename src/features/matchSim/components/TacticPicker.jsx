/* eslint-disable react/prop-types */

import { ATTACKING_TACTIC_OPTIONS, DEFENSIVE_TACTIC_OPTIONS } from "../utils/matchSimTypes";

const TacticPicker = ({ teamId, tactics, onChange }) => {
  return (
    <div className="matchSim__tacticsGrid">
      <div className="matchSim__control">
        <label htmlFor={`${teamId}-attack`}>Attacking Tactic</label>
        <select
          id={`${teamId}-attack`}
          value={tactics.attacking}
          onChange={(event) => onChange({ ...tactics, attacking: event.target.value })}
        >
          {ATTACKING_TACTIC_OPTIONS.map((tactic) => (
            <option key={tactic} value={tactic}>
              {tactic}
            </option>
          ))}
        </select>
      </div>

      <div className="matchSim__control">
        <label htmlFor={`${teamId}-defense`}>Defensive Tactic</label>
        <select
          id={`${teamId}-defense`}
          value={tactics.defensive}
          onChange={(event) => onChange({ ...tactics, defensive: event.target.value })}
        >
          {DEFENSIVE_TACTIC_OPTIONS.map((tactic) => (
            <option key={tactic} value={tactic}>
              {tactic}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default TacticPicker;
