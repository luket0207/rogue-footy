/**
 * Usage
 *
 * // 1) Standard button (onClick)
 * <Button
 *   variant={BUTTON_VARIANT.PRIMARY}
 *   onClick={() => console.log("clicked")}
 * >
 *   Click me
 * </Button>
 *
 * // 2) Route navigation (renders a Link)
 * <Button
 *   variant={BUTTON_VARIANT.SECONDARY}
 *   to="/help"
 * >
 *   Go to Help
 * </Button>
 *
 * // 3) Disabled
 * <Button
 *   variant={BUTTON_VARIANT.TERTIARY}
 *   disabled={true}
 *   onClick={() => console.log("will not fire")}
 * >
 *   Disabled
 * </Button>
 *
 * // 4) Image button (URL images)
 * <Button
 *   variant={BUTTON_VARIANT.IMAGE}
 *   to="/"
 *   image="/assets/icons/home.png"
 *   hoverImage="/assets/icons/home_hover.png"
 *   width={48}
 *   height={48}
 * />
 *
 * // 5) Image button (React node images)
 * <Button
 *   variant={BUTTON_VARIANT.IMAGE}
 *   onClick={() => console.log("image clicked")}
 *   image={<img src="/assets/icons/play.png" alt="Play" />}
 *   hoverImage={<img src="/assets/icons/play_hover.png" alt="Play" />}
 * />
 */

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./button.scss";

export const BUTTON_VARIANT = Object.freeze({
  PRIMARY: "primary",
  SECONDARY: "secondary",
  TERTIARY: "tertiary",
  IMAGE: "image",
});

const buildClassName = (base, variant, customClass, disabled) => {
  const parts = [base, `${base}--${variant}`];

  if (customClass) parts.push(customClass);
  if (disabled) parts.push(`${base}--disabled`);

  return parts.join(" ");
};

const isReactNode = (value) => React.isValidElement(value);

const renderImageContent = ({ img, altText, width, height }) => {
  if (isReactNode(img)) {
    // If user passed their own React element (e.g. <img /> or <svg />),
    // we do not mutate it. Sizing should be handled by the element itself
    // or via the wrapper's inline style.
    return img;
  }

  // Otherwise treat as URL/string.
  return (
    <img
      src={img}
      alt={altText}
      width={typeof width === "number" ? width : undefined}
      height={typeof height === "number" ? height : undefined}
      draggable="false"
    />
  );
};

const Button = ({
  children,
  onClick,
  to,
  type = "button",
  variant = BUTTON_VARIANT.PRIMARY,
  className = "",
  disabled = false,
  replace = false,
  state,

  // IMAGE variant props
  image,
  hoverImage,
  width,
  height,
  alt = "Button",
}) => {
  const isLink = typeof to === "string" && to.length > 0;
  const isOnClick = typeof onClick === "function";

  const isImageVariant = variant === BUTTON_VARIANT.IMAGE;

  if (isLink && isOnClick) {
    // Guardrail: choose navigation behavior if both are provided, but avoid surprising behavior.
    // eslint-disable-next-line no-console
    console.warn(
      "[Button] Both 'to' and 'onClick' were provided. 'to' will take precedence and the button will render as a Link."
    );
  }

  if (isImageVariant && image == null) {
    throw new Error("[Button] variant=IMAGE requires the 'image' prop (string URL or React element).");
  }

  const btnClassName = buildClassName("btn", variant, className, disabled);

  const wrapperStyle = useMemo(() => {
    if (!isImageVariant) return undefined;

    const style = {};
    if (typeof width === "number") style.width = `${width}px`;
    if (typeof height === "number") style.height = `${height}px`;
    return style;
  }, [isImageVariant, width, height]);

  const [isHovered, setIsHovered] = useState(false);

  const content = (() => {
    if (!isImageVariant) return children || "Button";

    const shouldShowHover = !!hoverImage && isHovered && !disabled;
    const imgToShow = shouldShowHover ? hoverImage : image;

    return renderImageContent({
      img: imgToShow,
      altText: alt,
      width,
      height,
    });
  })();

  const commonHoverHandlers = isImageVariant
    ? {
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        onFocus: () => setIsHovered(true),
        onBlur: () => setIsHovered(false),
      }
    : undefined;

  if (isLink) {
    return (
      <Link
        to={to}
        replace={replace}
        state={state}
        className={btnClassName}
        aria-disabled={disabled ? "true" : "false"}
        style={wrapperStyle}
        {...commonHoverHandlers}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      className={btnClassName}
      type={type}
      onClick={isOnClick && !disabled ? onClick : undefined}
      disabled={disabled}
      style={wrapperStyle}
      {...commonHoverHandlers}
    >
      {content}
    </button>
  );
};

export default Button;
