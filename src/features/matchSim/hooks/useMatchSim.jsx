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

const PLAYBACK_SPEED = Object.freeze({
  VERY_FAST: "VERY_FAST",
  FAST: "FAST",
  NORMAL: "NORMAL",
  SLOW: "SLOW",
});

const PLAYBACK_SPEED_MS = Object.freeze({
  [PLAYBACK_SPEED.VERY_FAST]: 300,
  [PLAYBACK_SPEED.FAST]: 1000,
  [PLAYBACK_SPEED.NORMAL]: 2000,
  [PLAYBACK_SPEED.SLOW]: 3000,
});

const GOAL_PAUSE_SLOW_MS = 3000;
const GOAL_PAUSE_FAST_MS = 2000;

const getOpposingTeamId = (teamId) => (teamId === TEAM_KEY.A ? TEAM_KEY.B : TEAM_KEY.A);
const isValidPlaybackSpeed = (speed) => Object.prototype.hasOwnProperty.call(PLAYBACK_SPEED_MS, speed);
const getGoalPauseMs = (speed) => (speed === PLAYBACK_SPEED.SLOW ? GOAL_PAUSE_SLOW_MS : GOAL_PAUSE_FAST_MS);
const getEventVisibleMs = (event, baseSpeedMs, speed) =>
  event?.kind === EVENT_KIND.GOAL ? getGoalPauseMs(speed) : baseSpeedMs;
const getSequenceVisibleMs = (events, speed) => {
  const baseSpeedMs = PLAYBACK_SPEED_MS[speed];
  if (!Array.isArray(events) || events.length === 0) return baseSpeedMs;
  return events.reduce((sum, event) => sum + getEventVisibleMs(event, baseSpeedMs, speed), 0);
};

export const useMatchSim = () => {
  const [matchState, setMatchState] = useState(EMPTY_MATCH_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [goalOverlayEvent, setGoalOverlayEvent] = useState(null);
  const [playbackSpeed, setPlaybackSpeedState] = useState(PLAYBACK_SPEED.NORMAL);

  const contextRef = useRef(null);
  const timerRef = useRef(null);
  const latestStateRef = useRef(EMPTY_MATCH_STATE);
  const kickoffTeamRef = useRef(TEAM_KEY.A);
  const bannerTimersRef = useRef([]);
  const goalOverlayTimerRef = useRef(null);
  const playbackSpeedRef = useRef(PLAYBACK_SPEED.NORMAL);

  useEffect(() => {
    latestStateRef.current = matchState;
  }, [matchState]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

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
      const speed = playbackSpeedRef.current;
      const baseSpeedMs = PLAYBACK_SPEED_MS[playbackSpeedRef.current];

      clearTimeoutList(bannerTimersRef);
      let offsetMs = 0;
      events.forEach((event) => {
        const eventDurationMs = getEventVisibleMs(event, baseSpeedMs, speed);
        const timeoutId = setTimeout(() => {
          setMatchState((previousState) => {
            const nextState = { ...previousState, currentEvent: event };
            latestStateRef.current = nextState;
            return nextState;
          });
        }, offsetMs);
        bannerTimersRef.current.push(timeoutId);
        offsetMs += eventDurationMs;
      });

      const clearBannerTimeoutId = setTimeout(() => {
        setMatchState((previousState) => {
          const nextState = { ...previousState, currentEvent: null };
          latestStateRef.current = nextState;
          return nextState;
        });
      }, offsetMs);
      bannerTimersRef.current.push(clearBannerTimeoutId);
    },
    [clearTimeoutList]
  );

  const triggerGoalOverlay = useCallback((goalEvent) => {
    if (!goalEvent) return;
    const speed = playbackSpeedRef.current;
    const overlayDurationMs = getGoalPauseMs(speed);
    if (goalOverlayTimerRef.current) clearTimeout(goalOverlayTimerRef.current);
    setGoalOverlayEvent(goalEvent);
    goalOverlayTimerRef.current = setTimeout(() => {
      setGoalOverlayEvent(null);
      goalOverlayTimerRef.current = null;
    }, overlayDurationMs);
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
        frequencyMs: getSequenceVisibleMs(state.latestChunkEvents, playbackSpeedRef.current),
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

          const nextChunkDelay = getSequenceVisibleMs(steppedState.latestChunkEvents, playbackSpeedRef.current);
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

  const setPlaybackSpeed = useCallback((nextSpeed) => {
    if (!isValidPlaybackSpeed(nextSpeed)) return;
    setPlaybackSpeedState(nextSpeed);
  }, []);

  return useMemo(
    () => ({
      matchState,
      isPlaying,
      goalOverlayEvent,
      playbackSpeed,
      initializeMatch,
      kickOff,
      resetMatch,
      clearMatch,
      setPlaybackSpeed,
    }),
    [clearMatch, goalOverlayEvent, initializeMatch, isPlaying, kickOff, matchState, playbackSpeed, resetMatch, setPlaybackSpeed]
  );
};
