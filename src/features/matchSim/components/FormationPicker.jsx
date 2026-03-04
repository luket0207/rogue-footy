/* eslint-disable react/prop-types */

import { FORMATION_KEYS } from "../utils/matchSimTypes";

const FormationPicker = ({ id, value, onChange }) => {
  return (
    <div className="matchSim__control">
      <label htmlFor={id}>Formation</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {FORMATION_KEYS.map((formation) => (
          <option key={formation} value={formation}>
            {formation}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FormationPicker;
