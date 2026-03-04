import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import players from "../../../assets/gameContent/players";
import {
  autoFillLineup,
  isLineupComplete,
  normalizeLineupForFormation,
  updateLineupSlot,
} from "../utils/lineup";
import { ATTACKING_TACTIC, DEFENSIVE_TACTIC, POSITION } from "../utils/matchSimTypes";
import MatchSetupPanel from "./MatchSetupPanel";
import "./matchScreen.scss";

const FIXED_CHUNK_COUNT = 30;

const createRandomSeed = () =>
  `seed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const buildTeamConfig = (name, formation, attacking, defensive, variant) => ({
  name,
  formation,
  tactics: {
    attacking,
    defensive,
  },
  lineup: autoFillLineup(players, formation, variant),
});

const TeamSelection = () => {
  const navigate = useNavigate();
  const { setGameValue } = useGame();

  const [seed, setSeed] = useState("debug-seed-2026");
  const [teamAConfig, setTeamAConfig] = useState(() =>
    buildTeamConfig(
      "Team A",
      "1-2-2",
      ATTACKING_TACTIC.POSSESSION,
      DEFENSIVE_TACTIC.MID_BLOCK,
      0
    )
  );
  const [teamBConfig, setTeamBConfig] = useState(() =>
    buildTeamConfig(
      "Team B",
      "2-1-2",
      ATTACKING_TACTIC.COUNTER,
      DEFENSIVE_TACTIC.LOW_BLOCK,
      1
    )
  );

  const setupError = useMemo(() => {
    const teamAComplete = isLineupComplete(teamAConfig.lineup, teamAConfig.formation);
    const teamBComplete = isLineupComplete(teamBConfig.lineup, teamBConfig.formation);

    return {
      teamA: teamAComplete ? "" : "Team A lineup must have exactly 1 GK and a valid formation split.",
      teamB: teamBComplete ? "" : "Team B lineup must have exactly 1 GK and a valid formation split.",
    };
  }, [teamAConfig, teamBConfig]);

  const canStart = !setupError.teamA && !setupError.teamB;

  const updateTeamA = (updater) => setTeamAConfig((previous) => updater(previous));
  const updateTeamB = (updater) => setTeamBConfig((previous) => updater(previous));

  const handleStartMatch = () => {
    if (!canStart) return;

    const pendingConfig = {
      seed,
      chunkCount: FIXED_CHUNK_COUNT,
      players,
      teamA: teamAConfig,
      teamB: teamBConfig,
    };

    setGameValue("match.pendingConfig", pendingConfig);
    navigate("/match");
  };

  return (
    <div className="matchSim">
      <header className="matchSim__header">
        <div>
          <h1>Debug Team Selection</h1>
          <p>
            Debug-only setup screen. Final game flow will pass teams directly from game context.
          </p>
        </div>

        <div className="matchSim__headerActions">
          <Button variant={BUTTON_VARIANT.TERTIARY} to="/">
            Back to Home
          </Button>
        </div>
      </header>

      <MatchSetupPanel
        players={players}
        seed={seed}
        onSeedChange={setSeed}
        onRandomizeSeed={() => setSeed(createRandomSeed())}
        teamAConfig={teamAConfig}
        teamBConfig={teamBConfig}
        onTeamAFormationChange={(formation) =>
          updateTeamA((previous) => ({
            ...previous,
            formation,
            lineup: normalizeLineupForFormation(previous.lineup, formation),
          }))
        }
        onTeamBFormationChange={(formation) =>
          updateTeamB((previous) => ({
            ...previous,
            formation,
            lineup: normalizeLineupForFormation(previous.lineup, formation),
          }))
        }
        onTeamATacticsChange={(tactics) => updateTeamA((previous) => ({ ...previous, tactics }))}
        onTeamBTacticsChange={(tactics) => updateTeamB((previous) => ({ ...previous, tactics }))}
        onTeamALineupChange={(role, slotIndex, playerId) =>
          updateTeamA((previous) => ({
            ...previous,
            lineup:
              role === POSITION.GK
                ? { ...previous.lineup, gkId: playerId }
                : updateLineupSlot(previous.lineup, role, slotIndex, playerId),
          }))
        }
        onTeamBLineupChange={(role, slotIndex, playerId) =>
          updateTeamB((previous) => ({
            ...previous,
            lineup:
              role === POSITION.GK
                ? { ...previous.lineup, gkId: playerId }
                : updateLineupSlot(previous.lineup, role, slotIndex, playerId),
          }))
        }
        onAutoFillTeamA={() =>
          updateTeamA((previous) => ({
            ...previous,
            lineup: autoFillLineup(players, previous.formation, 0),
          }))
        }
        onAutoFillTeamB={() =>
          updateTeamB((previous) => ({
            ...previous,
            lineup: autoFillLineup(players, previous.formation, 1),
          }))
        }
        onStartMatch={handleStartMatch}
        canStart={canStart}
        setupError={setupError}
      />
    </div>
  );
};

export default TeamSelection;

