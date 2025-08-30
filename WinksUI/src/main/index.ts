import { app, BrowserWindow, ipcMain, shell, session } from 'electron'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { createMainWindow, createOverlayWindow } from './windows'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createOverlayGetClick } from './overlayGetClick'
import { scanRegistry } from './OSProgramScanning'
import { autoUpdater } from 'electron-updater'
import * as path from 'node:path'
import { JSDOM } from 'jsdom'
import fs from 'node:fs'
import 'dotenv/config'


// --- Consolidated Imports ---
import {
  openOnScreenKeyboard,
  overlayScroll,
  saveCursorPosition,
  startOverlayProximityWatcher, // Import the watcher controls
  stopOverlayProximityWatcher
} from './overlay'
import { connectToDatabase, createUser, verifyUser } from './database'

// Debugging
const DEBUG = process.env.WINKS_DEBUG === '1'; // set to "1" only when you want logs
const dlog = (...a: any[]) => { if (DEBUG) console.log(...a) }
const derr = (...a: any[]) => { if (DEBUG) console.error(...a) }

// --- Global Variables ---
let pythonProcess: ChildProcessWithoutNullStreams | undefined
let mainWindow: BrowserWindow | null
let overlayWindow: BrowserWindow | null
let isQuitting = false

// --- Helper Functions to get File Paths ---
function resolveExisting(...candidates: string[]): string {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return candidates[0] // fallback (even if missing) so errors/logs show what we tried
}

function getPythonScriptPath(): string {
  if (!app.isPackaged) {
    // Support either layout:
    // - python folder at repo root: Winks/python/...
    // - python folder inside WinksUI: Winks/WinksUI/python/...
    return resolveExisting(
      path.join(process.cwd(), '..', 'python', 'head_wink_combined.py'),
      path.join(process.cwd(), 'python', 'head_wink_combined.py')
    )
  }
  return path.join(process.resourcesPath, 'python', 'head_wink_combined.py')
}

function getModelPath(): string {
  if (!app.isPackaged) {
    return resolveExisting(
      path.join(process.cwd(), '..', 'python', 'face_landmarker.task'),
      path.join(process.cwd(), 'python', 'face_landmarker.task')
    )
  }
  return path.join(process.resourcesPath, 'python', 'face_landmarker.task')
}

// region app.whenReady
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.winks.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  // --- Python Script Spawning ---
  function getPythonExecutablePath(): string {
    if (!app.isPackaged) {
      // 1) explicit override via .env
      const envPy = process.env.DEV_PYTHON
      if (envPy && fs.existsSync(envPy)) return envPy
  
      // 2) common local dev runtimes
      const guesses = [
        // venv at repo root: Winks/venv
        path.join(process.cwd(), '..', 'venv', 'Scripts', 'python.exe'),
        path.join(process.cwd(), '..', 'venv', 'bin', 'python3'),
        // python_runtime checked into WinksUI/python_runtime
        path.join(process.cwd(), 'python_runtime', 'python.exe'),
        path.join(process.cwd(), 'python_runtime', 'bin', 'python3')
      ]
      const found = guesses.find(fs.existsSync)
      if (found) return found
  
      // 3) PATH fallback
      return process.platform === 'win32' ? 'python' : 'python3'
    }
  
    // packaged: bundled runtime in resources
    return process.platform === 'win32'
      ? path.join(process.resourcesPath, 'python_runtime', 'python.exe')
      : path.join(process.resourcesPath, 'python_runtime', 'bin', 'python3')
  }
  
  const exe = getPythonExecutablePath()
  const script = getPythonScriptPath()
  const model = getModelPath()
  
  pythonProcess = spawn(exe, [script, model], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env } // keep PATH/venv vars
  })

  // stdout/stderr (only when DEBUG)
  if (DEBUG) {
    pythonProcess.stdout.on('data', (data: Buffer) => {
      console.log(`Python: ${data.toString().trim()}`)
    })
    pythonProcess.stderr.on('data', (data: Buffer) => {
      console.error(`Python stderr: ${data.toString().trim()}`)
    })
  }

  pythonProcess.on('close', (code: number) => {
    if (code !== 0 && !isQuitting) {
      mainWindow?.webContents.send('python:exit', code)
      app.quit()
    }
  })
  pythonProcess.on('error', (_err: Error) => {
    mainWindow?.webContents.send('python:error')
    app.quit()
  })

  connectToDatabase()

  // --- Create Windows and store references ---
  mainWindow = createMainWindow()
  overlayWindow = createOverlayWindow()

  // Start the watcher after windows are created
  startOverlayProximityWatcher()

  // ---- Auto Update wiring ----
  if (app.isPackaged) {
    autoUpdater.logger = null;        // <-- turns off electron-updater logging
    autoUpdater.autoDownload = true;
  
    // Send status to renderer (keeps your UI events, no console spam)
    autoUpdater.on('checking-for-update', () =>
      mainWindow?.webContents.send('update:status', 'checking')
    )
    autoUpdater.on('update-available', (info) =>
      mainWindow?.webContents.send('update:status', 'available', info)
    )
    autoUpdater.on('update-not-available', () =>
      mainWindow?.webContents.send('update:status', 'none')
    )
    autoUpdater.on('download-progress', (p) =>
      mainWindow?.webContents.send('update:progress', p)
    )
    autoUpdater.on('update-downloaded', () =>
      mainWindow?.webContents.send('update:status', 'ready')
    )
    autoUpdater.on('error', (err) =>
      mainWindow?.webContents.send('update:status', 'error', String(err))
    )
  
    // Kick off a check now (only in prod)
    autoUpdater.checkForUpdatesAndNotify()
  }
  
  if (mainWindow) {
    // This ensures that if the user closes the main settings window,
    // the overlay window and the entire app will close too.
    mainWindow.on('close', () => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.close()
      }
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      overlayWindow = createOverlayWindow()
      startOverlayProximityWatcher()

      if (mainWindow) {
        mainWindow.on('close', () => {
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.close()
          }
        })
      }
    }
  })
})

