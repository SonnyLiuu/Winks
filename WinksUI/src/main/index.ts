import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import path from 'path'
import fs from 'fs'
import { createMainWindow, createOverlayWindow } from './windows'
import { createOverlayGetClick } from './overlayGetClick'
import { openOnScreenKeyboard, overlayScroll, saveCursorPosition } from './overlay'
import { connectToDatabase, createUser, verifyUser } from './database'
import { scanRegistry } from './OSProgramScanning'

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  connectToDatabase()

  createMainWindow()
  createOverlayWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
      createOverlayWindow()
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

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
    const existingPaths = new Set(existingLibrary.map((p) => p.path))

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

//endregion overlay functions
