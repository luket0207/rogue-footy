import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ModalProvider } from "./engine/ui/modal/modalContext";
import { GameProvider } from "./engine/gameContext/gameContext";
import { ToastProvider } from "./engine/ui/toast/toast";

import App from "./App";
import "./index.scss";

import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-cyan/theme.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <GameProvider>
        <ModalProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ModalProvider>
      </GameProvider>
    </BrowserRouter>
  </React.StrictMode>
);
