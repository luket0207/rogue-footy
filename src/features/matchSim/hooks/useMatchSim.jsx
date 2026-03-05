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
  currentMinute: 0,
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
  const pendingMinuteEventsRef = useRef([]);

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
      pendingMinuteEventsRef.current = [];
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
      pendingMinuteEventsRef.current = [];
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

      const kickoffMinute = Math.min(MATCH_TOTAL_MINUTES, state.currentMinute + 1);
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
    (targetMinute, livePhase) => {
      const context = contextRef.current;
      const state = latestStateRef.current;
      if (!context) return;

      const duration = targetMinute - state.currentMinute;
      if (duration <= 0) return;

      stopTimer();

      setMatchState((previousState) => {
        const nextState = { ...previousState, status: "running", phase: livePhase };
        latestStateRef.current = nextState;
        return nextState;
      });

      timerRef.current = createTimer({
        duration,
        frequencyMs: PLAYBACK_SPEED_MS[playbackSpeedRef.current],
        onTick: () => {
          const previousState = latestStateRef.current;
          const nextMinute = Math.min(MATCH_TOTAL_MINUTES, previousState.currentMinute + 1);
          const shouldResolveChunk =
            nextMinute % CHUNK_MINUTES === 1 && previousState.chunk < context.chunkCount;

          const baseMinuteState = {
            ...previousState,
            status: "running",
            phase: livePhase,
            currentMinute: nextMinute,
            latestChunkEvents: [],
          };
          const steppedState = shouldResolveChunk
            ? runNextChunk(baseMinuteState, context)
            : baseMinuteState;

          const newChunkEvents = shouldResolveChunk ? steppedState.latestChunkEvents : [];
          const queuedEvents = [...pendingMinuteEventsRef.current, ...newChunkEvents];
          const dueMinuteEvents = queuedEvents.filter((event) => event.minute === nextMinute);
          pendingMinuteEventsRef.current = queuedEvents.filter((event) => event.minute > nextMinute);

          const dueGoalEvents = dueMinuteEvents.filter((event) => event.kind === EVENT_KIND.GOAL);
          const dueGoalsTimeline = dueGoalEvents.map((goalEvent) => ({
            id: `goal-${goalEvent.id}`,
            minute: goalEvent.minute,
            half: goalEvent.half,
            teamKey: goalEvent.teamId,
            teamName: context.setup[goalEvent.teamId].name,
            scorerId: goalEvent.primaryPlayerId,
            scorerName: context.playersById[goalEvent.primaryPlayerId]?.name || "Unknown",
            scoreA: steppedState.score[TEAM_KEY.A],
            scoreB: steppedState.score[TEAM_KEY.B],
          }));

          const atTargetMinute = nextMinute >= targetMinute;
          const atFullTime = nextMinute >= MATCH_TOTAL_MINUTES || steppedState.chunk >= context.chunkCount;
          const goalEvent = dueGoalEvents[dueGoalEvents.length - 1] || null;

          let nextPhase = livePhase;
          let nextStatus = "running";

          if (atFullTime) {
            nextStatus = "finished";
            nextPhase = "finished";
          } else if (atTargetMinute) {
            nextStatus = "paused";
            nextPhase = targetMinute < MATCH_TOTAL_MINUTES ? "half_time" : "finished";
            if (targetMinute >= MATCH_TOTAL_MINUTES) nextStatus = "finished";
          }

          const nextState = {
            ...steppedState,
            status: nextStatus,
            phase: nextPhase,
            log: [...previousState.log, ...dueMinuteEvents],
            goalsTimeline: [...previousState.goalsTimeline, ...dueGoalsTimeline],
            latestChunkEvents: dueMinuteEvents,
            winner: atFullTime ? steppedState.winner : null,
            pauseForGoal: false,
            lastGoalEvent: goalEvent || previousState.lastGoalEvent,
          };

          latestStateRef.current = nextState;
          setMatchState(nextState);
          if (dueMinuteEvents.length > 0) {
            showEventSequence(dueMinuteEvents);
          }

          if (goalEvent) {
            triggerGoalOverlay(goalEvent);
          }

          const nextChunkDelay = PLAYBACK_SPEED_MS[playbackSpeedRef.current];
          if (timerRef.current) {
            timerRef.current.setFrequencyMs(nextChunkDelay);
          }

          if (atTargetMinute || atFullTime) {
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

    const halfMinute = MATCH_TOTAL_MINUTES / 2;
    let targetMinute = null;

    if (state.phase === "pre_kickoff" || state.phase === "ready") {
      targetMinute = halfMinute;
    } else if (state.phase === "half_time") {
      targetMinute = MATCH_TOTAL_MINUTES;
    } else if (state.status === "paused" && state.currentMinute < MATCH_TOTAL_MINUTES) {
      targetMinute = state.currentMinute < halfMinute ? halfMinute : MATCH_TOTAL_MINUTES;
    }

    if (targetMinute == null) return;

    const kickoffTeam = kickoffTeamRef.current;
    appendKickOffEvent(kickoffTeam);
    kickoffTeamRef.current = getOpposingTeamId(kickoffTeam);

    const livePhase =
      targetMinute <= halfMinute && state.currentMinute < halfMinute ? "first_half_live" : "second_half_live";
    startSegment(targetMinute, livePhase);
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
    pendingMinuteEventsRef.current = [];
    const initialState = createInitialMatchState(contextRef.current, "interactive");
    latestStateRef.current = initialState;
    setMatchState(initialState);
  }, [clearTimeoutList, stopTimer]);

  const clearMatch = useCallback(() => {
    stopTimer();
    clearTimeoutList(bannerTimersRef);
    contextRef.current = null;
    pendingMinuteEventsRef.current = [];
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
