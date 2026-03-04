import { useMemo, useRef, useState, useEffect } from "react";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { randomInt } from "../../../engine/utils/rng/rng";
import { useGame } from "../../../engine/gameContext/gameContext";

import { Dropdown } from "primereact/dropdown";
import { Slider } from "primereact/slider";

import { saveGameToTxt, loadGameFromTxtFile } from "../../../engine/utils/saveGame/saveGame";
import { createTimer } from "../../../engine/utils/timer/timer";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDice, faCrown, faRocket, faGhost, faGem } from "@fortawesome/free-solid-svg-icons";

import { makeDecision } from "../../../engine/utils/makeDecision/makeDecision";

const COLOUR_OPTIONS = [
  { label: "Red", value: "red" },
  { label: "Green", value: "green" },
  { label: "Blue", value: "blue" },
  { label: "Yellow", value: "yellow" },
  { label: "Purple", value: "purple" },
  { label: "Teal", value: "teal" },
  { label: "Orange", value: "orange" },
  { label: "Pink", value: "pink" },
];

const GameFeatureSections = () => {
  const sections = useMemo(
    () => [
      {
        id: "rng",
        navLabel: "RNG",
        title: "Random Number Generator (RNG)",
        description:
          "Pure utility functions for randomness. These helpers are framework-agnostic and can be used anywhere in game logic, not just React components.",
        render: () => <RngExample />,
      },
      {
        id: "game-context",
        navLabel: "Game Context",
        title: "Game Context",
        description:
          "Global game state container. Any component can read (GET) and update (POST) game state.",
        render: () => <GameContextColoursExample />,
      },
      {
        id: "save-load",
        navLabel: "Save / Load",
        title: "Save / Load (Base64 TXT)",
        description:
          "Rudimentary save system: serialize GameContext to Base64, download as .txt, then load it later to restore state.",
        render: () => <SaveLoadExample />,
      },
      {
        id: "timer",
        navLabel: "Timer",
        title: "Timer",
        description:
          "Utility timer that ticks at a configured frequency for a configured duration. Demonstrates Start/Running/Reset, plus sliders for frequency and duration.",
        render: () => <TimerExample />,
      },
      {
        id: "make-decision",
        navLabel: "Decision",
        title: "Weighted Decision",
        description:
          "Selects a winner from 3-5 options based on slider weights (1-100). Probability is proportional to weight.",
        render: () => <MakeDecisionExample />,
      },
    ],
    []
  );

  return { sections };
};

