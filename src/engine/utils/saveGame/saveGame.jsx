/**
 * Save Game Utilities
 *
 * This module provides a simple save/load system:
 * - Serializes a gameState object to JSON
 * - Encodes JSON to Base64
 * - Downloads Base64 as a .txt file
 * - Loads a .txt file, decodes Base64, parses JSON
 *
 * Usage:
 *
 * import { saveGameToTxt, loadGameFromTxtFile } from "../../engine/utils/saveGame/saveGame";
 *
 * // Save:
 * saveGameToTxt(gameState, { filename: "my-save.txt" });
 *
 * // Load (file from <input type="file" />):
 * const loadedState = await loadGameFromTxtFile(file);
 */

const toBase64 = (str) => {
  // Handles UTF-8 safely
  return btoa(unescape(encodeURIComponent(str)));
};

const fromBase64 = (b64) => {
  // Handles UTF-8 safely
  return decodeURIComponent(escape(atob(b64)));
};

export const encodeGameStateToBase64 = (gameState) => {
  const json = JSON.stringify(gameState);
  return toBase64(json);
};

export const decodeGameStateFromBase64 = (base64String) => {
  const json = fromBase64(base64String.trim());
  return JSON.parse(json);
};

export const downloadTextFile = (text, filename = "savegame.txt") => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
};

export const saveGameToTxt = (gameState, { filename = "savegame.txt" } = {}) => {
  const base64 = encodeGameStateToBase64(gameState);
  downloadTextFile(base64, filename);
};

export const readTextFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));

    reader.readAsText(file);
  });
};

export const loadGameFromTxtFile = async (file) => {
  const base64 = await readTextFile(file);
  return decodeGameStateFromBase64(base64);
};
