/* eslint-disable react/prop-types */

import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { POSITION } from "../utils/matchSimTypes";
import { OPPOSITION_LEVEL_OPTIONS } from "../utils/oppositionGenerator";
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
  onRandomFill,
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

      <FormationPicker id={`${teamId}-formation`} value={teamConfig.formation} onChange={onFormationChange} />

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
        <Button variant={BUTTON_VARIANT.SECONDARY} onClick={onRandomFill}>
          Random Fill {title}
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
  teamConfig,
  onTeamFormationChange,
  onTeamTacticsChange,
  onTeamLineupChange,
  onAutoFillTeam,
  onRandomFillTeam,
  oppositionDifficulty,
  onOppositionDifficultyChange,
  difficultyPreview,
  onStartMatch,
  canStart,
  setupError,
}) => {
  return (
    <section className="matchSim__setupPanel">
      <div className="matchSim__configGrid">
        <div className="matchSim__control matchSim__control--seed">
          <label htmlFor="match-seed">Seed</label>
          <input id="match-seed" value={seed} onChange={(event) => onSeedChange(event.target.value)} type="text" />
          <Button variant={BUTTON_VARIANT.SECONDARY} onClick={onRandomizeSeed}>
            Randomize Seed
          </Button>
        </div>

        <div className="matchSim__control">
          <label htmlFor="opposition-difficulty">Opposition Difficulty</label>
          <select
            id="opposition-difficulty"
            value={oppositionDifficulty}
            onChange={(event) => onOppositionDifficultyChange(Number(event.target.value))}
          >
            {OPPOSITION_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {difficultyPreview && (
            <div className="matchSim__lineupHint">
              Your team est: L{difficultyPreview.playerLevel} ({difficultyPreview.playerOverall.toFixed(2)}) | Opp est: L
              {difficultyPreview.opponentLevel} ({difficultyPreview.opponentOverall.toFixed(2)})
            </div>
          )}
        </div>
      </div>

      <div className="matchSim__teamsGrid matchSim__teamsGrid--single">
        <TeamSetup
          teamId="team-a"
          title={teamConfig.name}
          teamConfig={teamConfig}
          players={players}
          onFormationChange={onTeamFormationChange}
          onTacticsChange={onTeamTacticsChange}
          onLineupPlayerChange={(role, slotIndex, playerId) =>
            onTeamLineupChange(role, role === POSITION.GK ? 0 : slotIndex, playerId)
          }
          onAutoFill={onAutoFillTeam}
          onRandomFill={onRandomFillTeam}
          complete={!setupError}
        />
      </div>

      <div className="matchSim__startRow">
        <Button variant={BUTTON_VARIANT.PRIMARY} onClick={onStartMatch} disabled={!canStart}>
          Start Match
        </Button>
      </div>

      {setupError && <div className="matchSim__errorText">{setupError}</div>}
    </section>
  );
};

export default MatchSetupPanel;
