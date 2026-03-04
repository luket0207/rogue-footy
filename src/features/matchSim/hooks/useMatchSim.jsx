import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTimer } from "../../../engine/utils/timer/timer";
import { createKickOffEvent } from "../utils/commentary";
import { CHUNK_MINUTES, EVENT_KIND, MATCH_TOTAL_MINUTES, TEAM_KEY } from "../utils/matchSimTypes";
import { createInitialMatchState, createMatchContext, getHalfForMinute, runNextChunk } from "../utils/simulateMatch";

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
  latestChunkEvents: [],
  currentEvent: null,
  winner: null,
  pauseForGoal: false,
  lastPossession: null,
  lastGoalEvent: null,
  teamSnapshots: null,
  setup: null,
});

const CHUNK_PLAYBACK_MS = 1500;
const BANNER_VISIBLE_MS = 3000;
const GOAL_OVERLAY_MS = 1500;

const getOpposingTeamId = (teamId) => (teamId === TEAM_KEY.A ? TEAM_KEY.B : TEAM_KEY.A);

export const useMatchSim = () => {
  const [matchState, setMatchState] = useState(EMPTY_MATCH_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [goalOverlayEvent, setGoalOverlayEvent] = useState(null);

  const contextRef = useRef(null);
  const timerRef = useRef(null);
  const latestStateRef = useRef(EMPTY_MATCH_STATE);
  const kickoffTeamRef = useRef(TEAM_KEY.A);
  const bannerTimersRef = useRef([]);
  const goalOverlayTimerRef = useRef(null);

  useEffect(() => {
    latestStateRef.current = matchState;
  }, [matchState]);

  const clearTimeoutList = useCallback((timersRef) => {
    timersRef.current.forEach((timerId) => clearTimeout(timerId));
    timersRef.current = [];
  }, []);

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
      clearTimeoutList(bannerTimersRef);
      if (goalOverlayTimerRef.current) clearTimeout(goalOverlayTimerRef.current);
    };
  }, [clearTimeoutList, stopTimer]);

  const showEventSequence = useCallback(
    (events) => {
      if (!Array.isArray(events) || events.length === 0) return;

      clearTimeoutList(bannerTimersRef);
      events.forEach((event, index) => {
        const timeoutId = setTimeout(() => {
          setMatchState((previousState) => {
            const nextState = { ...previousState, currentEvent: event };
            latestStateRef.current = nextState;
            return nextState;
          });
        }, index * BANNER_VISIBLE_MS);
        bannerTimersRef.current.push(timeoutId);
      });

      const clearBannerTimeoutId = setTimeout(() => {
        setMatchState((previousState) => {
          const nextState = { ...previousState, currentEvent: null };
          latestStateRef.current = nextState;
          return nextState;
        });
      }, events.length * BANNER_VISIBLE_MS);
      bannerTimersRef.current.push(clearBannerTimeoutId);
    },
    [clearTimeoutList]
  );

  const triggerGoalOverlay = useCallback((goalEvent) => {
    if (!goalEvent) return;
    if (goalOverlayTimerRef.current) clearTimeout(goalOverlayTimerRef.current);
    setGoalOverlayEvent(goalEvent);
    goalOverlayTimerRef.current = setTimeout(() => {
      setGoalOverlayEvent(null);
      goalOverlayTimerRef.current = null;
    }, GOAL_OVERLAY_MS);
  }, []);

  const initializeMatch = useCallback(
    (config) => {
      stopTimer();
      clearTimeoutList(bannerTimersRef);
      if (goalOverlayTimerRef.current) {
        clearTimeout(goalOverlayTimerRef.current);
        goalOverlayTimerRef.current = null;
      }
      setGoalOverlayEvent(null);

      const context = createMatchContext({
        ...config,
        chunkCount: 30,
      });
      contextRef.current = context;
      kickoffTeamRef.current = context.rng.random() < 0.5 ? TEAM_KEY.A : TEAM_KEY.B;
      const initialState = createInitialMatchState(context, "interactive");
      latestStateRef.current = initialState;
      setMatchState(initialState);
    },
    [clearTimeoutList, stopTimer]
  );

  const appendKickOffEvent = useCallback(
    (teamId) => {
      const context = contextRef.current;
      const state = latestStateRef.current;
      if (!context || state.status === "idle") return;

      const kickoffMinute = Math.min(MATCH_TOTAL_MINUTES, state.chunk * CHUNK_MINUTES + 1);
      const kickoffEvent = createKickOffEvent({
        chunkIndex: state.chunk,
        minute: kickoffMinute,
        half: getHalfForMinute(kickoffMinute),
        teamId,
        setup: context.setup,
        scoreAfter: { a: state.score[TEAM_KEY.A], b: state.score[TEAM_KEY.B] },
        sequence: state.latestChunkEvents.length,
        rng: context.rng,
      });

      setMatchState((previousState) => {
        const nextState = {
          ...previousState,
          log: [...previousState.log, kickoffEvent],
          currentEvent: kickoffEvent,
          latestChunkEvents: [kickoffEvent],
          pauseForGoal: false,
        };
        latestStateRef.current = nextState;
        return nextState;
      });
      showEventSequence([kickoffEvent]);
    },
    [showEventSequence]
  );

  const startSegment = useCallback(
    (targetChunk, livePhase) => {
      const context = contextRef.current;
      const state = latestStateRef.current;
      if (!context) return;

      const duration = targetChunk - state.chunk;
      if (duration <= 0) return;

      stopTimer();

      setMatchState((previousState) => {
        const nextState = { ...previousState, status: "running", phase: livePhase };
        latestStateRef.current = nextState;
        return nextState;
      });

      timerRef.current = createTimer({
        duration,
        frequencyMs: CHUNK_PLAYBACK_MS,
        onTick: () => {
          const previousState = latestStateRef.current;
          const steppedState = runNextChunk({ ...previousState, status: "running" }, context);

          const atTargetChunk = steppedState.chunk >= targetChunk;
          const atFullTime = steppedState.chunk >= context.chunkCount;
          const goalEvent = steppedState.latestChunkEvents.find((event) => event.kind === EVENT_KIND.GOAL) || null;

          let nextPhase = livePhase;
          let nextStatus = "running";

          if (atFullTime) {
            nextStatus = "finished";
            nextPhase = "finished";
          } else if (atTargetChunk) {
            nextStatus = "paused";
            nextPhase = targetChunk < context.chunkCount ? "half_time" : "finished";
            if (targetChunk >= context.chunkCount) nextStatus = "finished";
          }

          const nextState = {
            ...steppedState,
            status: nextStatus,
            phase: nextPhase,
            pauseForGoal: false,
          };

          latestStateRef.current = nextState;
          setMatchState(nextState);
          showEventSequence(steppedState.latestChunkEvents);

          if (goalEvent) {
            triggerGoalOverlay(goalEvent);
          }

          const eventDelay = steppedState.latestChunkEvents.length * BANNER_VISIBLE_MS;
          const nextChunkDelay = Math.max(CHUNK_PLAYBACK_MS, eventDelay);
          if (timerRef.current) {
            timerRef.current.setFrequencyMs(nextChunkDelay);
          }

          if (atTargetChunk || atFullTime) {
            stopTimer();
          }
        },
        onFinish: () => {
          timerRef.current = null;
          setIsPlaying(false);
        },
      });

      timerRef.current.start();
      setIsPlaying(true);
    },
    [showEventSequence, stopTimer, triggerGoalOverlay]
  );

  const kickOff = useCallback(() => {
    const context = contextRef.current;
    const state = latestStateRef.current;
    if (!context) return;
    if (state.status === "running" || state.phase === "finished") return;

    const halfChunk = Math.floor(context.chunkCount / 2);
    let targetChunk = null;

    if (state.phase === "pre_kickoff" || state.phase === "ready") {
      targetChunk = halfChunk;
    } else if (state.phase === "half_time") {
      targetChunk = context.chunkCount;
    } else if (state.phase === "goal_pause" && state.chunk < context.chunkCount) {
      targetChunk = state.chunk < halfChunk ? halfChunk : context.chunkCount;
    } else if (state.status === "paused" && state.chunk < context.chunkCount) {
      targetChunk = state.chunk < halfChunk ? halfChunk : context.chunkCount;
    }

    if (targetChunk == null) return;

    const kickoffTeam = kickoffTeamRef.current;
    appendKickOffEvent(kickoffTeam);
    kickoffTeamRef.current = getOpposingTeamId(kickoffTeam);

    const livePhase = targetChunk <= halfChunk && state.chunk < halfChunk ? "first_half_live" : "second_half_live";
    startSegment(targetChunk, livePhase);
  }, [appendKickOffEvent, startSegment]);

  const resetMatch = useCallback(() => {
    stopTimer();
    clearTimeoutList(bannerTimersRef);
    if (goalOverlayTimerRef.current) {
      clearTimeout(goalOverlayTimerRef.current);
      goalOverlayTimerRef.current = null;
    }
    setGoalOverlayEvent(null);

    if (!contextRef.current) {
      latestStateRef.current = EMPTY_MATCH_STATE;
      setMatchState(EMPTY_MATCH_STATE);
      return;
    }

    kickoffTeamRef.current = contextRef.current.rng.random() < 0.5 ? TEAM_KEY.A : TEAM_KEY.B;
    const initialState = createInitialMatchState(contextRef.current, "interactive");
    latestStateRef.current = initialState;
    setMatchState(initialState);
  }, [clearTimeoutList, stopTimer]);

  const clearMatch = useCallback(() => {
    stopTimer();
    clearTimeoutList(bannerTimersRef);
    contextRef.current = null;
    if (goalOverlayTimerRef.current) {
      clearTimeout(goalOverlayTimerRef.current);
      goalOverlayTimerRef.current = null;
    }
    setGoalOverlayEvent(null);
    latestStateRef.current = EMPTY_MATCH_STATE;
    setMatchState(EMPTY_MATCH_STATE);
  }, [clearTimeoutList, stopTimer]);

  return useMemo(
    () => ({
      matchState,
      isPlaying,
      goalOverlayEvent,
      initializeMatch,
      kickOff,
      resetMatch,
      clearMatch,
    }),
    [clearMatch, goalOverlayEvent, initializeMatch, isPlaying, kickOff, matchState, resetMatch]
  );
};