// --- App Shutdown Handler ---
app.on('window-all-closed', () => {
  stopOverlayProximityWatcher()
  if (process.platform !== 'darwin') {
    if (pythonProcess?.stdin?.writable) {
      pythonProcess.stdin.write(JSON.stringify({ type: 'stop' }) + '\n')
    }
    setTimeout(() => pythonProcess?.kill('SIGTERM'), 1000)
    app.quit()
  }
})

//region website adding
ipcMain.on('fetch-website-info', async (event, url) => {
  let fullUrl = url
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = `https://${fullUrl}`
  }

  try {
    // Add a standard User-Agent header to the request
    const response = await session.defaultSession.fetch(fullUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      }
    })

    const html = await response.text()
    const dom = new JSDOM(html)
    const doc = dom.window.document

    const title = doc.querySelector('title')?.textContent || ''

    const iconSelectors = [
      "link[rel='apple-touch-icon']",
      "link[rel='icon']",
      "link[rel='shortcut icon']"
    ]

    let bestIcon = ''
    for (const selector of iconSelectors) {
      const iconHref = doc.querySelector(selector)?.getAttribute('href')
      if (iconHref) {
        bestIcon = iconHref
        break
      }
    }

    if (bestIcon) {
      bestIcon = new URL(bestIcon, fullUrl).href
    } else {
      bestIcon = `https://www.google.com/s2/favicons?sz=64&domain_url=${fullUrl}`
    }

    event.sender.send('website-info-reply', { name: title, icon: bestIcon })
  } catch (_error) {
    event.sender.send('website-info-reply', null)
  }
})

interface LibraryItem {
  id: number
  name: string
  icon: string
  path: string
  type: 'program' | 'website'
}

ipcMain.on('add-website', (_event, websiteData) => {
  const libraryFilePath = getLibraryFilePath()
  try {
    let library = []
    if (fs.existsSync(libraryFilePath)) {
      library = JSON.parse(fs.readFileSync(libraryFilePath, 'utf-8'))
    }

    const alreadyExists = library.some((item: LibraryItem) => item.path === websiteData.url)
    if (alreadyExists) {
      return
    }

    const newWebsite = {
      id: Date.now(),
      type: 'website',
      name: websiteData.name,
      path: websiteData.url,
      icon: websiteData.icon
    }

    const updatedLibrary = [...library, newWebsite]
    fs.writeFileSync(libraryFilePath, JSON.stringify(updatedLibrary, null, 2))
  } catch (error) {
    derr('Failed to add website:', error)
  }
})

ipcMain.on('launch-website', async (_event, url) => {
  let fullUrl = url
  // Check if the URL has a protocol, if not, prepend https://
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = `https://${fullUrl}`
  }

  try {
    // shell.openExternal is the safe and correct way to open web links
    await shell.openExternal(fullUrl)
  } catch (e) {
    derr('Error launching website:', e)
  }
})

//endregion website adding

//region program adding

const getLibraryFilePath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'library.json')
}

