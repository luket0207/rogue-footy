import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import { POSITION } from "../../../features/matchSim/utils/matchSimTypes";
import { createCareerTeamsByIdWithCups } from "../utils/careerMatchFlow";
import "./careerPreMatch.scss";

const FALLBACK_HOME_COLOR = "#1d4ed8";
const FALLBACK_AWAY_COLOR = "#b91c1c";
const normalizeText = (value) => String(value || "").trim().toLowerCase();

const normalizeHex = (value) => String(value || "").trim().toLowerCase();
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

const pickBestContrastColor = (baseColor, candidates, fallbackColor) => {
  const usable = [...new Set((Array.isArray(candidates) ? candidates : []).filter(Boolean))];
  if (usable.length === 0) return fallbackColor;

  let best = usable[0];
  let bestContrast = getContrastRatio(baseColor, best);
  for (let index = 1; index < usable.length; index += 1) {
    const candidate = usable[index];
    const contrast = getContrastRatio(baseColor, candidate);
    if (contrast > bestContrast) {
      best = candidate;
      bestContrast = contrast;
    }
  }

  return best;
};

const toLineupRows = (teamConfig, playersById) => {
  const lineup = teamConfig?.lineup || {};
  const rows = [];

  if (lineup.gkId) {
    rows.push({ slot: "GK", playerId: lineup.gkId });
  }

  const roleKeys = [
    { role: POSITION.DEF, label: "DEF" },
    { role: POSITION.MID, label: "MID" },
    { role: POSITION.FWR, label: "FWD" },
  ];

  roleKeys.forEach(({ role, label }) => {
    const ids = Array.isArray(lineup[role]) ? lineup[role] : [];
    ids.forEach((playerId, index) => {
      rows.push({
        slot: `${label} ${index + 1}`,
        playerId,
      });
    });
  });

  return rows.map((row) => ({
    ...row,
    player: playersById[row.playerId] || null,
  }));
};

