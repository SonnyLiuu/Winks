import { app, BrowserWindow, ipcMain } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

// Commented out createOverlayWindow import and its uses to temporarily disable the overlay
import { createMainWindow /*, createOverlayWindow */ } from './windows';
// import { createOverlayGetClick } from './overlayGetClick';
// import { overlayScroll, saveCursorPosition } from './overlay';

let pythonProcess: ChildProcessWithoutNullStreams | undefined;

// --- Helper Functions to get Paths (Crucial for Dev vs. Packaged) ---

/**
 * Determines the absolute path to the Python script.
 * Adjust paths based on your electron-builder.yml 'files' and 'extraFiles' configuration
 * and your project's development folder structure.
 */
function getPythonScriptPath(): string {
  if (app.isPackaged) {
    // In a packaged app, python scripts are typically copied to resources/app.asar.unpacked/python_app/
    // This path must match the 'to' path you configure in electron-builder.yml for your Python folder.
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'python_app', 'head_wink_combined_.py');
  }
  // In development, `__dirname` is the directory of the compiled JS file (e.g., out/main).
  // If `__dirname` is S:\WinksGit2\Winks\Winksui\out\main, and python scripts are in S:\WinksGit2\Winks\python
  // then we need to go up three levels (out, Winksui, Winks) and then into 'python'.
  return path.join(__dirname, '..', '..', '..', 'python', 'head_wink_combined.py');
}

/**
 * Determines the absolute path to the MediaPipe model file.
 * Adjust paths based on your electron-builder.yml 'extraFiles' configuration
 * and your project's development folder structure.
 */
function getModelPath(): string {
  if (app.isPackaged) {
    // Model should be unpacked by electron-builder into resources/app.asar.unpacked/models/
    // This path must match the 'to' path you configure in electron-builder.yml for your model file.
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'models', 'face_landmarker.task');
  }
  // In development, adjust this path to where your .task file is relative to this index.ts's compiled location.
  // Assuming model is in S:\WinksGit2\Winks\python\face_landmarker.task
  return path.join(__dirname, '..', '..', '..', 'python', 'face_landmarker.task');
}

// --- Electron App Lifecycle ---

app.whenReady().then(() => {
  // Set App User Model ID for Windows (good practice)
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools in development and optimize for Node.js App
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // --- Python Script Spawning (ONLY ONCE on app.ready) ---
  const pythonExecutable = 'python';
  // Example for macOS/Linux: const pythonExecutable = '/usr/bin/python3';
  // Example for macOS/Linux (Homebrew): const pythonExecutable = '/opt/homebrew/bin/python3.10';


  const pythonScriptFullPath = getPythonScriptPath();
  const modelFullPath = getModelPath();

  // Added console.log to show the exact path being used
  console.log(`Electron: Resolved Python executable path: ${pythonExecutable}`);
  console.log(`Electron: Resolved Python script path: ${pythonScriptFullPath}`);
  console.log(`Electron: Resolved Model path: ${modelFullPath}`);

  // --- DIAGNOSTIC LOGGING FOR SPAWN COMMAND ---
  console.log(`Electron: Attempting to spawn Python command: "${pythonExecutable}" "${pythonScriptFullPath}" "${modelFullPath}"`);
  // ------------------------------------------

  pythonProcess = spawn(pythonExecutable, [pythonScriptFullPath, modelFullPath], {
    stdio: ['pipe', 'pipe', 'pipe'] // Ensure stdin/stdout/stderr are piped
  });

  // In main/index.ts
  pythonProcess.stdout.on('data', (data: Buffer) => {
    // Now we just log the output for debugging, no special handling.
    console.log(`Python stdout: ${data.toString()}`);
});

  // Handle Python script stderr
  pythonProcess.stderr.on('data', (data: Buffer) => {
    console.error(`Python stderr: ${data.toString()}`);
  });

  // Handle Python script close event
  pythonProcess.on('close', (code: number) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = undefined; // Clear the reference
    // Quit Electron app if Python exits unexpectedly (non-zero code)
    if (code !== 0) {
      app.quit();
    }
  });

  // --- Create Windows ---
  // Save a reference to the main window
  createMainWindow();
  // createOverlayWindow(); // Commented out to disable the overlay

  // Handle app activation (macOS specific)
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      // createOverlayWindow(); // Commented out to disable the overlay
    }
  });
});

