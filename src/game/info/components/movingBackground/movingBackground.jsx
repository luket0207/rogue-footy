import { useEffect, useMemo, useRef, useState } from "react";
import "./movingBackground.scss";
import homeBackground from "../../../../assets/images/home_background.png";

/**
 * MovingBackground
 *
 * Props:
 * - imageUrl: string - background image URL
 * - overlayOpacity: number (default 0.5) - black overlay opacity
 * - zoomPercentVisible: number (default 60) - approx percent of image visible (lower = more zoom)
 * - path: "diagonal" | "curve" (default "diagonal") - movement path as the user scrolls
 *
 * Usage:
 * <MovingBackground imageUrl={homeBackground} path="curve">
 *   <YourPage />
 * </MovingBackground>
 */
const MovingBackground = ({
  imageUrl = homeBackground,
  overlayOpacity = 0.5,
  zoomPercentVisible = 60,
  path = "diagonal",
  children,
}) => {
  const rafRef = useRef(null);

  // 0 -> top of page, 1 -> bottom of page
  const [progress, setProgress] = useState(0);

  const zoomScale = useMemo(() => {
    // If ~60% of the image should be visible, scale is ~100/60 = 1.666...
    const safe = Math.max(10, Math.min(100, Number(zoomPercentVisible) || 60));
    return 100 / safe;
  }, [zoomPercentVisible]);

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const next = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      setProgress(next);
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        update();
      });
    };

    const onResize = () => {
      update();
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  // Smoothstep easing: 0..1 -> 0..1, smooth start and end
  const smoothStep = (t) => {
    const x = clamp01(t);
    return x * x * (3 - 2 * x);
  };

  const getBackgroundPosition = (t) => {
    const p = clamp01(t);

    // Straight diagonal fallback
    if (path === "diagonal") {
      return { x: p, y: p };
    }

    // Curved path with stronger arc
    const eased = smoothStep(p);

    const x = eased;
    const y = Math.pow(eased, 0.8); // more aggressive curve

    return { x, y };
  };

  const pos = getBackgroundPosition(progress);

  // Move from 0% 0% (top-left) to 100% 100% (bottom-right)
  const bgPosX = Math.round(pos.x * 100);
  const bgPosY = Math.round(pos.y * 100);

  return (
    <div className="movingBackground">
      <div
        className="movingBackground__bg"
        style={{
          "--mb-image": `url("${imageUrl}")`,
          "--mb-overlay": overlayOpacity,
          "--mb-pos-x": `${bgPosX}%`,
          "--mb-pos-y": `${bgPosY}%`,
          "--mb-size": `${Math.round(zoomScale * 100)}%`,
        }}
        aria-hidden="true"
      />
      <div className="movingBackground__content">{children}</div>
    </div>
  );
};

export default MovingBackground;
