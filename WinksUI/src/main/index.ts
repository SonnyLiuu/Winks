import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

// --- Consolidated Imports ---
import { createMainWindow, createOverlayWindow } from './windows'
import { createOverlayGetClick } from './overlayGetClick'
import { openOnScreenKeyboard, overlayScroll, saveCursorPosition } from './overlay'
import { connectToDatabase, createUser, verifyUser } from './database'

// --- Global Variables ---
let pythonProcess: ChildProcessWithoutNullStreams | undefined;
// --- NEW: Variables to hold references to our windows ---
let mainWindow: BrowserWindow | null;
let overlayWindow: BrowserWindow | null;


// --- Helper Functions to get File Paths ---

/**
 * Determines the absolute path to the Python script.
 * This is crucial for making the app work in both development and after being packaged.
 */
function getPythonScriptPath(): string {
  if (app.isPackaged) {
    // In a packaged app, scripts are typically in 'resources/app.asar.unpacked/python_app/'
    // This path must match your electron-builder configuration.
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'python_app', 'head_wink_combined.py');
  }
  // In development, go up from 'out/main' to the project root, then into 'python'.
  return path.join(__dirname, '..', '..', '..', 'python', 'head_wink_combined.py');
}

/**
 * Determines the absolute path to the MediaPipe model file.
 */
function getModelPath(): string {
  if (app.isPackaged) {
    // Models are also typically in the unpacked resources directory.
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'models', 'face_landmarker.task');
  }
  // In development, point to the model file in your python source folder.
  return path.join(__dirname, '..', '..', '..', 'python', 'face_landmarker.task');
}


app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // --- Python Script Spawning ---
  const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
  const pythonScriptFullPath = getPythonScriptPath();
  const modelFullPath = getModelPath();

  console.log(`Electron: Resolved Python script path: ${pythonScriptFullPath}`);
  console.log(`Electron: Attempting to spawn Python command: "${pythonExecutable}"`);

  pythonProcess = spawn(pythonExecutable, [pythonScriptFullPath, modelFullPath], {
    stdio: ['pipe', 'pipe', 'pipe'] // Pipe stdin, stdout, and stderr
  });

  // --- Python Process Event Handlers ---
  pythonProcess.stdout.on('data', (data: Buffer) => {
    console.log(`Python stdout: ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data: Buffer) => {
    console.error(`Python stderr: ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code: number) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = undefined;
    if (code !== 0) {
      // app.quit(); 
    }
  });

  pythonProcess.on('error', (err: Error) => {
    console.error(`Failed to start Python process: ${err.message}`);
    pythonProcess = undefined;
    app.quit();
  });


  connectToDatabase()

  // --- Create Windows and Store References ---
  mainWindow = createMainWindow()
  overlayWindow = createOverlayWindow()

  // --- NEW: Add listener to close the overlay when the main window closes ---
  mainWindow.on('close', () => {
    console.log('Main window is closing, also closing overlay window.');
    // Check if the overlay window exists and hasn't already been destroyed
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.close();
    }
  });


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      overlayWindow = createOverlayWindow()

      // Re-attach the close listener to the new main window instance
      if (mainWindow) {
        mainWindow.on('close', () => {
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.close();
            }
        });
      }
    }
  })
})

ipcMain.on('signup-user', async (event, { email, password }) => {
  const result = await createUser(email, password)
  event.reply('signup-response', result)
})

// Handle login request from renderer
ipcMain.on('login-user', async (event, { email, password }) => {
  const result = await verifyUser(email, password)
  event.reply('login-response', result)
})

// --- App Shutdown Handler ---
app.on('window-all-closed', () => {
  // On Windows & Linux, closing all windows quits the app.
  if (process.platform !== 'darwin') {
    app.quit();
  }
  
  // Gracefully terminate the Python process when the app closes.
  if (pythonProcess) {
    console.log('Electron: Sending stop command to Python via stdin...');
    try {
      pythonProcess.stdin.write(JSON.stringify({ type: 'stop' }) + '\n');
      // Give it a moment to close, then force kill if it hasn't.
      setTimeout(() => {
        if (pythonProcess) {
          console.log('Electron: Python process still alive. Sending SIGTERM...');
          pythonProcess.kill('SIGTERM');
        }
      }, 1000);
    } catch (e: any) {
      console.error(`Electron: Error writing to Python stdin during shutdown: ${e.message}`);
      if (pythonProcess) {
        pythonProcess.kill('SIGTERM'); // Force kill on error
      }
    }
  }
});

// ===================================================================
// --- IPC Handlers for Communication with Renderer Windows ---
// ===================================================================

// --- IPC Handlers for Python Backend Settings ---

ipcMain.handle('update-sensitivities', async (_, yaw: number, pitch: number) => {
  if (pythonProcess?.stdin.writable) {
    const command = { type: 'update_sensitivities', yaw, pitch };
    pythonProcess.stdin.write(JSON.stringify(command) + '\n');
    return { success: true };
  }
  return { success: false, error: 'Python process not active.' };
});

ipcMain.handle('update-calibration', async (_, calibrationData: any) => {
  if (pythonProcess?.stdin.writable) {
    const command = { type: 'update_calibration', ...calibrationData };
    pythonProcess.stdin.write(JSON.stringify(command) + '\n');
    return { success: true };
  }
  return { success: false, error: 'Python process not active.' };
});

// --- IPC Handlers for Overlay UI ---

ipcMain.on('get-cursor-position', (_event, arg) => {
  saveCursorPosition(arg)
})

ipcMain.on('move-cursor-and-scroll', (_event, arg) => {
  if (arg === 'up') {
    overlayScroll(false, 1) // Scroll up
  } else if (arg === 'down') {
    overlayScroll(false, -1) // Scroll down
    overlayScroll(false, -1) // Scroll down
  } else if (arg === 'right') {
    overlayScroll(true, -1)
  } else if (arg === 'left') {
    overlayScroll(true, 1)
  }
})

ipcMain.on('overlay-get-click', (_event, arg) => {
  createOverlayGetClick(arg)
})

ipcMain.on('keyboard', () => {
  openOnScreenKeyboard()
})

// --- End IPC Handlers for Overlay UI ---
