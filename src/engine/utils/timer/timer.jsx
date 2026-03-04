/**
 * Timer Utility
 *
 * A small, framework-agnostic timer that ticks at a fixed interval.
 *
 * Concepts:
 * - start() begins ticking
 * - stop() pauses without resetting progress
 * - reset() stops and resets tick count
 *
 * Options:
 * - duration: number of ticks to run for (integer >= 1)
 * - frequencyMs: how often to tick (milliseconds, integer >= 1)
 * - onTick: called each tick with (tickIndex, elapsedMs)
 * - onFinish: called once when timer completes with (totalTicks, elapsedMs)
 *
 * Usage:
 *
 * import { createTimer } from "@/engine/utils/timer/timer";
 *
 * const timer = createTimer({
 *   duration: 5,
 *   frequencyMs: 1000,
 *   onTick: (tick) => console.log("tick", tick),
 *   onFinish: () => console.log("done"),
 * });
 *
 * timer.start();
 */

export const createTimer = ({
  duration,
  frequencyMs,
  onTick,
  onFinish,
  autoStart = false,
} = {}) => {
  if (!Number.isFinite(duration) || duration < 1) {
    throw new Error("createTimer: duration must be a number >= 1");
  }
  if (!Number.isFinite(frequencyMs) || frequencyMs < 1) {
    throw new Error("createTimer: frequencyMs must be a number >= 1");
  }

  let intervalId = null;
  let isRunning = false;

  let tickCount = 0;
  let startedAt = null;

  const safeOnTick = typeof onTick === "function" ? onTick : () => {};
  const safeOnFinish = typeof onFinish === "function" ? onFinish : () => {};

  const getElapsedMs = () => {
    if (startedAt == null) return 0;
    return Date.now() - startedAt;
  };

  const stop = () => {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isRunning = false;
  };

  const reset = () => {
    stop();
    tickCount = 0;
    startedAt = null;
  };

  const tick = () => {
    // 1-based ticks: 1..duration
    tickCount += 1;

    safeOnTick(tickCount, getElapsedMs());

    if (tickCount >= duration) {
      stop();
      safeOnFinish(tickCount, getElapsedMs());
    }
  };

  const start = () => {
    if (isRunning) return;

    // First start sets the baseline
    if (startedAt == null) startedAt = Date.now();

    isRunning = true;

    intervalId = setInterval(() => {
      tick();
    }, frequencyMs);
  };

  const setFrequencyMs = (nextFrequencyMs) => {
    if (!Number.isFinite(nextFrequencyMs) || nextFrequencyMs < 1) {
      throw new Error("setFrequencyMs: frequencyMs must be a number >= 1");
    }

    frequencyMs = nextFrequencyMs;

    // If running, restart interval with new frequency
    if (isRunning) {
      stop();
      start();
    }
  };

  const getState = () => ({
    isRunning,
    tickCount,
    duration,
    frequencyMs,
    elapsedMs: getElapsedMs(),
  });

  const api = {
    start,
    stop,
    reset,
    setFrequencyMs,
    getState,
  };

  if (autoStart) start();

  return api;
};
