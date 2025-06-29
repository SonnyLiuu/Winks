// QuickLinks.tsx
import { useNavigate } from 'react-router-dom'
import './QuickLinks.css'
import googleIcon from '../../images/google.png'
import youtubeIcon from '../../images/youtube.png'
import mainIcon from '../../images/main.png'
import { useEffect, useState } from 'react'

/*const apps = [
  { name: 'Google', icon: googleIcon, url: 'https://www.google.com' },
  { name: 'YouTube', icon: youtubeIcon, url: 'https://www.youtube.com' },
  { name: 'Gmail', icon: mainIcon, url: 'https://mail.google.com' }
]
*/

interface Program {
  id: number
  name: string
  icon: string
  path: string // The path to the executable
}

export default function QuickLinks() {
  const navigate = useNavigate()
  const [apps, setApps] = useState<Program[]>([])

  // --- NEW: State for managing remove mode ---
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedToRemove, setSelectedToRemove] = useState(new Set<number>())

  useEffect(() => {
    const handleLibraryUpdate = (library: Program[]) => {
      setApps(library)
    }
    const unsubscribe = window.electron.on('library-updated', handleLibraryUpdate)

    // Request the library from the main process on load
    window.electron.send('get-library')

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const handleTileClick = (app: Program) => {
    if (isSelectMode) {
      // If in select mode, toggle selection for deletion
      const newSelected = new Set(selectedToRemove)
      if (newSelected.has(app.id)) {
        newSelected.delete(app.id)
      } else {
        newSelected.add(app.id)
      }
      setSelectedToRemove(newSelected)
    } else {
      // Otherwise, launch the program
      window.electron.send('launch-program', app.path)
    }
  }

  const handleRemoveSelected = () => {
    // Send the IDs of the selected programs to the main process
    window.electron.send('remove-programs', Array.from(selectedToRemove))

    // Reset the selection state and exit select mode
    setSelectedToRemove(new Set())
    setIsSelectMode(false)

    // Refresh the library from the main process
    setTimeout(() => window.electron.send('get-library'), 100)
  }

  const toggleSelectMode = () => {
    // When toggling, always clear previous selections
    setSelectedToRemove(new Set())
    setIsSelectMode(!isSelectMode)
  }

  return (
    <div className="quick-links-container">
      <div className="top-buttons-container">
        {/* The buttons now change based on whether you are in select mode */}
        {isSelectMode ? (
          <>
            <button
              className="remove-selected-button"
              disabled={selectedToRemove.size === 0}
              onClick={handleRemoveSelected}
            >
              Remove ({selectedToRemove.size})
            </button>
            <button onClick={toggleSelectMode} className="select-button">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/add-program')} className="add-program-button">
              Add a Program
            </button>
            <button onClick={toggleSelectMode} className="select-button">
              Select
            </button>
          </>
        )}
      </div>

      <div className="header-row">
        <h2>Library</h2>
      </div>

      <div className="tiles-grid">
        {apps.map((app) => {
          const isSelected = selectedToRemove.has(app.id)
          // Add 'selected' class if the tile is selected for deletion
          const tileClassName = `tile ${isSelectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`

          return (
            <div onClick={() => handleTileClick(app)} className={tileClassName} key={app.id}>
              {isSelected && (
                <div className="checkmark-overlay">
                  <span className="checkmark">✔</span>
                </div>
              )}
              <img src={app.icon} alt={app.name} className="tile-icon" />
              <span className="tile-label">{app.name}</span>
            </div>
          )
        })}
      </div>

      <button className="back-button" onClick={() => navigate('/dashboard')}>
        Back to Home
      </button>
    </div>
  )
}
