/* eslint-disable react/prop-types */

import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { POSITION } from "../utils/matchSimTypes";
import FormationPicker from "./FormationPicker";
import TacticPicker from "./TacticPicker";
import LineupPicker from "./LineupPicker";

const TeamSetup = ({
  teamId,
  title,
  teamConfig,
  players,
  onFormationChange,
  onTacticsChange,
  onLineupPlayerChange,
  onAutoFill,
  complete,
}) => {
  return (
    <section className="matchSim__teamCard">
      <div className="matchSim__teamHeader">
        <h3>{title}</h3>
        <div className={`matchSim__statusPill${complete ? " is-ready" : ""}`}>
          {complete ? "Lineup Ready" : "Lineup Incomplete"}
        </div>
      </div>

      <FormationPicker
        id={`${teamId}-formation`}
        value={teamConfig.formation}
        onChange={onFormationChange}
      />

      <TacticPicker teamId={teamId} tactics={teamConfig.tactics} onChange={onTacticsChange} />

      <LineupPicker
        teamId={teamId}
        lineup={teamConfig.lineup}
        formation={teamConfig.formation}
        players={players}
        onSelectPlayer={onLineupPlayerChange}
      />

      <div className="matchSim__teamActions">
        <Button variant={BUTTON_VARIANT.SECONDARY} onClick={onAutoFill}>
          Auto Fill {title}
        </Button>
      </div>
    </section>
  );
};

const MatchSetupPanel = ({
  players,
  seed,
  onSeedChange,
  onRandomizeSeed,
  teamAConfig,
  teamBConfig,
  onTeamAFormationChange,
  onTeamBFormationChange,
  onTeamATacticsChange,
  onTeamBTacticsChange,
  onTeamALineupChange,
  onTeamBLineupChange,
  onAutoFillTeamA,
  onAutoFillTeamB,
  onStartMatch,
  canStart,
  setupError,
}) => {
  return (
    <section className="matchSim__setupPanel">
      <div className="matchSim__configGrid">
        <div className="matchSim__control matchSim__control--seed">
          <label htmlFor="match-seed">Seed</label>
          <input
            id="match-seed"
            value={seed}
            onChange={(event) => onSeedChange(event.target.value)}
            type="text"
          />
          <Button variant={BUTTON_VARIANT.SECONDARY} onClick={onRandomizeSeed}>
            Randomize Seed
          </Button>
        </div>
      </div>

      <div className="matchSim__teamsGrid">
        <TeamSetup
          teamId="team-a"
          title={teamAConfig.name}
          teamConfig={teamAConfig}
          players={players}
          onFormationChange={onTeamAFormationChange}
          onTacticsChange={onTeamATacticsChange}
          onLineupPlayerChange={(role, slotIndex, playerId) =>
            onTeamALineupChange(role, role === POSITION.GK ? 0 : slotIndex, playerId)
          }
          onAutoFill={onAutoFillTeamA}
          complete={!setupError.teamA}
        />

        <TeamSetup
          teamId="team-b"
          title={teamBConfig.name}
          teamConfig={teamBConfig}
          players={players}
          onFormationChange={onTeamBFormationChange}
          onTacticsChange={onTeamBTacticsChange}
          onLineupPlayerChange={(role, slotIndex, playerId) =>
            onTeamBLineupChange(role, role === POSITION.GK ? 0 : slotIndex, playerId)
          }
          onAutoFill={onAutoFillTeamB}
          complete={!setupError.teamB}
        />
      </div>

      <div className="matchSim__startRow">
        <Button variant={BUTTON_VARIANT.PRIMARY} onClick={onStartMatch} disabled={!canStart}>
          Start Match
        </Button>
      </div>

      {(setupError.teamA || setupError.teamB) && (
        <div className="matchSim__errorText">
          {setupError.teamA || setupError.teamB}
        </div>
      )}
    </section>
  );
};

export default MatchSetupPanel;
