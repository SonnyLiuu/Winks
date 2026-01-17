import WinReg from 'winreg'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export async function scanRegistry(event) {
  const registryKeys = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ]

  const foundPrograms = new Set<string>()
  let programIdCounter = 0

  for (const key of registryKeys) {
    try {
      const regKey = new WinReg({
        hive: key.split('\\')[0],
        key: `\\${key.split('\\').slice(1).join('\\')}`
      })
      const items = await new Promise<WinReg.RegistryItem[]>((resolve, reject) => {
        regKey.keys((err, items) => {
          if (err) return reject(err)
          resolve(items)
        })
      })

      for (const item of items) {
        const subkey = new WinReg({ hive: item.hive, key: item.key })
        const values = await new Promise<WinReg.RegistryItem[]>((resolve, reject) => {
          subkey.values((err, values) => {
            if (err) return reject(err)
            resolve(values)
          })
        })

        const displayNameItem = values.find((v) => v.name === 'DisplayName')
        const displayIconItem = values.find((v) => v.name === 'DisplayIcon')
        const installLocationItem = values.find((v) => v.name === 'InstallLocation')
        const systemComponent = values.find((v) => v.name === 'SystemComponent')

        const displayName = displayNameItem?.value
        let displayIcon = displayIconItem?.value

        // Filter out system components and entries without a display name
        if (!displayName || systemComponent?.value === 1) {
          continue
        }

        // Clean up the icon path
        if (displayIcon) {
          // Some paths are comma-separated with an index, get the actual path
          displayIcon = displayIcon.split(',')[0].replace(/"/g, '')
        }

        let executablePath =
          displayIcon ||
          (installLocationItem?.value
            ? path.join(installLocationItem.value, `${displayName}.exe`)
            : null)

        if (executablePath && !fs.existsSync(executablePath)) {
          // Fallback if the direct path doesn't exist
          if (installLocationItem?.value && fs.existsSync(installLocationItem.value)) {
            const files = fs.readdirSync(installLocationItem.value)
            const exe = files.find(
              (f) =>
                f.toLowerCase() === `${displayName.toLowerCase().replace(/ /g, '')}.exe` ||
                f.toLowerCase().endsWith('.exe')
            )
            if (exe) {
              executablePath = path.join(installLocationItem.value, exe)
            } else {
              continue // Can't find a valid executable
            }
          } else {
            continue
          }
        }

        if (executablePath && !foundPrograms.has(displayName)) {
          foundPrograms.add(displayName)
          const icon = await app.getFileIcon(executablePath, { size: 'large' })

          const program = {
            id: programIdCounter++,
            name: displayName,
            icon: icon.toDataURL(),
            path: executablePath
          }
          event.sender.send('program-found', program)
        }
      }
    } catch (err) {
      console.error(`Error scanning registry key ${key}:`, err)
    }
  }
}
