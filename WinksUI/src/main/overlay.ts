import robot from '@hurdlegroup/robotjs'
import { screen } from 'electron'
import {closeOverlayGetClick} from "./overlayGetClick";

interface coordinate {
  x: number
  y: number
}

let scrollTarget: coordinate = {
  x: 0,
  y: 0
}

export function saveCursorPosition(): void{
  scrollTarget = robot.getMousePos()

  closeOverlayGetClick()
}

// 1 = right/down
export function overlayScroll(horizontal: boolean, dir: number): void {

  const {x, y} = robot.getMousePos()

  // Get the screen center coordinates
  const { width, height } = screen.getPrimaryDisplay().workArea

  const target = {x: width/2, y: height/2}
  if(scrollTarget) {
    target.x = scrollTarget.x
    target.y = scrollTarget.y
  }

  // Move the cursor to the center of the screen
  robot.moveMouse(target.x, target.y)  // Move cursor to center

  // Simulate scroll action (standard scroll amount is 120)
  const wheelDistance = dir * 360 // Calculate the wheel distance

  if(!horizontal) {
    robot.scrollMouse(0, wheelDistance)
  }
  robot.moveMouse(x,y)
}
