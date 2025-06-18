import styles from './Overlay.module.css'
import React from 'react'

function Menu(): React.JSX.Element {
  const openOverlayGetClick = (): void => {
    window.electron.send('open-overlay-get-click')
  }

  const moveCursorAndScrollUp = (): void => {
    window.electron.send('move-cursor-and-scroll', 'up')
  }
  const moveCursorAndScrollDown = (): void => {
    window.electron.send('move-cursor-and-scroll', 'down')
  }

  return (
    <>
      <div>
        <button className={styles.button} id="scrollUp" onClick={moveCursorAndScrollUp}>
          ↑
        </button>
        <button className={styles.button} id="scrollDown" onClick={moveCursorAndScrollDown}>
          ↓
        </button>
        <button className={styles.button} id="changeTarget" onClick={openOverlayGetClick}>
          •
        </button>
      </div>
    </>
  )
}

export default Menu
