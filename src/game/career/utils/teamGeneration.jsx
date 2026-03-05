import { createSeededRng } from "../../../features/matchSim/utils/seededRng";
import { getRequiredAiBaseTierCounts } from "./leagueGeneration";

export const CAREER_AI_TEAM_COUNT = 79;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeName = (value) => String(value || "").trim().toLowerCase();
const normalizeHex = (value) => String(value || "").trim().toLowerCase();
const MIN_HOME_AWAY_CONTRAST = 2.4;
const MIN_PLAYER_CLASH_CONTRAST = 1.45;

const toHex = (value) => value.toString(16).padStart(2, "0");

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

const isDistinctFromColors = (candidateColor, avoidColors, minContrast) => {
  if (!Array.isArray(avoidColors) || avoidColors.length === 0) return true;
  return avoidColors
    .filter(Boolean)
    .every((avoidColor) => getContrastRatio(candidateColor, avoidColor) >= minContrast);
};

const TEAM_PREFIXES = Object.freeze([
  "North",
  "South",
  "East",
  "West",
  "River",
  "Valley",
  "Stone",
  "Iron",
  "Red",
  "Blue",
  "Green",
  "White",
  "Black",
  "Gold",
  "Silver",
  "Crown",
  "Royal",
  "Union",
  "Central",
  "Metro",
  "Lake",
  "Forest",
  "Harbor",
  "Bridge",
  "Hill",
  "Coast",
  "Castle",
  "Oak",
  "Pine",
  "Fox",
  "Wolf",
  "Falcon",
  "Lions",
  "Eagle",
  "Thunder",
  "Steel",
  "Summit",
  "Orbit",
  "Nova",
  "Aurora",
]);

const TEAM_ROOTS = Object.freeze([
  "gate",
  "ford",
  "borough",
  "chester",
  "haven",
  "field",
  "port",
  "bridge",
  "side",
  "view",
  "ton",
  "ham",
  "stead",
  "mont",
  "ridge",
  "point",
  "crest",
  "shore",
  "vale",
  "park",
  "wood",
  "moor",
  "cross",
  "by",
  "hurst",
  "wick",
  "burn",
  "brook",
  "march",
  "cliff",
]);

const TEAM_SUFFIXES = Object.freeze([
  "FC",
  "United",
  "City",
  "Town",
  "Athletic",
  "Rovers",
  "Albion",
  "Wanderers",
  "Sporting",
  "County",
  "SC",
]);

const pick = (items, rng) => items[rng.randomInt(0, items.length - 1)];

const formatPlaceName = (prefix, root) => {
  if (prefix.endsWith("s")) {
    return `${prefix}${root}`;
  }
  return `${prefix}${root}`;
};

const generateBaseTeamName = (rng) => {
  const place = formatPlaceName(pick(TEAM_PREFIXES, rng), pick(TEAM_ROOTS, rng));
  const suffix = pick(TEAM_SUFFIXES, rng);
  return `${place} ${suffix}`.replace(/\s+/g, " ").trim();
};

const createUniqueTeamNames = ({ count, rng, reservedNames = [] }) => {
  const used = new Set(reservedNames.map(normalizeName).filter(Boolean));
  const names = [];
  let attempts = 0;

  while (names.length < count && attempts < count * 80) {
    const candidate = generateBaseTeamName(rng);
    const key = normalizeName(candidate);
    if (!used.has(key)) {
      used.add(key);
      names.push(candidate);
    }
    attempts += 1;
  }

  let fallbackIndex = 1;
  while (names.length < count) {
    const fallback = `Rogue Club ${String(fallbackIndex).padStart(2, "0")}`;
    const key = normalizeName(fallback);
    if (!used.has(key)) {
      used.add(key);
      names.push(fallback);
    }
    fallbackIndex += 1;
  }

  return names;
};

const hslToHex = (hue, saturation, lightness) => {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;

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

  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const createBaseTierSlots = () => {
  const requiredCounts = getRequiredAiBaseTierCounts();
  const slots = [];
  for (let tier = 1; tier <= 10; tier += 1) {
    const count = requiredCounts[tier] || 0;
    for (let index = 0; index < count; index += 1) {
      slots.push(tier);
    }
  }
  return slots;
};

const createKitColors = (rng, teamIndex, { avoidColors = [] } = {}) => {
  const baseHue = (teamIndex * 31 + rng.randomInt(0, 359)) % 360;
  const homeOffsets = [0, 26, -26, 52, -52, 78, -78, 104, -104, 130, -130, 156, -156];

  let homeColor = hslToHex(baseHue, 72, 44);
  for (let index = 0; index < homeOffsets.length; index += 1) {
    const candidate = hslToHex(baseHue + homeOffsets[index], 72, 44);
    if (isDistinctFromColors(candidate, avoidColors, MIN_PLAYER_CLASH_CONTRAST)) {
      homeColor = candidate;
      break;
    }
  }

  const awayOffset = 140 + rng.randomInt(-24, 24);
  const awayOffsets = [0, 24, -24, 48, -48, 72, -72, 96, -96, 120, -120, 150, -150, 180];
  const awayVariations = [
    { saturation: 68, lightness: 58 },
    { saturation: 66, lightness: 64 },
    { saturation: 70, lightness: 52 },
  ];

  let awayColor = hslToHex(baseHue + awayOffset, 68, 58);
  let bestAwayColor = awayColor;
  let bestAwayContrast = getContrastRatio(homeColor, awayColor);

  for (let variationIndex = 0; variationIndex < awayVariations.length; variationIndex += 1) {
    const variation = awayVariations[variationIndex];
    for (let offsetIndex = 0; offsetIndex < awayOffsets.length; offsetIndex += 1) {
      const candidate = hslToHex(
        baseHue + awayOffset + awayOffsets[offsetIndex],
        variation.saturation,
        variation.lightness
      );
      const contrastVsHome = getContrastRatio(homeColor, candidate);
      const distinctFromPlayer = isDistinctFromColors(
        candidate,
        avoidColors,
        MIN_PLAYER_CLASH_CONTRAST
      );
      if (contrastVsHome > bestAwayContrast) {
        bestAwayColor = candidate;
        bestAwayContrast = contrastVsHome;
      }
      if (distinctFromPlayer && contrastVsHome >= MIN_HOME_AWAY_CONTRAST) {
        awayColor = candidate;
        return { homeColor, awayColor };
      }
    }
  }

  awayColor = bestAwayColor;
  return { homeColor, awayColor };
};

const createTeamStrength = (baseTier, rng) => {
  const tierStrengthAnchor = 96 - baseTier * 3;
  const noise = rng.randomInt(-2, 2);
  return clamp(tierStrengthAnchor + noise, 52, 95);
};

export const createCareerAiTeams = ({
  seed = "career-world-seed",
  reservedNames = [],
  avoidColors = [],
} = {}) => {
  const rng = createSeededRng(seed);
  const baseTierSlots = createBaseTierSlots();
  const generatedNames = createUniqueTeamNames({
    count: baseTierSlots.length,
    rng,
    reservedNames,
  });

  return baseTierSlots.map((baseTier, index) => {
    const teamId = `ai_team_${String(index + 1).padStart(3, "0")}`;
    const { homeColor, awayColor } = createKitColors(rng, index, { avoidColors });

    return {
      id: teamId,
      name: generatedNames[index],
      homeColor,
      awayColor,
      baseTier,
      teamStrength: createTeamStrength(baseTier, rng),
    };
  });
};
