import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTimer } from "../../../engine/utils/timer/timer";
import { createInitialMatchState, createMatchContext, runNextChunk } from "../utils/simulateMatch";

const EMPTY_MATCH_STATE = Object.freeze({
  status: "idle",
  phase: "idle",
  mode: null,
  seed: "",
  chunk: 0,
  chunkCount: 0,
  score: { A: 0, B: 0 },
  stats: {
    A: { possessionChunks: 0, shots: 0, totalXg: 0, goals: 0 },
    B: { possessionChunks: 0, shots: 0, totalXg: 0, goals: 0 },
  },
  log: [],
  goalsTimeline: [],
  currentEvent: null,
  winner: null,
  lastPossession: null,
  teamSnapshots: null,
  setup: null,
});

const CHUNK_PLAYBACK_MS = 700;

export const useMatchSim = () => {
  const [matchState, setMatchState] = useState(EMPTY_MATCH_STATE);
  const [isPlaying, setIsPlaying] = useState(false);

  const contextRef = useRef(null);
  const timerRef = useRef(null);
  const latestStateRef = useRef(EMPTY_MATCH_STATE);

  useEffect(() => {
    latestStateRef.current = matchState;
  }, [matchState]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      timerRef.current.stop();
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  const initializeMatch = useCallback((config) => {
    stopTimer();

    const context = createMatchContext({
      ...config,
      chunkCount: 30,
    });
    contextRef.current = context;
    setMatchState(createInitialMatchState(context, "interactive"));
  }, [stopTimer]);

  const kickOff = useCallback(() => {
    const context = contextRef.current;
    const state = latestStateRef.current;
    if (!context) return;
    if (state.status === "running" || state.status === "finished") return;

    const halfChunk = Math.floor(context.chunkCount / 2);
    let targetChunk = null;
    let livePhase = "first_half_live";

    if (state.chunk < halfChunk) {
      targetChunk = halfChunk;
      livePhase = "first_half_live";
    } else if (state.chunk < context.chunkCount) {
      targetChunk = context.chunkCount;
      livePhase = "second_half_live";
    }

    if (targetChunk == null) return;
    const duration = targetChunk - state.chunk;
    if (duration <= 0) return;

    stopTimer();

    setMatchState((previousState) => ({
      ...previousState,
      status: "running",
      phase: livePhase,
    }));

    timerRef.current = createTimer({
      duration,
      frequencyMs: CHUNK_PLAYBACK_MS,
      onTick: () => {
        setMatchState((previousState) => {
          const stepped = runNextChunk(
            {
              ...previousState,
              status: "running",
            },
            context
          );

          const currentEvent = stepped.log[stepped.log.length - 1] || null;
          const atHalfTime = stepped.chunk === halfChunk && targetChunk === halfChunk;
          const atFullTime = stepped.chunk >= context.chunkCount;

          if (atFullTime) {
            return {
              ...stepped,
              status: "finished",
              phase: "finished",
              currentEvent,
            };
          }

          if (atHalfTime) {
            return {
              ...stepped,
              status: "paused",
              phase: "half_time",
              currentEvent,
            };
          }

          return {
            ...stepped,
            status: "running",
            phase: stepped.chunk < halfChunk ? "first_half_live" : "second_half_live",
            currentEvent,
          };
        });
      },
      onFinish: () => {
        timerRef.current = null;
        setIsPlaying(false);
      },
    });

    timerRef.current.start();
    setIsPlaying(true);
  }, [stopTimer]);

  const resetMatch = useCallback(() => {
    stopTimer();
    if (!contextRef.current) {
      setMatchState(EMPTY_MATCH_STATE);
      return;
    }

    setMatchState(createInitialMatchState(contextRef.current, "interactive"));
  }, [stopTimer]);

  const clearMatch = useCallback(() => {
    stopTimer();
    contextRef.current = null;
    setMatchState(EMPTY_MATCH_STATE);
  }, [stopTimer]);

  const api = useMemo(
    () => ({
      matchState,
      isPlaying,
      initializeMatch,
      kickOff,
      resetMatch,
      clearMatch,
    }),
    [clearMatch, initializeMatch, isPlaying, kickOff, matchState, resetMatch]
  );

  return api;
};