const RngExample = () => {
  const { gameState, setGameValue } = useGame();

  const handleGenerate = () => {
    const roll = randomInt(1, 100);
    setGameValue("player.progress", roll);
  };

  return (
    <div className="info__examplesRow">
      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Random Integer</div>
          <div className="info__exampleDesc">
            Generates a random number between 1 and 100 and stores it into
            gameState.player.progress.
          </div>
        </div>

        <div className="info__exampleBody">
          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={handleGenerate}>
            Generate Number
          </Button>

          <div className="info__result">
            Result (player.progress): <strong>{gameState.player.progress}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

const GameContextColoursExample = () => {
  const { gameState, setGameValue } = useGame();

  const top = gameState.ui.top;
  const mid = gameState.ui.mid;
  const right = gameState.ui.right;

  return (
    <div className="info__examplesRow">
      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Live UI State (Top / Mid / Right)</div>
          <div className="info__exampleDesc">
            PrimeReact dropdowns update GameContext. The UI reads back from GameContext and renders
            the current values in real time.
          </div>
        </div>

        <div className="info__gameCtxGrid">
          <div className="info__gameCtxControl">
            <label className="info__formLabel" htmlFor="gc-top">
              Top
            </label>
            <Dropdown
              id="gc-top"
              value={top}
              options={COLOUR_OPTIONS}
              onChange={(e) => setGameValue("ui.top", e.value)}
              placeholder="Select a color"
            />
          </div>

          <div className="info__gameCtxControl">
            <label className="info__formLabel" htmlFor="gc-mid">
              Mid
            </label>
            <Dropdown
              id="gc-mid"
              value={mid}
              options={COLOUR_OPTIONS}
              onChange={(e) => setGameValue("ui.mid", e.value)}
              placeholder="Select a color"
            />
          </div>

          <div className="info__gameCtxControl">
            <label className="info__formLabel" htmlFor="gc-right">
              Right
            </label>
            <Dropdown
              id="gc-right"
              value={right}
              options={COLOUR_OPTIONS}
              onChange={(e) => setGameValue("ui.right", e.value)}
              placeholder="Select a color"
            />
          </div>
        </div>

        <div className="info__colorBoxes">
          <div className={`info__colorBox info__colorBox--${top}`} title={`Top: ${top}`} />
          <div className={`info__colorBox info__colorBox--${mid}`} title={`Mid: ${mid}`} />
          <div className={`info__colorBox info__colorBox--${right}`} title={`Right: ${right}`} />
        </div>

        <div className="info__result">
          Stored in GameContext: top={top}, mid={mid}, right={right}
        </div>
      </div>
    </div>
  );
};

const SaveLoadExample = () => {
  const { gameState, setGameValue, loadGameState } = useGame();
  const fileInputRef = useRef(null);

  const [status, setStatus] = useState("");

  const top = gameState.ui.top;
  const mid = gameState.ui.mid;
  const right = gameState.ui.right;

  const handleSave = () => {
    try {
      saveGameToTxt(gameState, { filename: "savegame.txt" });
      setStatus("Saved: downloaded savegame.txt");
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
    }
  };

  const handleOpenFilePicker = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleFileChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const loaded = await loadGameFromTxtFile(file);
      loadGameState(loaded);
      setStatus("Loaded: state restored from file");
    } catch (err) {
      setStatus(`Load failed: ${err.message}`);
    }
  };

  return (
    <div className="info__examplesRow">
      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Save and Restore UI Colours</div>
          <div className="info__exampleDesc">
            Change colours, click Save to download a Base64 .txt. Change again, then Load the file
            to restore the saved values.
          </div>
        </div>

        <div className="info__gameCtxGrid">
          <div className="info__gameCtxControl">
            <label className="info__formLabel" htmlFor="sl-top">
              Top
            </label>
            <Dropdown
              id="sl-top"
              value={top}
              options={COLOUR_OPTIONS}
              onChange={(e) => setGameValue("ui.top", e.value)}
              placeholder="Select a color"
            />
          </div>

          <div className="info__gameCtxControl">
            <label className="info__formLabel" htmlFor="sl-mid">
              Mid
            </label>
            <Dropdown
              id="sl-mid"
              value={mid}
              options={COLOUR_OPTIONS}
              onChange={(e) => setGameValue("ui.mid", e.value)}
              placeholder="Select a color"
            />
          </div>

          <div className="info__gameCtxControl">
            <label className="info__formLabel" htmlFor="sl-right">
              Right
            </label>
            <Dropdown
              id="sl-right"
              value={right}
              options={COLOUR_OPTIONS}
              onChange={(e) => setGameValue("ui.right", e.value)}
              placeholder="Select a color"
            />
          </div>
        </div>

        <div className="info__colorBoxes">
          <div className={`info__colorBox info__colorBox--${top}`} title={`Top: ${top}`} />
          <div className={`info__colorBox info__colorBox--${mid}`} title={`Mid: ${mid}`} />
          <div className={`info__colorBox info__colorBox--${right}`} title={`Right: ${right}`} />
        </div>

        <div className="info__saveLoadActions">
          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={handleSave}>
            Save (Download TXT)
          </Button>

          <Button variant={BUTTON_VARIANT.SECONDARY} onClick={handleOpenFilePicker}>
            Load (Choose TXT)
          </Button>

          <input
            ref={fileInputRef}
            className="info__hiddenFileInput"
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChosen}
          />
        </div>

        {status ? <div className="info__result">{status}</div> : null}
      </div>
    </div>
  );
};

