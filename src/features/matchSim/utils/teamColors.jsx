import { TEAM_KEY } from "./matchSimTypes";
import { createSeededRng } from "./seededRng";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeHex = (value) => String(value || "").trim().toLowerCase();

const hslToRgb = (h, s, l) => {
  const sat = s / 100;
  const light = l / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const huePrime = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (huePrime < 1) {
    r1 = chroma;
    g1 = x;
  } else if (huePrime < 2) {
    r1 = x;
    g1 = chroma;
  } else if (huePrime < 3) {
    g1 = chroma;
    b1 = x;
  } else if (huePrime < 4) {
    g1 = x;
    b1 = chroma;
  } else if (huePrime < 5) {
    r1 = x;
    b1 = chroma;
  } else {
    r1 = chroma;
    b1 = x;
  }

  const m = light - chroma / 2;
  const toChannel = (value) => Math.round((value + m) * 255);
  return {
    r: toChannel(r1),
    g: toChannel(g1),
    b: toChannel(b1),
  };
};

const toLuminanceChannel = (channel) => {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
};

const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");

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

const rgbToHex = ({ r, g, b }) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const mixRgb = (from, to, amount) => ({
  r: from.r + (to.r - from.r) * amount,
  g: from.g + (to.g - from.g) * amount,
  b: from.b + (to.b - from.b) * amount,
});

const getRelativeLuminance = ({ r, g, b }) =>
  0.2126 * toLuminanceChannel(r) + 0.7152 * toLuminanceChannel(g) + 0.0722 * toLuminanceChannel(b);

const makeHsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;

const createPaletteFromHue = (baseHue, rng) => {
  const primaryHue = baseHue;
  const secondaryHue = (baseHue + rng.randomInt(112, 206)) % 360;

  const primarySat = rng.randomInt(68, 86);
  const primaryLight = rng.randomInt(30, 42);
  const secondarySat = rng.randomInt(72, 90);
  const secondaryLight = rng.randomInt(48, 62);

  const primary = makeHsl(primaryHue, primarySat, primaryLight);
  const secondary = makeHsl(secondaryHue, secondarySat, secondaryLight);
  const border = makeHsl(primaryHue, primarySat, clamp(primaryLight - 8, 18, 40));

  const primaryLuminance = getRelativeLuminance(hslToRgb(primaryHue, primarySat, primaryLight));
  const secondaryLuminance = getRelativeLuminance(hslToRgb(secondaryHue, secondarySat, secondaryLight));
  const averageLuminance = (primaryLuminance + secondaryLuminance) / 2;
  const text = averageLuminance > 0.53 ? "#0f172a" : "#ffffff";

  return {
    primary,
    secondary,
    border,
    text,
  };
};

const createPaletteFromBaseColor = (baseColorHex) => {
  const baseRgb = hexToRgb(baseColorHex);
  if (!baseRgb) return null;

  const luminance = getRelativeLuminance(baseRgb);
  const isDark = luminance < 0.52;
  const mixTo = isDark
    ? { r: 255, g: 255, b: 255 }
    : { r: 15, g: 23, b: 42 };
  const secondary = rgbToHex(mixRgb(baseRgb, mixTo, isDark ? 0.2 : 0.14));
  const border = rgbToHex(mixRgb(baseRgb, mixTo, isDark ? 0.34 : 0.26));
  const text = luminance > 0.56 ? "#0f172a" : "#ffffff";

  return {
    primary: baseColorHex,
    secondary,
    border,
    text,
  };
};

export const createMatchTeamColors = (seedOrConfig) => {
  const options =
    seedOrConfig && typeof seedOrConfig === "object"
      ? seedOrConfig
      : { seed: seedOrConfig };
  const seed = options?.seed;
  const rng = createSeededRng(`${String(seed || "match-seed")}-team-colors`);
  const baseHueA = rng.randomInt(0, 359);
  const baseHueB = (baseHueA + rng.randomInt(125, 235)) % 360;
  const fallbackA = createPaletteFromHue(baseHueA, rng);
  const fallbackB = createPaletteFromHue(baseHueB, rng);

  const explicitA = createPaletteFromBaseColor(options?.teamAColor);
  const explicitB = createPaletteFromBaseColor(options?.teamBColor);

  return {
    [TEAM_KEY.A]: explicitA || fallbackA,
    [TEAM_KEY.B]: explicitB || fallbackB,
  };
};

export const getTeamThemeStyle = (setup, teamId) => {
  if (!setup || !teamId) return null;
  const colors = setup?.[teamId]?.colors;
  if (!colors) return null;

  return {
    "--match-team-primary": colors.primary,
    "--match-team-secondary": colors.secondary,
    "--match-team-border": colors.border,
    "--match-team-text": colors.text,
  };
};
