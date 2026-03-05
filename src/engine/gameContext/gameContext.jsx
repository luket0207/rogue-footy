import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  loadGameFromLocalStorage,
  saveGameToLocalStorage,
} from "../utils/saveGame/saveGame";

/*
Usage:

import { GameProvider, useGame } from "@/engine/game/gameContext";

Read / write anywhere:
const { gameState, setGameValue, setGameState } = useGame();

setGameValue("ui.top", "red");
console.log(gameState.ui.top);
*/

const GameContext = createContext(null);

const DEFAULT_GAME_STATE = Object.freeze({
  mode: "sandbox",
  player: {
    health: 100,
    money: 0,
    progress: 0,
  },
  ui: {
    top: "red",
    mid: "green",
    right: "blue",
  },
});

const cloneDefaultGameState = () => ({
  ...DEFAULT_GAME_STATE,
  player: { ...DEFAULT_GAME_STATE.player },
  ui: { ...DEFAULT_GAME_STATE.ui },
});

const normalizeLoadedGameState = (loaded) => {
  if (loaded == null || typeof loaded !== "object") {
    return cloneDefaultGameState();
  }

  const defaults = cloneDefaultGameState();
  return {
    ...defaults,
    ...loaded,
    player: {
      ...defaults.player,
      ...(loaded.player && typeof loaded.player === "object" ? loaded.player : {}),
    },
    ui: {
      ...defaults.ui,
      ...(loaded.ui && typeof loaded.ui === "object" ? loaded.ui : {}),
    },
  };
};

const getInitialGameState = () => {
  try {
    const loaded = loadGameFromLocalStorage();
    return normalizeLoadedGameState(loaded);
  } catch (_error) {
    return cloneDefaultGameState();
  }
};

const setByPath = (obj, path, value) => {
  const keys = path.split(".");
  const next = { ...obj };

  let cursor = next;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (i === keys.length - 1) {
      cursor[key] = value;
    } else {
      const current = cursor[key];
      cursor[key] = typeof current === "object" && current !== null ? { ...current } : {};
      cursor = cursor[key];
    }
  }

  return next;
};

export const GameProvider = ({ children }) => {
  const [gameState, setGameState] = useState(getInitialGameState);
  const autosaveMilestoneRef = useRef("");

  // "POST" a single value by path, eg: setGameValue("player.health", 80)
  const setGameValue = useCallback((path, value) => {
    setGameState((prev) => setByPath(prev, path, value));
  }, []);

  const loadGameState = useCallback((nextState) => {
    if (nextState == null || typeof nextState !== "object") {
      throw new Error("loadGameState: nextState must be an object");
    }
    setGameState(normalizeLoadedGameState(nextState));
  }, []);

  useEffect(() => {
    if (gameState?.mode !== "career") return;

    const status = gameState?.career?.status || "";
    const createdAt = gameState?.career?.createdAt || "";
    const generationCompletedAt = gameState?.career?.generation?.completedAt || "";
    const gameOverAt =
      gameState?.career?.relegationProgress?.gameOverAt ||
      gameState?.career?.gameOver?.at ||
      "";
    const victoryProgress = gameState?.career?.victoryProgress;
    const wonTopLeague = !!(gameState?.career?.wonTopLeague || victoryProgress?.wonTopLeague);
    const wonChampionsCup = !!(
      gameState?.career?.wonChampionsCup || victoryProgress?.wonChampionsCup
    );
    const victoryUpdatedAt =
      victoryProgress?.updatedAt ||
      gameState?.career?.lastSeasonSummary?.resolvedAt ||
      "";

    // Autosave only on major career milestones.
    let milestoneKey = "";
    if (status === "generating" && createdAt) {
      milestoneKey = `career:generating:${createdAt}`;
    } else if ((wonTopLeague || wonChampionsCup) && (victoryUpdatedAt || createdAt)) {
      milestoneKey = `career:victory:${wonTopLeague ? 1 : 0}${wonChampionsCup ? 1 : 0}:${
        victoryUpdatedAt || createdAt
      }`;
    } else if (status === "ready") {
      milestoneKey = `career:ready:${generationCompletedAt || createdAt}`;
    } else if (status === "game_over") {
      milestoneKey = `career:game_over:${gameOverAt || createdAt}`;
    }

    if (!milestoneKey || autosaveMilestoneRef.current === milestoneKey) {
      return;
    }

    saveGameToLocalStorage(gameState);
    autosaveMilestoneRef.current = milestoneKey;
  }, [gameState]);

  const value = useMemo(
    () => ({
      gameState,
      setGameState,
      setGameValue,
      loadGameState,
    }),
    [gameState, setGameValue, loadGameState]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return ctx;
};
