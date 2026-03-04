import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import Modal from "./modal";

export const MODAL_BUTTONS = Object.freeze({
  OK: "Ok",
  YES_NO: "YesNo",
  NONE: "None",
  CUSTOM_TEXT: "CustomText",
});

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    content: null,
    buttons: MODAL_BUTTONS.OK,
    customButtonText: "Submit",
    onClick: null,
    onYes: null,
    onNo: null,
  });

  const closeModal = useCallback(() => {
    setModalState((prev) => ({
      ...prev,
      isOpen: false,
      title: "",
      content: null,
      buttons: MODAL_BUTTONS.OK,
      customButtonText: "Submit",
      onClick: null,
      onYes: null,
      onNo: null,
    }));
  }, []);

  const openModal = useCallback(
    ({
      modalTitle = "",
      modalContent = null,
      buttons = MODAL_BUTTONS.OK,
      customButtonText = "Submit",
      onClick = null,
      onYes = null,
      onNo = null,
    } = {}) => {
      setModalState({
        isOpen: true,
        title: modalTitle,
        content: modalContent,
        buttons,
        customButtonText,
        onClick,
        onYes,
        onNo,
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      openModal,
      closeModal,
      isModalOpen: modalState.isOpen,
    }),
    [openModal, closeModal, modalState.isOpen]
  );

  return (
    <ModalContext.Provider value={value}>
      {children}

      <Modal
        isOpen={modalState.isOpen}
        title={modalState.title}
        content={modalState.content}
        buttons={modalState.buttons}
        customButtonText={modalState.customButtonText}
        onClick={modalState.onClick}
        onYes={modalState.onYes}
        onNo={modalState.onNo}
        onClose={closeModal}
      />
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return ctx;
};
