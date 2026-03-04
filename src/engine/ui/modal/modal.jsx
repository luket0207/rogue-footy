/**
 * Usage
 *
 * import { useModal } from "../../engine/ui/modal/modalContext";
 * import { MODAL_BUTTONS } from "../../engine/ui/modal/modalContext";
 *
 * const Example = () => {
 *   const { openModal } = useModal();
 *
 *   return (
 *     <button
 *       onClick={() =>
 *         openModal({
 *           modalTitle: "Confirm",
 *           modalContent: <div>Are you sure?</div>,
 *           buttons: MODAL_BUTTONS.YES_NO,
 *           onYes: () => console.log("yes"),
 *           onNo: () => console.log("no"),
 *         })
 *       }
 *     >
 *       Open Modal
 *     </button>
 *   );
 * };
 */

import React, { useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import Button, { BUTTON_VARIANT } from "../button/button";
import { MODAL_BUTTONS } from "./modalContext";
import "./modal.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";


const Modal = ({
  isOpen,
  title,
  content,
  buttons = MODAL_BUTTONS.OK,
  customButtonText = "Submit",
  onClick,
  onYes,
  onNo,
  onClose,
}) => {
  const footerConfig = useMemo(() => {
    const safeClose = typeof onClose === "function" ? onClose : () => {};

    const okHandler = typeof onClick === "function" ? onClick : safeClose;
    const yesHandler = typeof onYes === "function" ? onYes : safeClose;
    const noHandler = typeof onNo === "function" ? onNo : safeClose;

    return { okHandler, yesHandler, noHandler, safeClose };
  }, [onClick, onYes, onNo, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") footerConfig.safeClose();
    };

    document.addEventListener("keydown", onKeyDown);

    // Prevent background scroll while modal is open
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, footerConfig]);

  if (!isOpen) return null;

  const modalNode = (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        // Close when clicking the backdrop only (not the modal itself)
        if (e.target === e.currentTarget) footerConfig.safeClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title || "Modal"}>
        <div className="modal__header">
          <div className="modal__title">{title || "Modal"}</div>

          <button type="button" className="modal__close" onClick={footerConfig.safeClose} aria-label="Close modal">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="modal__body">{content || <h2>Modal</h2>}</div>

        {buttons !== MODAL_BUTTONS.NONE && (
          <div className="modal__footer">
            {buttons === MODAL_BUTTONS.YES_NO && (
              <>
                <Button variant={BUTTON_VARIANT.SECONDARY} onClick={footerConfig.noHandler}>
                  No
                </Button>
                <Button variant={BUTTON_VARIANT.PRIMARY} onClick={footerConfig.yesHandler}>
                  Yes
                </Button>
              </>
            )}

            {buttons === MODAL_BUTTONS.OK && (
              <Button variant={BUTTON_VARIANT.PRIMARY} onClick={footerConfig.okHandler}>
                OK
              </Button>
            )}

            {buttons === MODAL_BUTTONS.CUSTOM_TEXT && (
              <Button variant={BUTTON_VARIANT.PRIMARY} onClick={footerConfig.okHandler}>
                {customButtonText || "Submit"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalNode, document.body);
};

export default Modal;
