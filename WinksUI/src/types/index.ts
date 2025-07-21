export interface ApiResponse {
  success: boolean
  message: string
  user?: User
  userId?: string
}

export interface Settings {
  leftWinkSensitivity: number
  rightWinkSensitivity: number
  yaw: number
  pitch: number
  deadZone: number
  tiltAngle: number
}

export interface User {
  id: string
  email: string
  settings: Settings
}

export interface LibraryItem {
  id: number
  name: string
  icon: string
  path: string
  type: 'program' | 'website'
}
