import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./tooltip.scss";

export const TOOLTIP_TYPE = Object.freeze({
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  INFO: "info",
  PRIMARY: "primary",
  SECONDARY: "secondary",
  TERTIARY: "tertiary",
});

export const TOOLTIP_PLACEMENT = Object.freeze({
  TOP: "top",
  RIGHT: "right",
  BOTTOM: "bottom",
  LEFT: "left",
});

const OFFSET = 10;

const Tooltip = ({
  text,
  icon,
  type = TOOLTIP_TYPE.INFO,
  placement = TOOLTIP_PLACEMENT.TOP,
  className = "",
}) => {
  const id = useId();
  const triggerRef = useRef(null);
  const bubbleRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const openTooltip = useCallback(() => setOpen(true), []);
  const closeTooltip = useCallback(() => setOpen(false), []);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") closeTooltip();
    },
    [closeTooltip]
  );

  useLayoutEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;

    const t = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (placement) {
      case TOOLTIP_PLACEMENT.BOTTOM:
        top = t.bottom + OFFSET;
        left = t.left + t.width / 2 - b.width / 2;
        break;

      case TOOLTIP_PLACEMENT.LEFT:
        top = t.top + t.height / 2 - b.height / 2;
        left = t.left - b.width - OFFSET;
        break;

      case TOOLTIP_PLACEMENT.RIGHT:
        top = t.top + t.height / 2 - b.height / 2;
        left = t.right + OFFSET;
        break;

      case TOOLTIP_PLACEMENT.TOP:
      default:
        top = t.top - b.height - OFFSET;
        left = t.left + t.width / 2 - b.width / 2;
        break;
    }

    setCoords({
      top: Math.round(top + window.scrollY),
      left: Math.round(left + window.scrollX),
    });
  }, [open, placement]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        bubbleRef.current?.contains(e.target)
      ) {
        return;
      }
      closeTooltip();
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, closeTooltip]);

  return (
    <>
      <span
        ref={triggerRef}
        className={`tooltipTrigger ${className}`}
        role="button"
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        onKeyDown={onKeyDown}
      >
        {icon}
      </span>

      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            id={id}
            role="tooltip"
            className={`tooltipBubble tooltipBubble--${type} tooltipBubble--${placement} is-open`}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
          >
            <span className="tooltipBubble__inner">{text}</span>
            <span
              className={`tooltipArrow tooltipArrow--${placement}`}
              aria-hidden="true"
            />
          </span>,
          document.body
        )}
    </>
  );
};

export default Tooltip;
