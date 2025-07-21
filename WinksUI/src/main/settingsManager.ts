import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const SETTINGS_FILE_NAME = 'app-settings.json'
const settingsFilePath = path.join(app.getPath('userData'), SETTINGS_FILE_NAME)

export interface AppSettings {
  leftWinkSensitivity: number
  rightWinkSensitivity: number
  yaw: number
  pitch: number
  deadZone: number
  tiltAngle: number
}

const defaultSettings: AppSettings = {
  leftWinkSensitivity: 0.5,
  rightWinkSensitivity: 0.5,
  yaw: 45,
  pitch: 45,
  deadZone: 6,
  tiltAngle: 20
}

export function getSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const fileContent = fs.readFileSync(settingsFilePath, 'utf-8')
      // Combine default settings with saved settings to ensure all keys are present
      return { ...defaultSettings, ...JSON.parse(fileContent) }
    }
  } catch (error) {
    console.error('Error reading settings file, falling back to defaults:', error)
  }
  // If file doesn't exist or there's an error, return a fresh copy of defaults
  return { ...defaultSettings }
}

export function saveSettings(settingsToSave: Partial<AppSettings>): void {
  try {
    // First, get the most current settings
    const currentSettings = getSettings()
    // Then, merge the new settings into the current ones
    const newSettings = { ...currentSettings, ...settingsToSave }
    // Finally, write the complete, updated settings object back to the file
    fs.writeFileSync(settingsFilePath, JSON.stringify(newSettings, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving settings file:', error)
  }
}
