import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import fs from 'fs'
import { createMainWindow, createOverlayWindow } from './windows'
import { createOverlayGetClick } from './overlayGetClick'
import { scanRegistry } from './OSProgramScanning'
import { session } from 'electron'
import { JSDOM } from 'jsdom'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import * as path from 'path'

// --- Consolidated Imports ---
import {
  openOnScreenKeyboard,
  overlayScroll,
  saveCursorPosition,
  startOverlayProximityWatcher, // Import the watcher controls
  stopOverlayProximityWatcher
} from './overlay'
import { connectToDatabase, createUser, verifyUser } from './database'

// --- Global Variables ---
let pythonProcess: ChildProcessWithoutNullStreams | undefined
let mainWindow: BrowserWindow | null
let overlayWindow: BrowserWindow | null
let isQuitting = false

// This handles squirrel startup events on Windows for the installer.
if (require('electron-squirrel-startup')) app.quit()

// --- Helper Functions to get File Paths ---
function getPythonScriptPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'head_wink_combined.py')
  }
  return path.join(__dirname, '..', '..', '..', 'python', 'head_wink_combined.py')
}

function getModelPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'face_landmarker.task')
  }
  return path.join(__dirname, '..', '..', '..', 'python', 'face_landmarker.task')
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  // --- Python Script Spawning ---
  function getPythonExecutablePath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'python_runtime', 'python.exe')
    }

    const devRuntimeFolder = path.join(__dirname, '..', '..', 'python_runtime')

    if (fs.existsSync(devRuntimeFolder)) {
      return path.join(devRuntimeFolder, 'python.exe')
    }

    return process.platform === 'win32' ? 'python' : 'python3'
  }
  const pythonScriptFullPath = getPythonScriptPath()
  const modelFullPath = getModelPath()

  console.log(`Electron: Spawning Python process at ${pythonScriptFullPath}`)

  pythonProcess = spawn(getPythonExecutablePath(), [pythonScriptFullPath, modelFullPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  pythonProcess.stdout.on('data', (data: Buffer) =>
    console.log(`Python: ${data.toString().trim()}`)
  )
  pythonProcess.stderr.on('data', (data: Buffer) =>
    console.error(`Python stderr: ${data.toString().trim()}`)
  )
  pythonProcess.on('close', (code: number) => {
    console.log(`Python process exited with code ${code}`)
    if (code !== 0 && !isQuitting) {
      app.quit()
    }
  })
  pythonProcess.on('error', (err: Error) => {
    console.error(`Failed to start Python process: ${err.message}`)
    app.quit()
  })

  connectToDatabase()

  // --- Create Windows and store references ---
  mainWindow = createMainWindow()
  overlayWindow = createOverlayWindow()

  // Start the watcher after windows are created
  startOverlayProximityWatcher()

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
  stopOverlayProximityWatcher() // Stop the timer before quitting
  if (process.platform !== 'darwin') {
    app.quit()
  }

  if (pythonProcess) {
    pythonProcess.stdin.write(JSON.stringify({ type: 'stop' }) + '\n')
    setTimeout(() => pythonProcess?.kill('SIGTERM'), 1000)
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
      // FIX: Corrected the template literal syntax
      bestIcon = `https://www.google.com/s2/favicons?sz=64&domain_url=${fullUrl}`
    }

    console.log(bestIcon)
    event.sender.send('website-info-reply', { name: title, icon: bestIcon })
  } catch (error) {
    console.error('Failed to fetch website info:', error)
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
      console.log('Website already exists in library.')
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
    console.log('Website added successfully.')
  } catch (error) {
    console.error('Failed to add website:', error)
  }
})

ipcMain.on('launch-website', async (_event, url) => {
  let fullUrl = url
  // Check if the URL has a protocol, if not, prepend https://
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = `https://${fullUrl}`
  }

  console.log(`Attempting to launch website: ${fullUrl}`)
  try {
    // shell.openExternal is the safe and correct way to open web links
    await shell.openExternal(fullUrl)
  } catch (e) {
    console.error('Error launching website:', e)
  }
})

