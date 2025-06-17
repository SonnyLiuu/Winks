// Overlay.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Menu, MenuItem, SubMenu } from '@spaceymonk/react-radial-menu'

function Overlay(): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [centerX, setCenterX] = useState(0)
  const [centerY, setCenterY] = useState(0)
  const [nearMouse, setNearMouse] = useState(false)

  useEffect(() => {
    const updateCenter = (): void => {
      if (wrapperRef.current) {
        const { width, height } = wrapperRef.current.getBoundingClientRect()
        setCenterX(width / 2)
        setCenterY(height / 2)
      }
    }

    updateCenter()
    window.addEventListener('resize', updateCenter)

    const unsubscribe = window.electron.on('proximity-update', (near: boolean) => {
      setNearMouse(near)
      console.log(near)
    })

    return () => {
      window.removeEventListener('resize', updateCenter)
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const moveCursorAndScroll = (direction: string): void => {
    window.electron.send('move-cursor-and-scroll', direction)
  }
  const changeScrollingLocation = (): void => {
    window.electron.send('overlay-get-click', 'scroll')
  }

  const doOverlayDrag = (): void => {
    window.electron.send('overlay-get-click', 'drag')
  }
  const moveOverlay = (): void => {
    window.electron.send('overlay-get-click', 'move')
  }
  const openOnScreenKeyboard = (): void => {
    window.electron.send('keyboard')
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {nearMouse && (
        <Menu
          show={true}
          outerRadius={180}
          innerRadius={60}
          centerX={centerX}
          centerY={centerY}
          drawBackground={true}
          animation={['fade', 'scale']}
          animationTimeout={150}
          theme={'dark'}
        >
          <MenuItem data="Drag" onItemClick={openOnScreenKeyboard}>
            On Screen Keyboard
          </MenuItem>
          <MenuItem onItemClick={changeScrollingLocation} data="Change Scrolling Location">
            Change Scrolling Location
          </MenuItem>
          <MenuItem data="Move Overlay" onItemClick={moveOverlay}>
            Move Overlay
          </MenuItem>
          <MenuItem data="Drag" onItemClick={doOverlayDrag}>
            Drag
          </MenuItem>
          <SubMenu data="Scroll Menu" itemView="Scrolling" displayPosition="center">
            <MenuItem onItemClick={() => moveCursorAndScroll('down')}>↓</MenuItem>
            <MenuItem onItemClick={() => moveCursorAndScroll('left')}>←</MenuItem>
            <MenuItem onItemClick={() => moveCursorAndScroll('up')}>↑</MenuItem>
            <MenuItem onItemClick={() => moveCursorAndScroll('right')}>→</MenuItem>
          </SubMenu>
        </Menu>
      )}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          backgroundColor: 'lightskyblue',
          border: '15px solid black',
          opacity: 0.3
        }}
      />
    </div>
  )
}

export default Overlay
