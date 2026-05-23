import { app, BrowserWindow, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#0f172a",
    title: "PostureGuard",
    // macOS: inset traffic lights for a cleaner look
    ...(process.platform === "darwin"
      ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 16, y: 20 } }
      : {}),
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  // Grant camera and audio capture permissions to the renderer
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ["camera", "media", "audioCapture", "videoCapture", "microphone"];
    callback(allowed.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ["camera", "media", "audioCapture", "videoCapture", "microphone"];
    return allowed.includes(permission);
  });

  createWindow();

  // macOS: recreate window when dock icon is clicked and no windows are open
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
