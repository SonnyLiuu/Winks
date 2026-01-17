import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI as baseElectronAPI } from '@electron-toolkit/preload'

// -----------------------------
// Types
// -----------------------------
export type AuthResult = { ok: true } | { ok: false; error: string }

// prettier-ignore
export type UpdateStatus = 
'checking' 
| 'available' 
| 'none' 
| 'ready' 
| 'error'

export interface UpdateProgress {
  percent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
}

export type CalibrationData = Record<string, unknown>

type SendChannel =
  | 'overlay-get-click'
  | 'get-cursor-position'
  | 'move-cursor-and-scroll'
  | 'keyboard'
  | 'signup-user'
  | 'login-user'
  | 'scan-for-programs'
  | 'add-programs'
  | 'get-library'
  | 'launch-program'
  | 'remove-programs'
  | 'cancel-scan'
  | 'fetch-website-info'
  | 'add-website'
  | 'launch-website'

type ReceiveChannel =
  | 'set-coordinate-type'
  | 'proximity-update'
  | 'signup-response'
  | 'login-response'
  | 'program-found'
  | 'scan-complete'
  | 'library-updated'
  | 'website-info-reply'
  | 'update:status'
  | 'update:progress'
  | 'python:exit'
  | 'python:error'

// Match your main process shapes
export interface LibraryItem {
  id: number
  name: string
  icon: string
  path: string
  type: 'program' | 'website'
}

export type WebsiteData = { url: string; name: string; icon: string }

export interface IElectronAPI {
  // Python Backend Communication
  updateSensitivities: (yaw: number, pitch: number) => Promise<{ success: boolean; error?: string }>
  updateCalibration: (
    calibrationData: CalibrationData
  ) => Promise<{ success: boolean; error?: string }>

  // Auto-updater
  checkForUpdates: () => Promise<{ ok: true } | { ok: false; error: string }>
  installUpdate: () => Promise<{ ok: true } | { ok: false; error: string }>
}

// -----------------------------
// Allowed channels (runtime guard)
// -----------------------------
const validSendChannels: readonly SendChannel[] = [
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
] as const

const validReceiveChannels: readonly ReceiveChannel[] = [
  'set-coordinate-type',
  'proximity-update',
  'signup-response',
  'login-response',
  'program-found',
  'scan-complete',
  'library-updated',
  'website-info-reply',
  'update:status',
  'update:progress',
  'python:exit',
  'python:error',
] as const

// -----------------------------
// Invoked API (ipcMain.handle)
// -----------------------------
const api: IElectronAPI = {
  updateSensitivities: (yaw, pitch) => ipcRenderer.invoke('update-sensitivities', yaw, pitch),
  updateCalibration: (calibrationData) => ipcRenderer.invoke('update-calibration', calibrationData),

  checkForUpdates: async () => {
    try {
      const r = await ipcRenderer.invoke('update:check')
      return r ?? { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  installUpdate: async () => {
    try {
      const r = await ipcRenderer.invoke('update:install')
      return r ?? { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },
}

// -----------------------------
// Safe send/on helpers (ipcMain.on)
// -----------------------------
function isValidSendChannel(channel: string): channel is SendChannel {
  return (validSendChannels as readonly string[]).includes(channel)
}

function isValidReceiveChannel(channel: string): channel is ReceiveChannel {
  return (validReceiveChannels as readonly string[]).includes(channel)
}

type Listener = (...args: unknown[]) => void

const customAPI = {
  ...baseElectronAPI,

  send: (channel: SendChannel, data?: unknown): void => {
    if (isValidSendChannel(channel)) {
      ipcRenderer.send(channel, data)
      return
    }
    console.warn(`Attempted to send on unauthorized channel: ${channel}`)
  },

  on: (channel: ReceiveChannel, func: Listener): (() => void) | undefined => {
    if (!isValidReceiveChannel(channel)) {
      console.warn(`Attempted to listen on unauthorized channel: ${channel}`)
      return undefined
    }

    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => func(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },

  removeAllListeners: (channel: ReceiveChannel) => {
    if (!isValidReceiveChannel(channel)) {
      console.warn(`Attempted to clear listeners on unauthorized channel: ${channel}`)
      return
    }
    ipcRenderer.removeAllListeners(channel)
  },
}

// -----------------------------
// Expose to renderer
// -----------------------------
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', customAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Error exposing APIs to renderer:', error)
  }
} else {
  // @ts-ignore -- fallback for non-isolated context (dev only)
  window.electron = customAPI
  // @ts-ignore -- fallback for non-isolated context (dev only)
  window.api = api
}
