import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'

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
