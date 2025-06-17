import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI as baseElectronAPI } from '@electron-toolkit/preload'

// Define channels you want to allow from the renderer
const validSendChannels = [
  'open-overlay-get-click',
  'get-cursor-position',
  'move-cursor-and-scroll',
  'keyboard',
  'signup-user',
  'login-user'
]
const validReceiveChannels = [
  'set-coordinate-type',
  'proximity-update',
  'signup-response',
  'login-response'
]

// Extend the electron API with a custom `send` function
const customAPI = {
  ...baseElectronAPI,
  send: (channel: string, data?: any): void => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  on: (channel: string, func: (...args: any[]) => void): (() => void) | undefined => {
    if (validReceiveChannels.includes(channel)) {
      // Deliberately strip event as it includes sender and other non-serializeable data
      const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => func(...args)
      ipcRenderer.on(channel, subscription)
      return () => {
        ipcRenderer.removeListener(channel, subscription)
      }
    } else {
      console.warn(`Attempted to listen on unauthorized channel: ${channel}`)
      return undefined
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
