import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI as baseElectronAPI } from '@electron-toolkit/preload'

// --- Type-safe definition for the API exposed to the renderer process ---
export interface IElectronAPI {
  // Functions for Python Backend Communication
  updateSensitivities: (yaw: number, pitch: number) => Promise<{ success: boolean; error?: string }>;
  updateCalibration: (calibrationData: any) => Promise<{ success: boolean; error?: string }>;
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => void;
}

// Define channels you want to allow from the renderer
const validSendChannels = [
  'overlay-get-click',
  'get-cursor-position',
  'move-cursor-and-scroll',
  'keyboard',
  'signup-user',
  'login-user',
  'scan-for-programs',
  'add-programs',
  'get-library',
  'launch-program',
  'remove-programs',
  'cancel-scan',
  'fetch-website-info',
  'add-website',
  'launch-website',
  'save-settings'
]
const validReceiveChannels = [
  'set-coordinate-type',
  'proximity-update',
  'signup-response',
  'login-response',
  'program-found',
  'scan-complete',
  'library-updated',
  'website-info-reply'
]

const validInvokeChannels = [
  'update-sensitivities',
  'update-calibration',
  'get-settings'
]

// --- Expose protected methods that allow the renderer process to IPC ---
// This is the secure way to allow your UI to talk to the main process.
const api = {
  // Python settings handlers
  updateSensitivities: (yaw: number, pitch: number) =>
    ipcRenderer.invoke('update-sensitivities', yaw, pitch),
  updateCalibration: (calibrationData: any) =>
    ipcRenderer.invoke('update-calibration', calibrationData),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.send('save-settings', settings)
}

// Extend the electron API with a custom `send` function
const customAPI = {
  ...baseElectronAPI,
  send: (channel: string, data?: any): void => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  invoke: (channel: string, ...args: any[]): Promise<any> | undefined => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`Attempted to invoke unauthorized channel: ${channel}`);
    return undefined;
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
