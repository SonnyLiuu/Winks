import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

// --- Consolidated Imports ---
import { createMainWindow, createOverlayWindow } from './windows';
import { createOverlayGetClick } from './overlayGetClick';
import { 
  openOnScreenKeyboard, 
  overlayScroll, 
  saveCursorPosition, 
  overlayDrag,
  startOverlayProximityWatcher, // Import the watcher controls
  stopOverlayProximityWatcher
} from './overlay';
import { connectToDatabase, createUser, verifyUser } from './database';

// --- Global Variables ---
let pythonProcess: ChildProcessWithoutNullStreams | undefined;
let mainWindow: BrowserWindow | null;
let overlayWindow: BrowserWindow | null;
let isQuitting = false;

// This handles squirrel startup events on Windows for the installer.
if (require('electron-squirrel-startup')) app.quit();


// --- Helper Functions to get File Paths ---
function getPythonScriptPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'head_wink_combined.py');
  }
  return path.join(__dirname, '..', '..', '..', 'python', 'head_wink_combined.py');
}

function getModelPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'face_landmarker.task');
  }
  return path.join(__dirname, '..', '..', '..', 'python', 'face_landmarker.task');
}


app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  // --- Python Script Spawning ---
  const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
  const pythonScriptFullPath = getPythonScriptPath();
  const modelFullPath = getModelPath();

  console.log(`Electron: Spawning Python process at ${pythonScriptFullPath}`);

  pythonProcess = spawn(pythonExecutable, [pythonScriptFullPath, modelFullPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pythonProcess.stdout.on('data', (data: Buffer) => console.log(`Python: ${data.toString().trim()}`));
  pythonProcess.stderr.on('data', (data: Buffer) => console.error(`Python stderr: ${data.toString().trim()}`));
  pythonProcess.on('close', (code: number) => {
    console.log(`Python process exited with code ${code}`);
    if (code !== 0 && !isQuitting) {
      app.quit();
    }
  });
  pythonProcess.on('error', (err: Error) => {
    console.error(`Failed to start Python process: ${err.message}`);
    app.quit();
  });

  connectToDatabase();

  // --- Create Windows and store references ---
  mainWindow = createMainWindow();
  overlayWindow = createOverlayWindow();
  
  // Start the watcher after windows are created
  startOverlayProximityWatcher();

  if (mainWindow) {
    // This ensures that if the user closes the main settings window,
    // the overlay window and the entire app will close too.
    mainWindow.on('close', () => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.close();
      }
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      overlayWindow = createOverlayWindow();
      startOverlayProximityWatcher();
      
      if (mainWindow) {
        mainWindow.on('close', () => {
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.close();
            }
        });
      }
    }
  });
});

// --- App Shutdown Handler ---
app.on('window-all-closed', () => {
  stopOverlayProximityWatcher(); // Stop the timer before quitting
  if (process.platform !== 'darwin') {
    app.quit();
  }
  
  if (pythonProcess) {
    pythonProcess.stdin.write(JSON.stringify({ type: 'stop' }) + '\n');
    setTimeout(() => pythonProcess?.kill('SIGTERM'), 1000);
  }
});

// ===================================================================
// --- IPC Handlers ---
// ===================================================================

// --- Database Handlers ---
ipcMain.on('signup-user', async (event, { email, password }) => {
  const result = await createUser(email, password);
  event.reply('signup-response', result);
});
ipcMain.on('login-user', async (event, { email, password }) => {
  const result = await verifyUser(email, password);
  event.reply('login-response', result);
});

// --- Python Settings Handlers ---
ipcMain.handle('update-sensitivities', async (_, yaw: number, pitch: number) => {
  if (pythonProcess?.stdin.writable) {
    pythonProcess.stdin.write(JSON.stringify({ type: 'update_sensitivities', yaw, pitch }) + '\n');
    return { success: true };
  }
  return { success: false, error: 'Python process not active.' };
});
ipcMain.handle('update-calibration', async (_, calibrationData: any) => {
  if (pythonProcess?.stdin.writable) {
    pythonProcess.stdin.write(JSON.stringify({ type: 'update_calibration', ...calibrationData }) + '\n');
    return { success: true };
  }
  return { success: false, error: 'Python process not active.' };
});

// --- Overlay UI Handlers ---
ipcMain.on('get-cursor-position', (_, coordinateType: string) => {
  saveCursorPosition(coordinateType);
});
ipcMain.on('move-cursor-and-scroll', (_, arg: 'up' | 'down' | 'left' | 'right') => {
    overlayScroll(arg === 'left' || arg === 'right', arg === 'up' || arg === 'left' ? 1 : -1);
});
ipcMain.on('overlay-get-click', (_, arg: string) => {
  createOverlayGetClick(arg);
});
ipcMain.on('keyboard', () => {
  openOnScreenKeyboard();
});
ipcMain.on('overlay-drag', () => {
  overlayDrag();
});
