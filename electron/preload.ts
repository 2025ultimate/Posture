import { contextBridge } from "electron";

// Expose a minimal safe API to the renderer process.
// This keeps nodeIntegration off while allowing the renderer
// to detect it's running inside Electron if needed.
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
});
