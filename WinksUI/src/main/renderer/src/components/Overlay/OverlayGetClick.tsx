// OverlayGetClick.tsx
import { createRoot } from 'react-dom/client'
import React from 'react'
import styles from './Overlay.module.css'

function OverlayGetClick(): React.JSX.Element {
  const getCursorPosition = (): void => {
    window.electron.send('get-cursor-position')
  }

  return <div onClick={getCursorPosition} className={styles.overlayGetClick}></div>
}

// This part initializes React — typically done once per HTML file
const container = document.getElementById('overlay-root')
if (container) {
  createRoot(container).render(<OverlayGetClick />)
}

export default OverlayGetClick
