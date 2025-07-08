import robot from '@hurdlegroup/robotjs'
import { screen } from 'electron'
import { closeOverlayGetClick } from './overlayGetClick'
import { overlayWindow } from './windows' // Using your existing import
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

// Variable to hold the timer ID for the watcher
let proximityInterval: NodeJS.Timeout | null = null;

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
    closeOverlayGetClick()
    setTimeout(overlayDrag, 100)
  } else if (coordinateType === 'move') {
    overlayLocation = robot.getMousePos()
    moveOverlay()
    closeOverlayGetClick()
  }
}

export function overlayScroll(horizontal: boolean, dir: number): void {
  const { x, y } = robot.getMousePos()
  const { width, height } = screen.getPrimaryDisplay().workArea
  const target = { x: width / 2, y: height / 2 }
  if (scrollTarget) {
    target.x = scrollTarget.x
    target.y = scrollTarget.y
  }
  robot.moveMouse(target.x, target.y)
  const wheelDistance = dir * 360
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
  if (!overlayWindow || !overlayLocation) return;
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
    exec('C:\\Program Files\\Common Files\\Microsoft Shared\\ink\\TabTip.exe', (err) => {
      if (err) {
        console.warn('TabTip.exe failed, falling back to osk.exe')
        exec('osk.exe', (oskErr) => {
          if (oskErr) console.error('Failed to launch osk.exe:', oskErr)
        })
      }
    })
  } else {
    console.warn(`Platform ${platform} not supported for on-screen keyboard.`)
  }
}

// --- Proximity watcher is now explicitly started and stopped ---
export function startOverlayProximityWatcher(): void {
  if (proximityInterval) return; // Prevent multiple intervals
  
  const checkDistance = (): void => {
    // Add a guard to ensure the window still exists before using it
    if (!overlayWindow || overlayWindow.isDestroyed()) {
        stopOverlayProximityWatcher(); // Stop the timer if the window is gone
        return;
    }
    try {
        const cursor = screen.getCursorScreenPoint()
        const bounds = overlayWindow.getBounds()
        const buffer = 150
        const isNear =
          cursor.x >= bounds.x - buffer &&
          cursor.x <= bounds.x + bounds.width + buffer &&
          cursor.y >= bounds.y - buffer &&
          cursor.y <= bounds.y + bounds.height + buffer
        overlayWindow.webContents.send('proximity-update', isNear)
    } catch (error) {
        // This catch block prevents the "Object has been destroyed" error
        // from crashing the app if the timer fires after the window is closed.
        console.error("Error in proximity watcher, stopping to prevent spam:", error);
        stopOverlayProximityWatcher();
    }
  }
  proximityInterval = setInterval(checkDistance, 100);
  console.log("Overlay proximity watcher started.");
}

export function stopOverlayProximityWatcher(): void {
    if (proximityInterval) {
        clearInterval(proximityInterval);
        proximityInterval = null;
        console.log("Overlay proximity watcher stopped.");
    }
}

// --- REMOVED: Do not automatically start the watcher here ---
// The line "startOverlayProximityWatcher()" has been deleted from the end of the file.
