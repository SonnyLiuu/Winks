declare global {
  interface Window {
    electron: {
      send: (channel: string, data?: any) => void
      [key: string]: any
    }
    api: unknown
  }
}

export {}
