import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './QuickLinks.css'

interface Program {
  id: number
  name: string
  icon: string
  path: string
  type: 'program' | 'website' // Helps distinguish items
}

interface WebsiteInfo {
  name: string
  icon: string
}

export default function QuickLinks() {
  const navigate = useNavigate()
  const [apps, setApps] = useState<Program[]>([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedToRemove, setSelectedToRemove] = useState(new Set<number>())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [showScanConfirm, setShowScanConfirm] = useState(false)

  // Effect to load the library on component mount
  useEffect(() => {
    const handleLibraryUpdate = (library: Program[]) => {
      setApps(library)
    }
    const unsubscribe = window.electron.on('library-updated', handleLibraryUpdate)
    window.electron.send('get-library')
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Effect to handle fetching website info when the modal is open
  useEffect(() => {
    if (isModalOpen) {
      const handleWebsiteInfo = (info: WebsiteInfo | null) => {
        if (info) {
          setNewName(info.name)
          setNewIcon(info.icon)
        }
        setIsFetching(false)
      }
      const unsubscribe = window.electron.on('website-info-reply', handleWebsiteInfo)
      return () => {
        if (unsubscribe) unsubscribe()
      }
    }
  }, [isModalOpen])

  const handleUrlBlur = (url: string) => {
    console.log('handling blur')
    setIsFetching(true)
    setNewName('Finding Name...')
    console.log(newUrl)
    window.electron.send('fetch-website-info', url)
  }

  const handleSaveWebsite = () => {
    if (newUrl && newName) {
      window.electron.send('add-website', { url: newUrl, name: newName, icon: newIcon })
      setIsModalOpen(false)
      setNewUrl('')
      setNewName('')
      setNewIcon('')
      setTimeout(() => window.electron.send('get-library'), 200)
    }
  }

  const handleTileClick = (app: Program) => {
    if (isSelectMode) {
      const newSelected = new Set(selectedToRemove)
      if (newSelected.has(app.id)) {
        newSelected.delete(app.id)
      } else {
        newSelected.add(app.id)
      }
      setSelectedToRemove(newSelected)
    } else {
      // --- UPDATED LOGIC ---
      // Check the type and send to the appropriate channel
      if (app.type === 'website') {
        window.electron.send('launch-website', app.path)
      } else {
        window.electron.send('launch-program', app.path)
      }
    }
  }

  const handleRemoveSelected = () => {
    window.electron.send('remove-programs', Array.from(selectedToRemove))
    setSelectedToRemove(new Set())
    setIsSelectMode(false)
    setTimeout(() => window.electron.send('get-library'), 200)
  }

  const toggleSelectMode = () => {
    setSelectedToRemove(new Set())
    setIsSelectMode(!isSelectMode)
  }

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText()
    setNewUrl(text)
    handleUrlBlur(text)
  }

  const handleConfirmScan = () => {
    setShowScanConfirm(false)
    navigate('/add-program')
  }

  return (
    <div className="quick-links-container">
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Add Website Shortcut</h3>
            <div className="form-group">
              <label htmlFor="url">Website URL</label>
              <div className="input-with-button">
                <input
                  type="text"
                  id="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onBlur={() => handleUrlBlur(newUrl)}
                  placeholder="e.g., https://www.youtube.com"
                />
                <button onMouseDown={handlePaste} className="paste-button">
                  Paste
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="name">Shortcut Name</label>
              <input
                type="text"
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., YouTube"
              />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel-button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button
                className="modal-save-button"
                onClick={handleSaveWebsite}
                disabled={isFetching || !newUrl || !newName}
              >
                {isFetching ? 'Fetching...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanConfirm && (
        <div className="modal-overlay">
          <div className="modal-content confirm-modal">
            <h3>Scan for Programs?</h3>
            <p>
              This will scan your PC for installed applications and may take a moment. Do you wish
              to proceed?
            </p>
            <div className="modal-actions">
              <button className="modal-cancel-button" onClick={() => setShowScanConfirm(false)}>
                No
              </button>
              <button className="modal-save-button" onClick={handleConfirmScan}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="top-buttons-container">
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
            <button onClick={() => setIsModalOpen(true)} className="add-website-button">
              Add Website
            </button>
            <button onClick={() => setShowScanConfirm(true)} className="add-program-button">
              Add Program
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
          const tileClassName = `tile ${isSelectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`

          return (
            <div onClick={() => handleTileClick(app)} className={tileClassName} key={app.id}>
              {isSelected && (
                <div className="checkmark-overlay">
                  <span className="checkmark">✔</span>
                </div>
              )}
              <img
                src={app.icon}
                alt={app.name}
                className="tile-icon"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/90x90/f0f4ff/2c3e50?text=Icon'
                }}
              />
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
