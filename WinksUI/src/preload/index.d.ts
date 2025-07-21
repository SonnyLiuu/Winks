import { IElectronAPI } from './index'

declare global {
  interface Window {
    electron: {
      send: (channel: string, data?: any) => void
      invoke: (channel: string, ...args: any[]) => Promise<any> | undefined
      on: (channel: string, func: (...args: any[]) => void) => (() => void) | undefined
      [key: string]: any
    }
    api: IElectronAPI
  }
}

export {}
