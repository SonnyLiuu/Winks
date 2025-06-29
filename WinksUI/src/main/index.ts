import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import path from 'path'
import fs from 'fs'
import { createMainWindow, createOverlayWindow } from './windows'
import { createOverlayGetClick } from './overlayGetClick'
import { openOnScreenKeyboard, overlayScroll, saveCursorPosition } from './overlay'
import { connectToDatabase, createUser, verifyUser } from './database'

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
  console.log(`Saving ${programsToAdd.length} programs to: ${libraryFilePath}`)
  try {
    let library = []
    if (fs.existsSync(libraryFilePath)) {
      library = JSON.parse(fs.readFileSync(libraryFilePath, 'utf-8'))
    }
    const updatedLibrary = [...library, ...programsToAdd]
    fs.writeFileSync(libraryFilePath, JSON.stringify(updatedLibrary, null, 2))
    console.log('Library saved successfully.')
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
ipcMain.on('scan-for-programs', (event) => {
  if (isScanning) {
    console.log('Scan request ignored, another scan is already in progress.')
    return
  }
  isScanning = true
  console.log('Main process received "scan-for-programs" request.')

  const mockPrograms = [
    {
      id: 1,
      name: 'VS Code',
      icon: 'https://cdn.icon-icons.com/icons2/2107/PNG/512/file_type_vscode_icon_130084.png',
      path: 'C:\\Program Files\\VS Code\\code.exe'
    },
    {
      id: 2,
      name: 'Steam',
      icon: 'https://cdn.icon-icons.com/icons2/2108/PNG/512/steam_icon_130867.png',
      path: 'C:\\Program Files (x86)\\Steam\\steam.exe'
    },
    {
      id: 3,
      name: 'Firefox',
      icon: 'https://cdn.icon-icons.com/icons2/2107/PNG/512/file_type_firefox_icon_130134.png',
      path: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
    },
    {
      id: 4,
      name: 'Discord',
      icon: 'https://cdn.icon-icons.com/icons2/2108/PNG/512/discord_icon_130958.png',
      path: 'C:\\Users\\User\\AppData\\Local\\Discord\\app-1.0.9005\\Discord.exe'
    },
    {
      id: 5,
      name: 'Steam',
      icon: 'https://cdn.icon-icons.com/icons2/2108/PNG/512/steam_icon_130867.png',
      path: 'C:\\Games\\Steam\\steam.exe'
    } // <<< Duplicate Steam entry for testing
  ]

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

  // --- NEW: Duplicate Handling Logic ---
  const nameCounts = new Map<string, number>()

  const getUniqueName = (name: string): string => {
    const count = nameCounts.get(name) || 0
    nameCounts.set(name, count + 1)
    if (count === 0) {
      return name // First time we've seen this name
    }
    return `${name} (${count + 1})` // Append (2), (3), etc.
  }
  // --- END: Duplicate Handling Logic ---

  let index = 0
  const interval = setInterval(() => {
    if (index < mockPrograms.length) {
      const originalProgram = mockPrograms[index]
      // Create a new program object with the potentially modified name
      const programToSend = {
        ...originalProgram,
        name: getUniqueName(originalProgram.name)
      }

      event.sender.send('program-found', programToSend)
      console.log(`Sent program: ${programToSend.name}`)
      index++
    } else {
      clearInterval(interval)
      isScanning = false
      event.sender.send('scan-complete')
      console.log('Scan complete.')
    }
  }, 500)
})

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
