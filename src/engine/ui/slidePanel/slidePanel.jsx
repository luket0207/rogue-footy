/**
 * Usage
 *
 * import SlidePanel, { SLIDE_PANEL_EDGE } from "../../engine/ui/slidePanel/slidePanel";
 * import { useState } from "react";
 * import Button, { BUTTON_VARIANT } from "../../engine/ui/button/button";
 *
 * const Example = () => {
 *   const [open, setOpen] = useState(false);
 *
 *   return (
 *     <>
 *       <Button variant={BUTTON_VARIANT.PRIMARY} onClick={() => setOpen(true)}>
 *         Open Panel
 *       </Button>
 *
 *       <SlidePanel
 *         isOpen={open}
 *         onClose={() => setOpen(false)}
 *         edge={SLIDE_PANEL_EDGE.RIGHT}
 *         content={<div>Panel content</div>}
 *       />
 *     </>
 *   );
 * };
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./slidePanel.scss";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

export const SLIDE_PANEL_EDGE = Object.freeze({
  TOP: "top",
  BOTTOM: "bottom",
  LEFT: "left",
  RIGHT: "right",
});

export const SLIDE_PANEL_DEFAULT_EDGE = SLIDE_PANEL_EDGE.RIGHT;

export const SLIDE_PANEL_EDGE_VALUES = Object.freeze([
  SLIDE_PANEL_EDGE.RIGHT,
  SLIDE_PANEL_EDGE.LEFT,
  SLIDE_PANEL_EDGE.TOP,
  SLIDE_PANEL_EDGE.BOTTOM,
]);

// Must match SCSS transition duration
const ANIMATION_MS = 500;

const isEdge = (edge) => SLIDE_PANEL_EDGE_VALUES.includes(edge);

const SlidePanel = ({
  isOpen = false,
  onClose,
  content,
  edge = SLIDE_PANEL_DEFAULT_EDGE,
  height,
  width,
  customClass = "",
}) => {
  const safeEdge = useMemo(
    () => (isEdge(edge) ? edge : SLIDE_PANEL_DEFAULT_EDGE),
    [edge]
  );

  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setVisible(false);

      // Double rAF guarantees closed state is painted before opening
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });

      return undefined;
    }

    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), ANIMATION_MS);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (typeof onClose === "function") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  const defaults = useMemo(() => {
    const isSide =
      safeEdge === SLIDE_PANEL_EDGE.LEFT || safeEdge === SLIDE_PANEL_EDGE.RIGHT;

    return {
      defaultHeight: isSide ? "100vh" : "400px",
      defaultWidth: isSide ? "400px" : "100%",
    };
  }, [safeEdge]);

  const panelStyle = useMemo(() => {
    return {
      "--sp-height": height != null ? `${Number(height)}px` : defaults.defaultHeight,
      "--sp-width": width != null ? `${Number(width)}px` : defaults.defaultWidth,
    };
  }, [height, width, defaults.defaultHeight, defaults.defaultWidth]);

  if (!mounted) return null;

  return createPortal(
    <div className={`slidePanelOverlay${visible ? " is-open" : ""}`} aria-hidden={!visible}>
      <div className="slidePanelOverlay__backdrop" onMouseDown={handleClose} />

      <div
        className={`slidePanel slidePanel--${safeEdge}${visible ? " is-open" : ""}${
          customClass ? ` ${customClass}` : ""
        }`}
        style={panelStyle}
        role="dialog"
        aria-modal="false"
      >
        <div className="slidePanel__header">
          <button
            type="button"
            className="slidePanel__close"
            onClick={handleClose}
            aria-label="Close panel"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="slidePanel__content">{content}</div>
      </div>
    </div>,
    document.body
  );
};

export default SlidePanel;
