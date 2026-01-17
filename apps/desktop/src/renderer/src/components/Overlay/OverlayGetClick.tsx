import { createRoot } from 'react-dom/client'
import React, { useEffect, useState } from 'react'
import styles from './Overlay.module.css'

// It's good practice to define a type for coordinate objects
interface Coordinate {
  x: number
  y: number
}

function OverlayGetClick(): React.JSX.Element {
  const [coordinateType, setCoordinateType] = useState<string | null>(null)
  // State to store the coordinates of the dots
  const [dots, setDots] = useState<Coordinate[]>([])
  // State to track the current mouse position
  const [mousePosition, setMousePosition] = useState<Coordinate>({ x: 0, y: 0 })

  useEffect(() => {
    const unsubscribe = window.electron.on('set-coordinate-type', (type: string) => {
      setCoordinateType(type)
      // When a new action starts, clear the dots from the previous one
      setDots([])
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const getCursorPosition = (event: React.MouseEvent<HTMLDivElement>): void => {
    const newDot: Coordinate = { x: event.clientX, y: event.clientY }
    setDots((prevDots) => [...prevDots, newDot])

    if (coordinateType === 'scroll' || coordinateType === 'move') {
      window.electron.send('get-cursor-position', coordinateType)
    } else if (coordinateType === 'drag') {
      if (dots.length === 0) {
        window.electron.send('get-cursor-position', 'dragOrigin')
      } else {
        window.electron.send('get-cursor-position', 'dragDestination')
      }
    }
  }

  // Handler to update mouse position state on move
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (coordinateType === 'move') {
      setMousePosition({ x: event.clientX, y: event.clientY })
    }
  }

  // --- Logic to find the closest corner ---
  let closestCorner = ''
  if (coordinateType === 'move') {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight

    // Define the coordinates of the four corners
    const corners = {
      'top-left': { x: 0, y: 0 },
      'top-right': { x: screenWidth, y: 0 },
      'bottom-left': { x: 0, y: screenHeight },
      'bottom-right': { x: screenWidth, y: screenHeight },
    }

    let minDistanceSq = Infinity

    // Calculate the distance from the mouse to each corner and find the minimum
    for (const [name, corner] of Object.entries(corners)) {
      const distanceSq =
        Math.pow(mousePosition.x - corner.x, 2) + Math.pow(mousePosition.y - corner.y, 2)
      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq
        closestCorner = name
      }
    }
  }
  // --- End of logic ---

  return (
    <div
      onClick={getCursorPosition}
      onMouseMove={handleMouseMove}
      className={styles.overlayGetClick}
    >
      {/* Conditionally render only the corner that is closest to the mouse */}
      {coordinateType === 'move' && (
        <>
          {closestCorner === 'top-left' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '400px',
                height: '400px',
                backgroundColor: 'lightskyblue',
                borderBottomRightRadius: '400px',
                border: '15px solid black',
                pointerEvents: 'none',
                opacity: '.4',
              }}
            />
          )}
          {closestCorner === 'top-right' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '400px',
                height: '400px',
                backgroundColor: 'lightskyblue',
                borderBottomLeftRadius: '400px',
                border: '15px solid black',
                pointerEvents: 'none',
                opacity: '.4',
              }}
            />
          )}
          {closestCorner === 'bottom-left' && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '400px',
                height: '400px',
                backgroundColor: 'lightskyblue',
                borderTopRightRadius: '400px',
                border: '15px solid black',
                pointerEvents: 'none',
                opacity: '.4',
              }}
            />
          )}
          {closestCorner === 'bottom-right' && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '400px',
                height: '400px',
                backgroundColor: 'lightskyblue',
                borderTopLeftRadius: '400px',
                border: '15px solid black',
                pointerEvents: 'none',
                opacity: '.4',
              }}
            />
          )}
        </>
      )}

      {/* We map over the dots array and render a styled div for each one. */}
      {dots.map((dot, index) => (
        <div
          key={index} // A key is required for lists in React
          style={{
            position: 'absolute',
            // Position the dot using the stored coordinates
            left: `${dot.x}px`,
            top: `${dot.y}px`,
            // Styling for the dot
            width: '20px',
            height: '20px',
            backgroundColor: 'lightskyblue',
            borderRadius: '50%',
            border: '5px solid black',
            // This transform centers the dot perfectly on the cursor
            transform: 'translate(-50%, -50%)',
            // Prevents the dot itself from being clickable
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  )
}

const container = document.getElementById('overlay-root')
if (container) {
  createRoot(container).render(<OverlayGetClick />)
}

export default OverlayGetClick