//endregion website adding

//region program adding

const getLibraryFilePath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'library.json')
}

// Listener for adding new programs to the library
ipcMain.on('add-programs', (_event, programsToAdd) => {
  const libraryFilePath = getLibraryFilePath()
  console.log(`Received request to add ${programsToAdd.length} programs.`)

  try {
    let existingLibrary = []
    if (fs.existsSync(libraryFilePath)) {
      try {
        existingLibrary = JSON.parse(fs.readFileSync(libraryFilePath, 'utf-8'))
      } catch {
        console.error('Could not parse library.json, starting fresh.')
        existingLibrary = []
      }
    }

    // 1. Create a Set of all existing program paths for a quick lookup.
    const existingPaths = new Set(existingLibrary.map((p: LibraryItem) => p.path))

    // 2. Filter the incoming programs to keep only the ones not already in the library.
    const newPrograms = programsToAdd.filter((program) => !existingPaths.has(program.path))

    if (newPrograms.length === 0) {
      console.log('No new programs to add. All selected programs already exist in the library.')
      return
    }

    console.log(`Adding ${newPrograms.length} new unique programs.`)

    // 3. Combine the old library with the new, unique programs.
    const updatedLibrary = [...existingLibrary, ...newPrograms]

    // 4. Write the updated library back to the file.
    fs.writeFileSync(libraryFilePath, JSON.stringify(updatedLibrary, null, 2))
    console.log('Library saved successfully with new programs.')
  } catch (error) {
    console.error('Failed to save library:', error)
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
      console.error('Failed to read or parse library file:', error)
      library = [] // Reset to empty on error
    }
  }
  // Send the library data back to the window that requested it
  event.sender.send('library-updated', library)
})

// Listener to launch a program from its path
ipcMain.on('launch-program', async (_event, programPath) => {
  console.log(`Attempting to launch program at: ${programPath}`)
  try {
    // shell.openPath is the safe way to open executables, files, or URLs
    const error = await shell.openPath(programPath)
    if (error) {
      console.error(`Failed to launch program: ${error}`)
    }
  } catch (e) {
    console.error('Error launching program:', e)
  }
})

let isScanning = false
ipcMain.on('scan-for-programs', async (event) => {
  if (isScanning) {
    console.log('Scan request ignored, another scan is already in progress.')
    return
  }
  isScanning = true
  console.log('Main process received "scan-for-programs" request. Starting registry scan.')

  try {
    // Replace mock data with a call to the new registry scan function
    await scanRegistry(event)
  } catch (error) {
    console.error('An error occurred during the program scan:', error)
  } finally {
    // Once the scan is complete, send the completion event and reset the flag
    event.sender.send('scan-complete')
    isScanning = false
    console.log('Scan complete.')
  }
})

ipcMain.on('remove-programs', (_event, programIdsToRemove: number[]) => {
  const libraryFilePath = getLibraryFilePath()
  console.log(`Received request to remove ${programIdsToRemove.length} programs.`)

  if (!fs.existsSync(libraryFilePath)) {
    console.log('Library file does not exist, nothing to remove.')
    return
  }

  try {
    const library = JSON.parse(fs.readFileSync(libraryFilePath, 'utf-8'))

    // Filter the library, keeping only the programs whose ID is NOT in the deletion list
    const updatedLibrary = library.filter((program) => !programIdsToRemove.includes(program.id))

    // Write the new, smaller library back to the file
    fs.writeFileSync(libraryFilePath, JSON.stringify(updatedLibrary, null, 2))
    console.log('Programs removed successfully. Updated library saved.')
  } catch (error) {
    console.error('Failed to removed programs from library:', error)
  }
})

//endregion program adding

//region overlay functions

// ===================================================================
// --- IPC Handlers ---
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

// --- Overlay UI Handlers ---
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

//endregion overlay functions
