export const POSITION = Object.freeze({
  GK: "GK",
  DEF: "DEF",
  MID: "MID",
  FWR: "FWR",
});

export const OUTFIELD_POSITIONS = Object.freeze([POSITION.DEF, POSITION.MID, POSITION.FWR]);

export const FORMATIONS = Object.freeze({
  "1-2-2": Object.freeze({
    [POSITION.DEF]: 1,
    [POSITION.MID]: 2,
    [POSITION.FWR]: 2,
  }),
  "2-2-1": Object.freeze({
    [POSITION.DEF]: 2,
    [POSITION.MID]: 2,
    [POSITION.FWR]: 1,
  }),
  "2-1-2": Object.freeze({
    [POSITION.DEF]: 2,
    [POSITION.MID]: 1,
    [POSITION.FWR]: 2,
  }),
  "1-3-1": Object.freeze({
    [POSITION.DEF]: 1,
    [POSITION.MID]: 3,
    [POSITION.FWR]: 1,
  }),
});

export const FORMATION_KEYS = Object.freeze(Object.keys(FORMATIONS));

export const ATTACKING_TACTIC = Object.freeze({
  POSSESSION: "POSSESSION",
  DIRECT: "DIRECT",
  COUNTER: "COUNTER",
});

export const DEFENSIVE_TACTIC = Object.freeze({
  HIGH_PRESS: "HIGH_PRESS",
  MID_BLOCK: "MID_BLOCK",
  LOW_BLOCK: "LOW_BLOCK",
});

export const ATTACKING_TACTIC_OPTIONS = Object.freeze(Object.values(ATTACKING_TACTIC));
export const DEFENSIVE_TACTIC_OPTIONS = Object.freeze(Object.values(DEFENSIVE_TACTIC));

export const TEAM_KEY = Object.freeze({
  A: "A",
  B: "B",
});

export const DEFAULT_CHUNK_COUNT = 30;
export const CHUNK_MINUTES = 2;
export const MATCH_TOTAL_MINUTES = 60;

export const MATCH_HALF = Object.freeze({
  H1: "H1",
  H2: "H2",
});

export const EVENT_KIND = Object.freeze({
  POSSESSION_SWING: "POSSESSION_SWING",
  CONTROLLED_PHASE: "CONTROLLED_PHASE",
  BAD_TOUCH: "BAD_TOUCH",
  TURNOVER: "TURNOVER",
  INTERCEPTION: "INTERCEPTION",
  TACKLE_WON: "TACKLE_WON",
  FOUL_WON: "FOUL_WON",
  FREE_KICK: "FREE_KICK",
  CORNER_WON: "CORNER_WON",
  CORNER_TAKEN: "CORNER_TAKEN",
  THROW_IN: "THROW_IN",
  BUILD_UP: "BUILD_UP",
  COUNTER_START: "COUNTER_START",
  SHOT: "SHOT",
  SHOT_BLOCKED: "SHOT_BLOCKED",
  SHOT_SAVED: "SHOT_SAVED",
  SHOT_WIDE: "SHOT_WIDE",
  GOAL: "GOAL",
  KICK_OFF: "KICK_OFF",
});

export const EVENT_OUTCOME = Object.freeze({
  SUCCESS: "success",
  FAIL: "fail",
  GOAL: "goal",
  SAVED: "saved",
  BLOCKED: "blocked",
  WIDE: "wide",
});

