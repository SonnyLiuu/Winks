import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI as baseElectronAPI } from '@electron-toolkit/preload'

// Define channels you want to allow from the renderer
const validSendChannels = ['open-overlay-get-click', 'get-cursor-position', 'move-cursor-and-scroll']

// Extend the electron API with a custom `send` function
const customAPI = {
  ...baseElectronAPI,
  send: (channel: string, data?: any): void => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  }
}

// You can expose more APIs if needed
const api = {}

// Safely expose APIs to the renderer process
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', customAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Error exposing APIs to renderer:', error)
  }
} else {
  // @ts-ignore fallback for non-isolated context (dev mode sometimes)
  window.electron = customAPI
  // @ts-ignore
  window.api = api
}
