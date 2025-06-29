import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export let overlayGetClick: BrowserWindow | null = null

export function createOverlayGetClick(coordinateType: string): void {
  if (overlayGetClick) {
    overlayGetClick.focus()
    return
  }

  overlayGetClick = new BrowserWindow({
    width: 800,
    height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    fullscreen: true,
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })
  overlayGetClick.setAlwaysOnTop(true, 'screen-saver')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayGetClick.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/OverlayGetClick.html`)
  } else {
    overlayGetClick.loadFile(join(__dirname, '../renderer/OverlayGetClick.html'))
  }

  overlayGetClick.on('ready-to-show', () => {
    if (overlayGetClick) {
      overlayGetClick.webContents.send('set-coordinate-type', coordinateType)
    }
  })

  overlayGetClick.focus()
  //overlayGetClick.webContents.openDevTools({ mode: 'detach' })
  overlayGetClick.on('closed', () => {
    overlayGetClick = null
  })
}

export function closeOverlayGetClick(): void {
  if (overlayGetClick && !overlayGetClick.isDestroyed()) {
    overlayGetClick.close()
    overlayGetClick = null
  }
}