// --- App Shutdown (window-all-closed) ---
app.on('window-all-closed', () => {
  // Quit app unless on macOS (where apps stay in dock by default)
  if (process.platform !== 'darwin') {
    app.quit();
  }

  // Attempt to gracefully terminate the Python process
  if (pythonProcess) {
    console.log('Electron: Sending stop command to Python via stdin...');
    try {
      // Send a 'stop' command via stdin to Python's listener thread
      pythonProcess.stdin.write(JSON.stringify({ type: 'stop' }) + '\n');

      // Give Python a moment to shut down gracefully
      setTimeout(() => {
        if (pythonProcess && pythonProcess.pid) {
          console.log('Electron: Python process still alive after graceful stop attempt. Sending SIGTERM...');
          try {
            // Force kill if it's still alive (SIGTERM allows cleanup)
            process.kill(pythonProcess.pid, 'SIGTERM');
            console.log(`Electron: Sent SIGTERM to Python process PID ${pythonProcess.pid}`);
          } catch (e: any) {
            console.error(`Electron: Error sending SIGTERM to Python process: ${e.message}`);
          }
        }
      }, 1000); // Wait 1 second before potentially force-killing
    } catch (e: any) {
      console.error(`Electron: Error writing to Python stdin during shutdown: ${e.message}`);
      // If stdin pipe is already closed/broken, attempt direct kill
      if (pythonProcess) {
        console.log('Electron: Python stdin likely closed. Attempting direct kill...');
        pythonProcess.kill();
      }
    } finally {
      pythonProcess = undefined; // Clear reference regardless
    }
  }
});

// --- IPC Handlers for Renderer Communication ---

/**
 * Handles sensitivity updates from the renderer process.
 */
ipcMain.handle('update-sensitivities', async (_event: any, yaw: number, pitch: number) => {
  // Ensure the Python process is running and its stdin pipe is writable
  if (pythonProcess && pythonProcess.stdin && !pythonProcess.stdin.writableEnded) {
    try {
      const command = {
        type: 'update_sensitivities',
        yaw: yaw,
        pitch: pitch
      };
      pythonProcess.stdin.write(JSON.stringify(command) + '\n');
      console.log(`Electron: Sent sensitivity update to Python: yaw=${yaw}, pitch=${pitch}`);
      return { success: true };
    } catch (e: any) {
      console.error(`Electron: Failed to send sensitivity update to Python: ${e.message}`);
      return { success: false, error: e.message };
    }
  } else {
    console.warn('Electron: Python process not running or stdin not writable. Cannot send sensitivity update.');
    return { success: false, error: 'Python process not active.' };
  }
});

/**
 * Handles calibration updates from the renderer process.
 */
ipcMain.handle('update-calibration', async (_event: any, calibrationData: any) => {
  if (pythonProcess && pythonProcess.stdin && !pythonProcess.stdin.writableEnded) {
    try {
      const command = {
        type: 'update_calibration',
        ...calibrationData // Spread the calibration data directly
      };
      pythonProcess.stdin.write(JSON.stringify(command) + '\n');
      console.log(`Electron: Sent calibration update to Python: ${JSON.stringify(calibrationData)}`);
      return { success: true };
    } catch (e: any) {
      console.error(`Electron: Failed to send calibration update to Python: ${e.message}`);
      return { success: false, error: e.message };
    }
  } else {
    console.warn('Electron: Python process not running or stdin not writable. Cannot send calibration update.');
    return { success: false, error: 'Python process not active.' };
  }
});

// --- Existing Overlay IPC Functions (uncomment if still in use) ---
// ipcMain.on('open-overlay-get-click', () => {
//   createOverlayGetClick();
// });

// ipcMain.on('get-cursor-position', () => {
//   saveCursorPosition();
// });

// ipcMain.on('move-cursor-and-scroll', (_event, arg) => {
//   if (arg === 'up') {
//     overlayScroll(false, 1);
//   } else if (arg === 'down') {
//     overlayScroll(false, -1);
//   }
// });
