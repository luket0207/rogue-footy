import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import playerIdentityPools from "../../../assets/gameContent/players";
import { computePlayerOverall } from "../../../features/matchSim/utils/playerFactory";
import {
  ATTACKING_TACTIC,
  DEFENSIVE_TACTIC,
  POSITION,
} from "../../../features/matchSim/utils/matchSimTypes";
import {
  createCareerLineupFromLegacySlots,
  DEFAULT_CAREER_FORMATION,
} from "../utils/teamSetup";
import "./startCareer.scss";

const DEFAULT_HOME_COLOR = "#1f4ed8";
const DEFAULT_AWAY_COLOR = "#f59e0b";
const MIN_COLOR_CONTRAST = 1.8;
const DEFAULT_PLAYER_TACTICS = Object.freeze({
  attacking: ATTACKING_TACTIC.DIRECT,
  defensive: DEFENSIVE_TACTIC.LOW_BLOCK,
});
const TEAM_DETAILS_STEP = 0;
const SLOT_QUEUE_LENGTH = 4;

const OVERALL_ROLL_TABLE = Object.freeze([
  Object.freeze({ overall: 65, probability: 7.5 }),
  Object.freeze({ overall: 66, probability: 12 }),
  Object.freeze({ overall: 67, probability: 20 }),
  Object.freeze({ overall: 68, probability: 20 }),
  Object.freeze({ overall: 69, probability: 15 }),
  Object.freeze({ overall: 70, probability: 11 }),
  Object.freeze({ overall: 71, probability: 6.5 }),
  Object.freeze({ overall: 72, probability: 4 }),
  Object.freeze({ overall: 73, probability: 2.5 }),
  Object.freeze({ overall: 74, probability: 1 }),
  Object.freeze({ overall: 75, probability: 0.5 }),
]);
const OVERALL_ROLL_TOTAL = OVERALL_ROLL_TABLE.reduce(
  (total, row) => total + row.probability,
  0
);

const DRAFT_SLOT_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "GK", label: "GK", preferredPos: POSITION.GK }),
  Object.freeze({ key: "DEF1", label: "DEF #1", preferredPos: POSITION.DEF }),
  Object.freeze({ key: "DEF2", label: "DEF #2", preferredPos: POSITION.DEF }),
  Object.freeze({ key: "MID1", label: "MID #1", preferredPos: POSITION.MID }),
  Object.freeze({ key: "MID2", label: "MID #2", preferredPos: POSITION.MID }),
  Object.freeze({ key: "FWD", label: "FWD", preferredPos: POSITION.FWR }),
]);

const SUMMARY_STEP = DRAFT_SLOT_DEFINITIONS.length + 1;

const PRIMARY_SKILL_BY_ROLE = Object.freeze({
  [POSITION.GK]: "goalkeeping",
  [POSITION.DEF]: "defending",
  [POSITION.MID]: "passing",
  [POSITION.FWR]: "finishing",
});

const SECONDARY_SKILL_BY_ROLE = Object.freeze({
  [POSITION.GK]: "passing",
  [POSITION.DEF]: "workRate",
  [POSITION.MID]: "control",
  [POSITION.FWR]: "offBall",
});

const createEmptyDraftSlots = () =>
  DRAFT_SLOT_DEFINITIONS.reduce((result, slot) => {
    result[slot.key] = "";
    return result;
  }, {});

const createEmptySlotQueues = () =>
  DRAFT_SLOT_DEFINITIONS.reduce((result, slot) => {
    result[slot.key] = {
      candidateIds: [],
      index: 0,
    };
    return result;
  }, {});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const choose = (items) => items[Math.floor(Math.random() * items.length)];
const normalizeHex = (value) => String(value || "").trim().toLowerCase();
const clampInt = (value, min, max) => Math.round(clamp(value, min, max));
const toHex = (value) => clampInt(value, 0, 255).toString(16).padStart(2, "0");

