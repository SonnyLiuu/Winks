// /electron/main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

function createWindow() {
  // Create a new browser window
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Load the React build (production build) from the /client folder.
  // In development, you might load from "http://localhost:3000" instead.
  mainWindow.loadURL(
    `file://${path.join(__dirname, "../client/build/index.html")}`
  );
}

app.whenReady().then(() => {
  createWindow();

  // On macOS, recreate a window when the dock icon is clicked and no other windows are open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit the app when all windows are closed (except on macOS).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
