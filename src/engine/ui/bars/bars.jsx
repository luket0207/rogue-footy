/**
 * Usage
 *
 * // Unsegmented (default)
 * <Bars current={42} />
 *
 * // Custom scale
 * <Bars min={0} max={500} current={275} />
 *
 * // Segmented
 * <Bars min={0} max={10} current={7} segments={10} />
 */

import React, { useMemo } from "react";
import "./bars.scss";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const Bars = ({ min = 0, max = 100, current, segments }) => {
  const safeMin = toNumber(min, 0);
  const safeMax = toNumber(max, 100);

  const rawCurrent = toNumber(current, safeMin);
  const lo = Math.min(safeMin, safeMax);
  const hi = Math.max(safeMin, safeMax);
  const safeCurrent = clamp(rawCurrent, lo, hi);

  const range = hi - lo;

  const percent = useMemo(() => {
    if (range <= 0) return 0;
    return ((safeCurrent - lo) / range) * 100;
  }, [safeCurrent, lo, range]);

  const safeSegments = useMemo(() => {
    const s = segments == null ? null : toNumber(segments, null);
    if (s == null) return null;
    const clamped = Math.floor(clamp(s, 1, 200));
    return clamped;
  }, [segments]);

  const isSegmented = safeSegments != null;

  return (
    <div
      className={`bars${isSegmented ? " bars--segmented" : ""}`}
      style={{
        "--bars-fill": `${percent}%`,
        "--bars-segments": isSegmented ? String(safeSegments) : "0",
      }}
      role="progressbar"
      aria-valuemin={lo}
      aria-valuemax={hi}
      aria-valuenow={safeCurrent}
    >
      <div className="bars__track">
        <div className="bars__fill" />
        {isSegmented ? <div className="bars__dividers" aria-hidden="true" /> : null}
      </div>

      <div className="bars__meta">
        <div className="bars__value">
          {safeCurrent}
          <span className="bars__range">
            {" "}
            / {hi}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Bars;