const shuffle = (items) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = temp;
  }
  return next;
};

const hexToRgb = (hexColor) => {
  const hex = normalizeHex(hexColor).replace("#", "");
  if (!(hex.length === 3 || hex.length === 6)) return null;
  const fullHex =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex;
  const intValue = Number.parseInt(fullHex, 16);
  if (!Number.isFinite(intValue)) return null;

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
};

const toLinearChannel = (channel) => {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (rgb) =>
  0.2126 * toLinearChannel(rgb.r) +
  0.7152 * toLinearChannel(rgb.g) +
  0.0722 * toLinearChannel(rgb.b);

const getContrastRatio = (hexA, hexB) => {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);
  if (!rgbA || !rgbB) return 1;

  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const brighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);

  return (brighter + 0.05) / (darker + 0.05);
};

const hslToHex = (hue, saturation, lightness) => {
  const h = ((Number(hue) % 360) + 360) % 360;
  const s = clamp(Number(saturation), 0, 100) / 100;
  const l = clamp(Number(lightness), 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return `#${toHex((r + m) * 255)}${toHex((g + m) * 255)}${toHex((b + m) * 255)}`;
};

const rollRandomTeamColor = () =>
  hslToHex(randomInt(0, 359), randomInt(55, 85), randomInt(34, 64));

const createRandomValidColorPair = (minContrast) => {
  for (let attempts = 0; attempts < 140; attempts += 1) {
    const home = rollRandomTeamColor();
    const away = rollRandomTeamColor();
    if (normalizeHex(home) === normalizeHex(away)) continue;
    if (getContrastRatio(home, away) < minContrast) continue;
    return { home, away };
  }

  return {
    home: DEFAULT_HOME_COLOR,
    away: DEFAULT_AWAY_COLOR,
  };
};

const pickWeightedOverall = () => {
  let roll = Math.random() * OVERALL_ROLL_TOTAL;
  for (let index = 0; index < OVERALL_ROLL_TABLE.length; index += 1) {
    const entry = OVERALL_ROLL_TABLE[index];
    if (roll <= entry.probability) {
      return entry;
    }
    roll -= entry.probability;
  }
  return OVERALL_ROLL_TABLE[OVERALL_ROLL_TABLE.length - 1];
};

const pickNationalityPool = () => {
  const pools = playerIdentityPools?.nationalities || [];
  if (pools.length === 0) {
    return {
      country: "Unknown",
      firstNames: ["Alex"],
      lastNames: ["Player"],
    };
  }
  return choose(pools);
};

const buildUniqueName = (pool, usedNamesRef) => {
  const firstNames = pool.firstNames || ["Alex"];
  const lastNames = pool.lastNames || ["Player"];
  let firstName = choose(firstNames);
  let lastName = choose(lastNames);
  let fullName = `${firstName} ${lastName}`;
  let attempts = 0;

  while (usedNamesRef.current.has(fullName) && attempts < 20) {
    firstName = choose(firstNames);
    lastName = choose(lastNames);
    fullName = `${firstName} ${lastName}`;
    attempts += 1;
  }

  if (usedNamesRef.current.has(fullName)) {
    fullName = `${fullName} ${attempts + 1}`;
  }

  usedNamesRef.current.add(fullName);
  return fullName;
};

const rollAge = () => {
  const range = playerIdentityPools?.age || { min: 20, max: 26 };
  return randomInt(range.min, range.max);
};

const rollAppearance = () => {
  const range = playerIdentityPools?.appearanceRange || { min: 1, max: 5 };
  return [
    randomInt(range.min, range.max),
    randomInt(range.min, range.max),
    randomInt(range.min, range.max),
  ];
};

const roleSkillValue = (targetOverall, minOffset, maxOffset) =>
  Math.round(clamp(targetOverall + randomFloat(minOffset, maxOffset), 1, 100));

const sampleBellCurveInt = ({ mean, stdDev, min, max }) => {
  let u1 = Math.random();
  let u2 = Math.random();

  // Avoid log(0) in Box-Muller transform.
  if (u1 <= 0) u1 = 0.0001;
  if (u2 <= 0) u2 = 0.0001;

  const standardNormal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return clampInt(mean + standardNormal * stdDev, min, max);
};

const generateRoleSkills = (role, targetOverall) => {
  if (role === POSITION.GK) {
    return {
      finishing: roleSkillValue(targetOverall, -38, -20),
      passing: roleSkillValue(targetOverall, -14, -4),
      control: roleSkillValue(targetOverall, -16, -6),
      defending: roleSkillValue(targetOverall, -24, -12),
      offBall: roleSkillValue(targetOverall, -30, -16),
      workRate: roleSkillValue(targetOverall, -12, -2),
      goalkeeping: roleSkillValue(targetOverall, 8, 14),
    };
  }

  if (role === POSITION.DEF) {
    return {
      finishing: roleSkillValue(targetOverall, -16, -8),
      passing: roleSkillValue(targetOverall, -2, 6),
      control: roleSkillValue(targetOverall, -2, 5),
      defending: roleSkillValue(targetOverall, 8, 14),
      offBall: roleSkillValue(targetOverall, -4, 5),
      workRate: roleSkillValue(targetOverall, 4, 11),
      goalkeeping: randomInt(1, 8),
    };
  }

  if (role === POSITION.MID) {
    return {
      finishing: roleSkillValue(targetOverall, -3, 6),
      passing: roleSkillValue(targetOverall, 8, 14),
      control: roleSkillValue(targetOverall, 8, 14),
      defending: roleSkillValue(targetOverall, -5, 4),
      offBall: roleSkillValue(targetOverall, 4, 10),
      workRate: roleSkillValue(targetOverall, 1, 8),
      goalkeeping: randomInt(1, 7),
    };
  }

  return {
    finishing: roleSkillValue(targetOverall, 8, 14),
    passing: roleSkillValue(targetOverall, -4, 4),
    control: roleSkillValue(targetOverall, 2, 8),
    defending: roleSkillValue(targetOverall, -18, -8),
    offBall: roleSkillValue(targetOverall, 6, 12),
    workRate: roleSkillValue(targetOverall, -3, 5),
    goalkeeping: randomInt(1, 6),
  };
};

const enforceOverallRange = (player, role, targetOverall, minOverall, maxOverall) => {
  const primarySkill = PRIMARY_SKILL_BY_ROLE[role] || "passing";
  const secondarySkill = SECONDARY_SKILL_BY_ROLE[role] || "control";
  const tuned = { ...player };
  let overall = computePlayerOverall(tuned, role);
  let guard = 0;

  while (Math.abs(overall - targetOverall) > 0.5 && guard < 80) {
    if (overall < targetOverall) {
      tuned[primarySkill] = clampInt(tuned[primarySkill] + 1, 1, 100);
      if (Math.random() < 0.45) {
        tuned[secondarySkill] = clampInt(tuned[secondarySkill] + 1, 1, 100);
      }
    } else {
      tuned[secondarySkill] = clampInt(tuned[secondarySkill] - 1, 1, 100);
      if (Math.random() < 0.35) {
        tuned[primarySkill] = clampInt(tuned[primarySkill] - 1, 1, 100);
      }
    }
    overall = computePlayerOverall(tuned, role);
    guard += 1;
  }

  while (overall < minOverall && guard < 120) {
    tuned[primarySkill] = clampInt(tuned[primarySkill] + 1, 1, 100);
    tuned[secondarySkill] = clampInt(tuned[secondarySkill] + (Math.random() < 0.5 ? 1 : 0), 1, 100);
    overall = computePlayerOverall(tuned, role);
    guard += 1;
  }

  while (overall > maxOverall && guard < 140) {
    tuned[secondarySkill] = clampInt(tuned[secondarySkill] - 1, 1, 100);
    tuned[primarySkill] = clampInt(tuned[primarySkill] - (Math.random() < 0.35 ? 1 : 0), 1, 100);
    overall = computePlayerOverall(tuned, role);
    guard += 1;
  }

  return {
    ...tuned,
    overall,
  };
};

const createSerializableDraftPlayer = (player, slotKey) => ({
  id: player.id,
  name: player.name,
  firstName: player.firstName || "",
  lastName: player.lastName || "",
  age: player.age,
  nationality: player.nationality,
  appearance: Array.isArray(player.appearance) ? [...player.appearance] : [1, 1, 1],
  preferredPos: player.preferredPos,
  slotKey,
  overall: player.overall,
  finishing: player.finishing,
  passing: player.passing,
  control: player.control,
  defending: player.defending,
  offBall: player.offBall,
  workRate: player.workRate,
  goalkeeping: player.goalkeeping,
});

const StartCareer = () => {
  const { setGameValue, setGameState } = useGame();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [homeColor, setHomeColor] = useState(DEFAULT_HOME_COLOR);
  const [awayColor, setAwayColor] = useState(DEFAULT_AWAY_COLOR);
  const [stepIndex, setStepIndex] = useState(TEAM_DETAILS_STEP);
  const [draftSlots, setDraftSlots] = useState(createEmptyDraftSlots);
  const [slotQueues, setSlotQueues] = useState(createEmptySlotQueues);
  const [playersById, setPlayersById] = useState({});

  const usedNamesRef = useRef(new Set());
  const candidateCounterRef = useRef(0);

  const generateDraftCandidate = (slot) => {
    const overallRoll = pickWeightedOverall();
    const targetOverall = Number(overallRoll.overall) || 70;
    const nationalityPool = pickNationalityPool();
    const name = buildUniqueName(nationalityPool, usedNamesRef);

    candidateCounterRef.current += 1;

    const rawPlayer = {
      id: `career_draft_${slot.key.toLowerCase()}_${String(candidateCounterRef.current).padStart(4, "0")}`,
      name,
      age: rollAge(),
      nationality: nationalityPool.country,
      appearance: rollAppearance(),
      preferredPos: slot.preferredPos,
      ...generateRoleSkills(slot.preferredPos, targetOverall),
      overallRollProbability: Number(overallRoll.probability) || 0,
    };

    return enforceOverallRange(
      rawPlayer,
      slot.preferredPos,
      targetOverall,
      targetOverall,
      targetOverall
    );
  };

  const buildCandidateBatch = (slot) => {
    const candidates = [];
    for (let index = 0; index < SLOT_QUEUE_LENGTH; index += 1) {
      candidates.push(generateDraftCandidate(slot));
    }
    return candidates;
  };

  useEffect(() => {
    setGameValue("mode", "career");
  }, [setGameValue]);

  const validation = useMemo(() => {
    const trimmedTeamName = teamName.trim();
    const sameColor = normalizeHex(homeColor) === normalizeHex(awayColor);
    const contrastRatio = getContrastRatio(homeColor, awayColor);
    const contrastValid = contrastRatio >= MIN_COLOR_CONTRAST;

    return {
      trimmedTeamName,
      sameColor,
      contrastRatio,
      contrastValid,
      teamNameValid: trimmedTeamName.length > 0,
      canContinue: trimmedTeamName.length > 0 && !sameColor && contrastValid,
    };
  }, [awayColor, homeColor, teamName]);

  const stepMeta = useMemo(() => {
    if (stepIndex === TEAM_DETAILS_STEP) {
      return {
        type: "details",
        label: "Team Details",
      };
    }

    if (stepIndex === SUMMARY_STEP) {
      return {
        type: "summary",
        label: "Summary",
      };
    }

    const slot = DRAFT_SLOT_DEFINITIONS[stepIndex - 1];
    return {
      type: "slot",
      label: `Choose ${slot.label}`,
      slot,
    };
  }, [stepIndex]);

  useEffect(() => {
    if (stepMeta.type !== "slot") return;

    const slotKey = stepMeta.slot.key;
    const queue = slotQueues[slotKey];
    if (queue?.candidateIds?.length >= SLOT_QUEUE_LENGTH) return;

    const candidates = buildCandidateBatch(stepMeta.slot);

    const randomOrder = shuffle(candidates);
    const nextPlayersById = randomOrder.reduce((result, player) => {
      result[player.id] = player;
      return result;
    }, {});

    setPlayersById((previous) => ({
      ...previous,
      ...nextPlayersById,
    }));
    setSlotQueues((previous) => ({
      ...previous,
      [slotKey]: {
        candidateIds: randomOrder.map((player) => player.id),
        index: 0,
      },
    }));
  }, [slotQueues, stepMeta]);

  const currentSlotValue =
    stepMeta.type === "slot" ? draftSlots[stepMeta.slot.key] || "" : "";
  const currentSlotQueue =
    stepMeta.type === "slot" ? slotQueues[stepMeta.slot.key] : null;
  const currentCandidateId =
    stepMeta.type === "slot" &&
    currentSlotQueue &&
    currentSlotQueue.candidateIds.length > 0
      ? currentSlotQueue.candidateIds[currentSlotQueue.index]
      : "";
  const currentCandidate = currentCandidateId ? playersById[currentCandidateId] : null;
  const isLastQueueCandidate =
    stepMeta.type === "slot" && currentSlotQueue
      ? currentSlotQueue.index >= Math.max(0, currentSlotQueue.candidateIds.length - 1)
      : false;
  const canContinue =
    stepMeta.type === "details"
      ? validation.canContinue
      : stepMeta.type === "slot"
        ? currentSlotValue !== ""
        : true;

  const summarySlots = useMemo(
    () =>
      DRAFT_SLOT_DEFINITIONS.map((slot) => {
        const playerId = draftSlots[slot.key];
        return {
          ...slot,
          playerId,
          player: playerId ? playersById[playerId] || null : null,
        };
      }),
    [draftSlots, playersById]
  );

  const isSummaryValid = useMemo(
    () => validation.canContinue && summarySlots.every((entry) => entry.player),
    [summarySlots, validation.canContinue]
  );

  const handleSkipCandidate = () => {
    if (stepMeta.type !== "slot" || !currentSlotQueue) return;
    if (isLastQueueCandidate) return;

    setSlotQueues((previous) => ({
      ...previous,
      [stepMeta.slot.key]: {
        ...previous[stepMeta.slot.key],
        index: previous[stepMeta.slot.key].index + 1,
      },
    }));
  };

  const handleKeepCandidate = () => {
    if (stepMeta.type !== "slot" || !currentCandidateId) return;

    setDraftSlots((previous) => ({
      ...previous,
      [stepMeta.slot.key]: currentCandidateId,
    }));
    setStepIndex((previous) => Math.min(SUMMARY_STEP, previous + 1));
  };

  const handleStartCareer = () => {
    if (!isSummaryValid) return;

    const squad = summarySlots.map((entry) =>
      createSerializableDraftPlayer(entry.player, entry.key)
    );
    const lineupSlots = summarySlots.reduce((result, entry) => {
      result[entry.key] = entry.playerId;
      return result;
    }, {});
    const createdAt = new Date().toISOString();
    const playerTeam = {
      id: "player_team",
      name: validation.trimmedTeamName,
      homeColor,
      awayColor,
      baseTier: 10,
      formation: DEFAULT_CAREER_FORMATION,
      tactics: DEFAULT_PLAYER_TACTICS,
      lineup: lineupSlots,
      matchSetup: {
        formation: DEFAULT_CAREER_FORMATION,
        lineup: createCareerLineupFromLegacySlots(
          lineupSlots,
          DEFAULT_CAREER_FORMATION
        ),
        tactics: DEFAULT_PLAYER_TACTICS,
        updatedAt: createdAt,
      },
      squad,
      createdAt,
    };

    setGameState((previous) => ({
      ...previous,
      mode: "career",
      career: {
        status: "generating",
        createdAt,
        wonTopLeague: false,
        wonChampionsCup: false,
        victoryProgress: {
          wonTopLeague: false,
          wonChampionsCup: false,
          isCareerWon: false,
          wonTopLeagueAt: "",
          wonChampionsCupAt: "",
          careerWonAt: "",
          updatedAt: createdAt,
        },
        generation: {
          startedAt: createdAt,
          completedAt: "",
          completedSteps: [],
        },
        playerTeam,
        aiTeams: [],
        leagues: [],
        season: null,
        fixtures: null,
        leagueTables: {},
        cupEligibility: null,
        cups: null,
        pendingCupDraw: null,
        dayTransitionNotice: {
          seasonNumber: 1,
          lastShownDay: 1,
          acknowledgedAt: createdAt,
        },
        seasonHistory: [],
        lastSeasonSummary: null,
        relegationProgress: {
          totalRelegations: 0,
          consecutiveRelegations: 0,
          bottomTierRelegations: 0,
          lastSeasonRelegated: false,
          lastSeasonBottomTierRelegation: false,
          lastProcessedSeason: 0,
          isGameOver: false,
          gameOverReason: "",
          gameOverAt: "",
          updatedAt: createdAt,
        },
      },
      match: {
        ...(previous?.match && typeof previous.match === "object" ? previous.match : {}),
        pendingConfig: null,
        activeCareerMatch: null,
        lastCareerMatchResult: null,
        autoKickOffToken: "",
      },
    }));

    navigate("/career/loading");
  };

  const handleRandomizeColors = () => {
    const colors = createRandomValidColorPair(MIN_COLOR_CONTRAST);
    setHomeColor(colors.home);
    setAwayColor(colors.away);
  };

  return (
    <div className="careerStart">
      <section className="careerStart__panel">
        <h1>Career Mode</h1>
        <p>Start Career setup</p>
        <div className="careerStart__stepMeta">
          Step {stepIndex + 1} of {SUMMARY_STEP + 1}: {stepMeta.label}
        </div>

        {stepMeta.type === "details" ? (
          <>
            <div className="careerStart__form">
              <div className="careerStart__control">
                <label htmlFor="career-team-name">Team Name</label>
                <input
                  id="career-team-name"
                  type="text"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Enter your team name"
                />
              </div>

              <div className="careerStart__colorGrid">
                <div className="careerStart__control">
                  <label htmlFor="career-home-color">Home Color</label>
                  <input
                    id="career-home-color"
                    type="color"
                    value={homeColor}
                    onChange={(event) => setHomeColor(event.target.value)}
                  />
                </div>

                <div className="careerStart__control">
                  <label htmlFor="career-away-color">Away Color</label>
                  <input
                    id="career-away-color"
                    type="color"
                    value={awayColor}
                    onChange={(event) => setAwayColor(event.target.value)}
                  />
                </div>
              </div>

              <div className="careerStart__swatchRow">
                <div className="careerStart__swatch">
                  <span className="careerStart__swatchDot" style={{ background: homeColor }} />
                  Home {homeColor.toUpperCase()}
                </div>
                <div className="careerStart__swatch">
                  <span className="careerStart__swatchDot" style={{ background: awayColor }} />
                  Away {awayColor.toUpperCase()}
                </div>
              </div>
              <div className="careerStart__colorActions">
                <Button variant={BUTTON_VARIANT.SECONDARY} onClick={handleRandomizeColors}>
                  Randomise Colours
                </Button>
              </div>

              <div className="careerStart__validationList">
                <div className={validation.teamNameValid ? "is-valid" : "is-invalid"}>
                  Team name must not be empty.
                </div>
                <div className={!validation.sameColor ? "is-valid" : "is-invalid"}>
                  Home and away colors must be different.
                </div>
                <div className={validation.contrastValid ? "is-valid" : "is-invalid"}>
                  Color contrast must be at least {MIN_COLOR_CONTRAST.toFixed(1)}. Current:{" "}
                  {validation.contrastRatio.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="careerStart__actions">
              <Button variant={BUTTON_VARIANT.SECONDARY} to="/">
                Back Home
              </Button>
              <Button
                variant={BUTTON_VARIANT.PRIMARY}
                onClick={() => setStepIndex(1)}
                disabled={!canContinue}
              >
                Continue
              </Button>
            </div>
          </>
        ) : stepMeta.type === "slot" ? (
          <>
            <div className="careerStart__draftPanel">
              <h2>{stepMeta.label}</h2>

              {currentSlotQueue && currentSlotQueue.candidateIds.length > 0 ? (
                <>
                  <div className="careerStart__candidateMeta">
                    Candidate {currentSlotQueue.index + 1} of {SLOT_QUEUE_LENGTH}
                  </div>

                  <div className="careerStart__candidateCard">
                    <div className="careerStart__candidateName">
                      {currentCandidate?.name || "Unknown Player"}
                    </div>
                    <div className="careerStart__candidateStats">
                      <span>{currentCandidate?.preferredPos || stepMeta.slot.preferredPos}</span>
                      <span>OVR {currentCandidate?.overall ?? "--"}</span>
                      <span>
                        Roll {(Number(currentCandidate?.overallRollProbability) || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {isLastQueueCandidate && (
                    <div className="careerStart__queueHint">
                      Candidate 4 reached: Skip is disabled, you must Keep.
                    </div>
                  )}

                  <div className="careerStart__candidateActions">
                    <Button
                      variant={BUTTON_VARIANT.SECONDARY}
                      onClick={handleSkipCandidate}
                      disabled={isLastQueueCandidate}
                    >
                      Skip
                    </Button>
                    <Button variant={BUTTON_VARIANT.PRIMARY} onClick={handleKeepCandidate}>
                      Keep
                    </Button>
                  </div>
                </>
              ) : (
                <div className="careerStart__muted">No candidates available for this slot.</div>
              )}

              {currentSlotValue &&
                playersById[currentSlotValue] &&
                currentSlotValue !== currentCandidateId && (
                  <div className="careerStart__selectedPlayer">
                    Selected: <strong>{playersById[currentSlotValue].name}</strong> (
                    {playersById[currentSlotValue].preferredPos}, OVR{" "}
                    {playersById[currentSlotValue].overall})
                  </div>
                )}
            </div>

            <div className="careerStart__actions">
              <Button
                variant={BUTTON_VARIANT.SECONDARY}
                onClick={() => setStepIndex((previous) => Math.max(0, previous - 1))}
              >
                Back
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="careerStart__nextStep">
              <h2>Squad Summary</h2>
              <p>
                Team details validated for <strong>{validation.trimmedTeamName}</strong>.
              </p>
              <p>
                Home {homeColor.toUpperCase()} vs Away {awayColor.toUpperCase()}.
              </p>

              <div className="careerStart__summaryList">
                {summarySlots.map((slot) => {
                  const player = slot.player;
                  return (
                    <div className="careerStart__summaryRow" key={slot.key}>
                      <span>{slot.label}</span>
                      <strong>{player ? `${player.name} (OVR ${player.overall})` : "Not selected"}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="careerStart__actions">
              <Button
                variant={BUTTON_VARIANT.SECONDARY}
                onClick={() => setStepIndex(DRAFT_SLOT_DEFINITIONS.length)}
              >
                Back
              </Button>
              <Button variant={BUTTON_VARIANT.PRIMARY} onClick={handleStartCareer} disabled={!isSummaryValid}>
                Start Career
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default StartCareer;
