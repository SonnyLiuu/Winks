import robot from '@hurdlegroup/robotjs'
import { screen } from 'electron'
import { closeOverlayGetClick } from './overlayGetClick'
import { overlayWindow } from './windows'
import { exec } from 'node:child_process'
import * as os from 'node:os'

interface coordinate {
  x: number
  y: number
}

let scrollTarget: coordinate | null = null
let dragOrigin: coordinate | null = null
let dragDestination: coordinate | null = null
let overlayLocation: coordinate | null = null

export function saveCursorPosition(coordinateType: string): void {
  if (coordinateType === 'scroll') {
    scrollTarget = robot.getMousePos()
    closeOverlayGetClick()
  } else if (coordinateType === 'dragOrigin') {
    dragOrigin = robot.getMousePos()
    console.log('got dragOrigin = ', dragOrigin)
  } else if (coordinateType === 'dragDestination') {
    dragDestination = robot.getMousePos()
    console.log('got dragDestination = ', dragDestination)
    console.log('closing overlay get click')
    closeOverlayGetClick()
    setTimeout(overlayDrag, 100)
  } else if (coordinateType === 'move') {
    overlayLocation = robot.getMousePos()
    moveOverlay()
    closeOverlayGetClick()
  }
}

// 1 = right/down
export function overlayScroll(horizontal: boolean, dir: number): void {
  const { x, y } = robot.getMousePos()

  // Get the screen center coordinates
  const { width, height } = screen.getPrimaryDisplay().workArea

  const target = { x: width / 2, y: height / 2 }

  if (scrollTarget) {
    target.x = scrollTarget.x
    target.y = scrollTarget.y
  }

  // Move the cursor to the center of the screen
  robot.moveMouse(target.x, target.y) // Move cursor to center

  // Simulate scroll action (standard scroll amount is 120)
  const wheelDistance = dir * 360 // Calculate the wheel distance

  if (!horizontal) {
    robot.scrollMouse(0, wheelDistance)
  } else {
    robot.keyToggle('shift', 'down')
    robot.scrollMouse(0, wheelDistance)
    robot.keyToggle('shift', 'up')
  }

  robot.moveMouse(x, y)
}

export function overlayDrag(): void {
  console.log('doing overlay drag')
  if (dragOrigin && dragDestination) {
    robot.moveMouse(dragOrigin.x, dragOrigin.y)
    robot.mouseToggle('down', 'left')
    robot.moveMouseSmooth(dragDestination.x, dragDestination.y, 1.8)
    robot.mouseToggle('up', 'left')
  } else console.log(dragOrigin, dragDestination)
}

export function moveOverlay(): void {
  if (!overlayLocation) return

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workArea
  const { width: windowWidth, height: windowHeight } = overlayWindow.getBounds()

  const screenCorners = {
    'Top-Left': { x: 0, y: 0 },
    'Top-Right': { x: screenWidth, y: 0 },
    'Bottom-Left': { x: 0, y: screenHeight },
    'Bottom-Right': { x: screenWidth, y: screenHeight }
  }

  const targetPositions = {
    'Top-Left': { x: 0, y: 0 },
    'Top-Right': { x: screenWidth - windowWidth, y: 0 },
    'Bottom-Left': { x: 0, y: screenHeight - windowHeight },
    'Bottom-Right': { x: screenWidth - windowWidth, y: screenHeight - windowHeight }
  }

  let closestCornerName: keyof typeof screenCorners = 'Bottom-Left'
  let minDistance = Infinity

  for (const [name, corner] of Object.entries(screenCorners)) {
    const distanceSq =
      Math.pow(overlayLocation.x - corner.x, 2) + Math.pow(overlayLocation.y - corner.y, 2)
    if (distanceSq < minDistance) {
      minDistance = distanceSq
      closestCornerName = name as keyof typeof screenCorners
    }
  }

  const targetPosition = targetPositions[closestCornerName]

  console.log(`Moving window to ${closestCornerName} corner.`)

  overlayWindow.setPosition(targetPosition.x, targetPosition.y, true)
}

export function openOnScreenKeyboard(): void {
  const platform = os.platform()

  if (platform === 'win32') {
    // Try launching modern touch keyboard first, fallback to osk.exe
    exec('C:\\Program Files\\Common Files\\Microsoft Shared\\ink\\TabTip.exe', (err) => {
      if (err) {
        console.warn('TabTip.exe failed, falling back to osk.exe')
        exec('osk.exe', (oskErr) => {
          if (oskErr) console.error('Failed to launch osk.exe:', oskErr)
        })
      }
    })
  } else if (platform === 'darwin') {
    // macOS workaround — limited support
    exec(
      `osascript -e 'tell application "System Events" to key code 102 using {command down, option down}'`,
      (err) => {
        if (err) console.error('Failed to trigger keyboard viewer on macOS:', err)
      }
    )
  } else if (platform === 'linux') {
    // Launch Onboard virtual keyboard
    exec('onboard', (err) => {
      if (err) console.error('Failed to launch onboard on Linux:', err)
    })
  } else {
    console.warn(`Platform ${platform} not supported for on-screen keyboard.`)
  }
}

function startOverlayProximityWatcher(): void {
  const checkDistance = (): void => {
    const cursor = screen.getCursorScreenPoint()
    const bounds = overlayWindow.getBounds()

    const buffer = 150 // pixels around overlay to trigger visibility

    const isNear =
      cursor.x >= bounds.x - buffer &&
      cursor.x <= bounds.x + bounds.width + buffer &&
      cursor.y >= bounds.y - buffer &&
      cursor.y <= bounds.y + bounds.height + buffer

    overlayWindow.webContents.send('proximity-update', isNear)
  }

  setInterval(checkDistance, 100) // check every 100ms
}

startOverlayProximityWatcher()