const CareerPreMatch = () => {
  const navigate = useNavigate();
  const { gameState, setGameState, setGameValue } = useGame();
  const pendingConfig = gameState?.match?.pendingConfig || null;
  const isCareerPending = pendingConfig?.meta?.source === "career";

  useEffect(() => {
    setGameValue("mode", "career");
  }, [setGameValue]);

  const playersById = useMemo(() => {
    const map = {};
    const pool = Array.isArray(pendingConfig?.players) ? pendingConfig.players : [];
    pool.forEach((player) => {
      map[player.id] = player;
    });
    return map;
  }, [pendingConfig]);

  const teamAName = pendingConfig?.meta?.teamAName || pendingConfig?.teamA?.name || "Team A";
  const teamBName = pendingConfig?.meta?.teamBName || pendingConfig?.teamB?.name || "Team B";

  const teamsById = useMemo(
    () =>
      createCareerTeamsByIdWithCups({
        playerTeam: gameState?.career?.playerTeam,
        aiTeams: gameState?.career?.aiTeams,
        cups: gameState?.career?.cups,
      }),
    [gameState?.career?.aiTeams, gameState?.career?.cups, gameState?.career?.playerTeam]
  );

  const { teamAColor, teamBColor } = useMemo(() => {
    const homeTeamId = pendingConfig?.meta?.homeTeamId || "";
    const awayTeamId = pendingConfig?.meta?.awayTeamId || "";
    const homeTeam = teamsById[homeTeamId] || null;
    const awayTeam = teamsById[awayTeamId] || null;

    const homeColor =
      (typeof homeTeam?.homeColor === "string" && homeTeam.homeColor) ||
      pendingConfig?.meta?.teamAColor ||
      FALLBACK_HOME_COLOR;
    const awayColor = pickBestContrastColor(
      homeColor,
      [
        awayTeam?.homeColor,
        awayTeam?.awayColor,
        pendingConfig?.meta?.teamBColor,
        pendingConfig?.meta?.teamAColor,
        FALLBACK_AWAY_COLOR,
      ],
      FALLBACK_AWAY_COLOR
    );

    const teamAIsHome =
      normalizeText(pendingConfig?.meta?.teamAName) === normalizeText(pendingConfig?.meta?.homeTeamName) ||
      !pendingConfig?.meta?.homeTeamName;

    return teamAIsHome
      ? { teamAColor: homeColor, teamBColor: awayColor }
      : { teamAColor: awayColor, teamBColor: homeColor };
  }, [pendingConfig, teamsById]);

  const teamALineupRows = useMemo(
    () => toLineupRows(pendingConfig?.teamA, playersById),
    [pendingConfig, playersById]
  );
  const teamBLineupRows = useMemo(
    () => toLineupRows(pendingConfig?.teamB, playersById),
    [pendingConfig, playersById]
  );

  const competitionLabel =
    pendingConfig?.meta?.competitionType === "CUP"
      ? pendingConfig?.meta?.cupCompetition || "Cup"
      : "League";

  const handleKickOff = () => {
    if (!isCareerPending) {
      navigate("/career/calendar", { replace: true });
      return;
    }

    const token = `career-kickoff-${Date.now().toString(36)}`;
    setGameState((previous) => ({
      ...previous,
      match: {
        ...(previous?.match && typeof previous.match === "object" ? previous.match : {}),
        pendingConfig:
          previous?.match?.pendingConfig && typeof previous.match.pendingConfig === "object"
            ? {
                ...previous.match.pendingConfig,
                meta: {
                  ...(previous.match.pendingConfig.meta &&
                  typeof previous.match.pendingConfig.meta === "object"
                    ? previous.match.pendingConfig.meta
                    : {}),
                  // Pre-match resolved colors are the source of truth for the match screen.
                  teamAColor,
                  teamBColor,
                },
              }
            : previous?.match?.pendingConfig || null,
        autoKickOffToken: token,
        activeCareerMatch: {
          ...(previous?.match?.activeCareerMatch &&
          typeof previous.match.activeCareerMatch === "object"
            ? previous.match.activeCareerMatch
            : {}),
          preMatchConfirmedAt: new Date().toISOString(),
        },
      },
    }));
    navigate("/match");
  };

  if (!isCareerPending) {
    return (
      <div className="careerPreMatch">
        <section className="careerPreMatch__panel">
          <h1>Pre-Match</h1>
          <p>No pending career match found.</p>
          <div className="careerPreMatch__actions">
            <Button variant={BUTTON_VARIANT.PRIMARY} to="/career/calendar">
              Back to Calendar
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="careerPreMatch">
      <section className="careerPreMatch__panel">
        <h1>Pre-Match</h1>
        <p>
          {competitionLabel} | Day {Number(pendingConfig?.meta?.dayNumber) || 0}
        </p>

        <div className="careerPreMatch__teamsGrid">
          <section className="careerPreMatch__teamCard">
            <h2>
              <span className="careerPreMatch__teamIcon" style={{ backgroundColor: teamAColor }} />
              {teamAName}
            </h2>
            <div className="careerPreMatch__lineupList">
              {teamALineupRows.map((row) => (
                <div className="careerPreMatch__lineupRow" key={`a-${row.slot}-${row.playerId}`}>
                  <span>{row.slot}</span>
                  <strong>{row.player?.name || "Unknown"}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="careerPreMatch__teamCard">
            <h2>
              <span className="careerPreMatch__teamIcon" style={{ backgroundColor: teamBColor }} />
              {teamBName}
            </h2>
            <div className="careerPreMatch__lineupList">
              {teamBLineupRows.map((row) => (
                <div className="careerPreMatch__lineupRow" key={`b-${row.slot}-${row.playerId}`}>
                  <span>{row.slot}</span>
                  <strong>{row.player?.name || "Unknown"}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="careerPreMatch__actions">
          <Button variant={BUTTON_VARIANT.SECONDARY} to="/career/calendar">
            Back
          </Button>
          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={handleKickOff}>
            Kick Off
          </Button>
        </div>
      </section>
    </div>
  );
};

export default CareerPreMatch;
