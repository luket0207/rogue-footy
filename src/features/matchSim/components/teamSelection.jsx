import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import {
  autoFillLineup,
  isLineupComplete,
  normalizeLineupForFormation,
  randomFillLineup,
  updateLineupSlot,
} from "../utils/lineup";
import { ATTACKING_TACTIC, DEFENSIVE_TACTIC, POSITION } from "../utils/matchSimTypes";
import { generateOppositionFromDifficulty } from "../utils/oppositionGenerator";
import { createGeneratedPlayers } from "../utils/playerFactory";
import MatchSetupPanel from "./MatchSetupPanel";
import "./matchScreen.scss";

const FIXED_CHUNK_COUNT = 30;

const createRandomSeed = () =>
  `seed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const buildTeamConfig = (players, name, formation, attacking, defensive, variant) => ({
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
  const [generatedPlayers] = useState(() =>
    createGeneratedPlayers({
      seed: "debug-player-pool-v1",
      perPosition: 10,
    })
  );

  useEffect(() => {
    setGameValue("match.generatedPlayers", generatedPlayers);
  }, [generatedPlayers, setGameValue]);

  const [seed, setSeed] = useState("debug-seed-2026");
  const [oppositionDifficulty, setOppositionDifficulty] = useState(5);
  const [teamAConfig, setTeamAConfig] = useState(() =>
    buildTeamConfig(
      generatedPlayers,
      "Team A",
      "2-2-1",
      ATTACKING_TACTIC.POSSESSION,
      DEFENSIVE_TACTIC.MID_BLOCK,
      0
    )
  );

  const teamSetupError = useMemo(() => {
    const teamAComplete = isLineupComplete(teamAConfig.lineup, teamAConfig.formation);

    return teamAComplete ? "" : "Team lineup must have exactly 1 GK and a valid formation split.";
  }, [teamAConfig]);

  const oppositionPreview = useMemo(() => {
    if (teamSetupError) return null;
    return generateOppositionFromDifficulty({
      players: generatedPlayers,
      playerTeamConfig: teamAConfig,
      difficultyLevel: oppositionDifficulty,
      seed,
    });
  }, [generatedPlayers, oppositionDifficulty, seed, teamAConfig, teamSetupError]);

  const updateTeamA = (updater) => setTeamAConfig((previous) => updater(previous));
  const canStart = !teamSetupError && oppositionPreview != null;

  const handleStartMatch = () => {
    if (!canStart) return;
    const generated = oppositionPreview;
    if (!generated) return;

    const pendingConfig = {
      seed,
      chunkCount: FIXED_CHUNK_COUNT,
      players: generatedPlayers,
      teamA: teamAConfig,
      teamB: generated.teamConfig,
    };

    setGameValue("match.generatedPlayers", generatedPlayers);
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
        players={generatedPlayers}
        seed={seed}
        onSeedChange={setSeed}
        onRandomizeSeed={() => setSeed(createRandomSeed())}
        teamConfig={teamAConfig}
        onTeamFormationChange={(formation) =>
          updateTeamA((previous) => ({
            ...previous,
            formation,
            lineup: normalizeLineupForFormation(previous.lineup, formation),
          }))
        }
        onTeamTacticsChange={(tactics) => updateTeamA((previous) => ({ ...previous, tactics }))}
        onTeamLineupChange={(role, slotIndex, playerId) =>
          updateTeamA((previous) => ({
            ...previous,
            lineup:
              role === POSITION.GK
                ? { ...previous.lineup, gkId: playerId }
                : updateLineupSlot(previous.lineup, role, slotIndex, playerId),
          }))
        }
        onAutoFillTeam={() =>
          updateTeamA((previous) => ({
            ...previous,
            lineup: autoFillLineup(generatedPlayers, previous.formation, 0),
          }))
        }
        onRandomFillTeam={() =>
          updateTeamA((previous) => ({
            ...previous,
            lineup: randomFillLineup(generatedPlayers, previous.formation),
          }))
        }
        oppositionDifficulty={oppositionDifficulty}
        onOppositionDifficultyChange={setOppositionDifficulty}
        difficultyPreview={oppositionPreview?.diagnostics || null}
        onStartMatch={handleStartMatch}
        canStart={canStart}
        setupError={teamSetupError}
      />
    </div>
  );
};

export default TeamSelection;