// Listener for adding new programs to the library
ipcMain.on('add-programs', (_event, programsToAdd: LibraryItem[]) => {
  const libraryFilePath = getLibraryFilePath()

  try {
    let existingLibrary = []
    if (fs.existsSync(libraryFilePath)) {
      try {
        existingLibrary = JSON.parse(fs.readFileSync(libraryFilePath, 'utf-8'))
      } catch {
        derr('Could not parse library.json, starting fresh.')
        existingLibrary = []
      }
    }

    // 1. Create a Set of all existing program paths for a quick lookup.
    const existingPaths = new Set(existingLibrary.map((p: LibraryItem) => p.path))

    // 2. Filter the incoming programs to keep only the ones not already in the library.
    const newPrograms = programsToAdd.filter((program) => !existingPaths.has(program.path))

    if (newPrograms.length === 0) {
      return
    }

    // 3. Combine the old library with the new, unique programs.
    const updatedLibrary = [...existingLibrary, ...newPrograms]

    // 4. Write the updated library back to the file.
    fs.writeFileSync(libraryFilePath, JSON.stringify(updatedLibrary, null, 2))
  } catch (error) {
    derr('Failed to save library:', error)
  }
})

// Listener for fetching the current library
ipcMain.on('get-library', (event) => {
  const libraryFilePath = getLibraryFilePath()
  let library = []
  if (fs.existsSync(libraryFilePath)) {
    try {
      library = JSON.parse(fs.readFileSync(libraryFilePath, 'utf-8'))
    } catch (error) {
      derr('Failed to read or parse library file:', error)
      library = [] // Reset to empty on error
    }
  }
  // Send the library data back to the window that requested it
  event.sender.send('library-updated', library)
})

// Listener to launch a program from its path
ipcMain.on('launch-program', async (_event, programPath) => {
  try {
    // shell.openPath is the safe way to open executables, files, or URLs
    const error = await shell.openPath(programPath)
    if (error) {
      derr(`Failed to launch program: ${error}`)
    }
  } catch (e) {
    derr('Error launching program:', e)
  }
})

let isScanning = false
ipcMain.on('scan-for-programs', async (event) => {
  if (isScanning) {
    dlog('Scan request ignored, another scan is already in progress.')
    return
  }
  isScanning = true

  try {
    // Replace mock data with a call to the new registry scan function
    await scanRegistry(event)
  } catch (error) {
    derr('An error occurred during the program scan:', error)
  } finally {
    // Once the scan is complete, send the completion event and reset the flag
    event.sender.send('scan-complete')
    isScanning = false
  }
})

ipcMain.on('remove-programs', (_event, programIdsToRemove: number[]) => {
  const libraryFilePath = getLibraryFilePath()

  if (!fs.existsSync(libraryFilePath)) {
    return
  }

  try {
    const library = JSON.parse(fs.readFileSync(libraryFilePath, 'utf-8'))

    // Filter the library, keeping only the programs whose ID is NOT in the deletion list
    const updatedLibrary = library.filter((program) => !programIdsToRemove.includes(program.id))

    // Write the new, smaller library back to the file
    fs.writeFileSync(libraryFilePath, JSON.stringify(updatedLibrary, null, 2))
  } catch (error) {
    derr('Failed to removed programs from library:', error)
  }
})

//endregion program adding



// ===================================================================
// region IPC Handlers
// ===================================================================

// --- Database Handlers ---
ipcMain.on('signup-user', async (event, { email, password }) => {
  const result = await createUser(email, password)
  event.reply('signup-response', result)
})
ipcMain.on('login-user', async (event, { email, password }) => {
  const result = await verifyUser(email, password)
  event.reply('login-response', result)
})

// --- Auto-update IPC Handlers ---
ipcMain.handle('update:check', () => autoUpdater.checkForUpdatesAndNotify())
ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall()
  return { ok: true }
})

// --- Python Settings Handlers ---
ipcMain.handle('update-sensitivities', async (_, yaw: number, pitch: number) => {
  if (pythonProcess?.stdin.writable) {
    pythonProcess.stdin.write(JSON.stringify({ type: 'update_sensitivities', yaw, pitch }) + '\n')
    return { success: true }
  }
  return { success: false, error: 'Python process not active.' }
})
ipcMain.handle('update-calibration', async (_, calibrationData: any) => {
  if (pythonProcess?.stdin.writable) {
    pythonProcess.stdin.write(
      JSON.stringify({ type: 'update_calibration', ...calibrationData }) + '\n'
    )
    return { success: true }
  }
  return { success: false, error: 'Python process not active.' }
})

// Overlay UI Handlers
ipcMain.on('get-cursor-position', (_, coordinateType: string) => {
  saveCursorPosition(coordinateType)
})
ipcMain.on('move-cursor-and-scroll', (_, arg: 'up' | 'down' | 'left' | 'right') => {
  overlayScroll(arg === 'left' || arg === 'right', arg === 'up' || arg === 'left' ? 1 : -1)
})
ipcMain.on('overlay-get-click', (_, arg: string) => {
  createOverlayGetClick(arg)
})
ipcMain.on('keyboard', () => {
  openOnScreenKeyboard()
})