const TimerExample = () => {
  const timerRef = useRef(null);

  const [value, setValue] = useState(0);
  const [finished, setFinished] = useState(false);

  const [frequencyMs, setFrequencyMs] = useState(1000); // 500-2000
  const [durationTicks, setDurationTicks] = useState(5); // 1-10

  const [status, setStatus] = useState("idle"); // idle | running | done

  const cleanupTimer = () => {
    if (timerRef.current) {
      timerRef.current.stop();
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = () => {
    if (status !== "idle") return;

    setFinished(false);
    setValue(0);
    setStatus("running");

    cleanupTimer();

    timerRef.current = createTimer({
      duration: durationTicks,
      frequencyMs,
      onTick: () => {
        setValue((prev) => prev + 1);
      },
      onFinish: () => {
        setFinished(true);
        setStatus("done");
      },
    });

    timerRef.current.start();
  };

  const handleReset = () => {
    cleanupTimer();
    setValue(0);
    setFinished(false);
    setStatus("idle");
  };

  const buttonLabel = status === "idle" ? "Start" : status === "running" ? "Running" : "Reset";
  const buttonDisabled = status === "running";
  const buttonOnClick = status === "done" ? handleReset : handleStart;

  return (
    <div className="info__examplesRow">
      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Timer Demo</div>
          <div className="info__exampleDesc">
            Uses a utility timer with duration (ticks) and frequency (ms). The value increments on
            each tick and shows a finished message on completion.
          </div>
        </div>

        <div className="info__timerTop">
          <div className="info__timerDisplay">
            {finished ? (
              <span className="info__timerDone">Timer finished</span>
            ) : (
              <span>{value}</span>
            )}
          </div>

          <Button
            variant={BUTTON_VARIANT.PRIMARY}
            disabled={buttonDisabled}
            onClick={buttonOnClick}
          >
            {buttonLabel}
          </Button>
        </div>

        <div className="info__timerControls">
          <div className="info__timerControl">
            <div className="info__timerControlHeader">
              <div className="info__timerControlTitle">Frequency</div>
              <div className="info__timerControlValue">{frequencyMs} ms</div>
            </div>

            <Slider
              value={frequencyMs}
              min={100}
              max={2000}
              step={100}
              onChange={(e) => setFrequencyMs(e.value)}
              disabled={status === "running"}
            />
          </div>

          <div className="info__timerControl">
            <div className="info__timerControlHeader">
              <div className="info__timerControlTitle">Duration</div>
              <div className="info__timerControlValue">{durationTicks} ticks</div>
            </div>

            <Slider
              value={durationTicks}
              min={1}
              max={10}
              step={1}
              onChange={(e) => setDurationTicks(e.value)}
              disabled={status === "running"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ICON_OPTIONS = [
  { id: "dice", label: "Dice", icon: faDice },
  { id: "crown", label: "Crown", icon: faCrown },
  { id: "rocket", label: "Rocket", icon: faRocket },
  { id: "ghost", label: "Ghost", icon: faGhost },
  { id: "gem", label: "Gem", icon: faGem },
];

const MakeDecisionExample = () => {
  // Default to 3 icons
  const [count, setCount] = useState(3);

  // One weight per icon option (only first `count` are used)
  const [weights, setWeights] = useState([50, 50, 50, 50, 50]);

  const [winnerId, setWinnerId] = useState(null);

  // Used to force re-mount/animation even when the winner does not change
  const [decisionKey, setDecisionKey] = useState(0);

  // Disable simulate button briefly to match animation duration
  const [isSimulating, setIsSimulating] = useState(false);

  const activeIcons = ICON_OPTIONS.slice(0, count);

  const setWeightAt = (index, nextValue) => {
    setWeights((prev) => {
      const next = [...prev];
      next[index] = Number(nextValue);
      return next;
    });
  };

  const handleSimulate = () => {
    if (isSimulating) return;

    setIsSimulating(true);

    const weightsObj = {};
    activeIcons.forEach((opt, idx) => {
      weightsObj[opt.id] = weights[idx];
    });

    const winner = makeDecision(weightsObj);

    // Force class removal and re-add so animation can replay on same winner
    setWinnerId(null);

    requestAnimationFrame(() => {
      setWinnerId(winner);
      setDecisionKey((k) => k + 1);
    });

    setTimeout(() => {
      setIsSimulating(false);
    }, 500);
  };

  const winnerMeta = ICON_OPTIONS.find((x) => x.id === winnerId) || null;

  return (
    <div className="info__examplesRow">
      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Pick a winner (weighted)</div>
          <div className="info__exampleDesc">
            Adjust weights for each icon. Click Simulate to pick a winner according to relative
            probabilities.
          </div>
        </div>

        <div className="info__decisionTop">
          <div className="info__decisionCount">
            <Button
              variant={BUTTON_VARIANT.SECONDARY}
              disabled={count <= 3 || isSimulating}
              onClick={() => setCount((c) => Math.max(3, c - 1))}
            >
              - Option
            </Button>

            <div className="info__decisionCountLabel">{count} options</div>

            <Button
              variant={BUTTON_VARIANT.SECONDARY}
              disabled={count >= 5 || isSimulating}
              onClick={() => setCount((c) => Math.min(5, c + 1))}
            >
              + Option
            </Button>
          </div>

          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={handleSimulate} disabled={isSimulating}>
            {isSimulating ? "Deciding..." : "Simulate Decision"}
          </Button>
        </div>

        <div className="info__decisionGrid">
          {activeIcons.map((opt, idx) => {
            const isWinner = winnerId === opt.id;

            return (
              <div
                key={`${opt.id}-${decisionKey}`}
                className={`info__decisionCard${isWinner ? " info__decisionCard--winner" : ""}`}
              >
                <div className="info__decisionIcon">
                  <FontAwesomeIcon icon={opt.icon} size="2x" />
                </div>

                <div className="info__decisionLabel">{opt.label}</div>

                <div className="info__decisionSliderRow">
                  <Slider
                    value={weights[idx]}
                    min={1}
                    max={100}
                    step={1}
                    disabled={isSimulating}
                    onChange={(e) => setWeightAt(idx, e.value)}
                  />
                  <div className="info__decisionWeight">{weights[idx]}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="info__result">
          {winnerMeta ? (
            <span>
              Winner: <strong>{winnerMeta.label}</strong>
            </span>
          ) : (
            <span>No decision yet</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameFeatureSections;
