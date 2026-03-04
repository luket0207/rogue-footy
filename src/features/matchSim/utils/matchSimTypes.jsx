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

