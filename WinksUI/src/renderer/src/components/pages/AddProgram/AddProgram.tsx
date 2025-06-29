import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgramTile from './ProgramTile'
import styles from './AddProgram.module.css'

interface Program {
  id: number
  name: string
  icon: string
  path: string
}

export default function AddProgram() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgramIds, setSelectedProgramIds] = useState(new Set<number>())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setPrograms([])
    setIsLoading(true)

    // --- UPDATED: This function now sorts the list on every update ---
    const handleProgramFound = (program: Program) => {
      setPrograms((prevPrograms) => {
        // 1. Add the new program to a copy of the list
        const updatedList = [...prevPrograms, program]
        // 2. Sort the entire list alphabetically
        updatedList.sort((a, b) => a.name.localeCompare(b.name))
        // 3. Return the new, sorted list to update the state
        return updatedList
      })
    }
    const unsubscribeProgramFound = window.electron.on('program-found', handleProgramFound)

    const handleScanComplete = () => {
      setIsLoading(false)
    }
    const unsubscribeScanComplete = window.electron.on('scan-complete', handleScanComplete)

    window.electron.send('scan-for-programs')

    return () => {
      if (unsubscribeProgramFound) unsubscribeProgramFound()
      if (unsubscribeScanComplete) unsubscribeScanComplete()
    }
  }, [])

  const handleProgramSelect = (programId: number) => {
    const newSelectedIds = new Set(selectedProgramIds)
    if (newSelectedIds.has(programId)) {
      newSelectedIds.delete(programId)
    } else {
      newSelectedIds.add(programId)
    }
    setSelectedProgramIds(newSelectedIds)
  }

  const handleAddPrograms = () => {
    const selectedPrograms = programs.filter((p) => selectedProgramIds.has(p.id))
    if (selectedPrograms.length > 0) {
      window.electron.send('add-programs', selectedPrograms)
    }
    navigate('/quick-links')
  }

  return (
    <div className={styles['add-program-container']}>
      <div className={styles['add-program-header']}>
        <h3>{isLoading ? 'Scanning for programs...' : `Found ${programs.length} programs:`}</h3>
      </div>

      {isLoading && programs.length === 0 && (
        <div className={styles['loading-container']}>
          <p>Please wait while we scan your computer for applications.</p>
        </div>
      )}

      <div className={styles['tiles-grid']}>
        {programs.map((program) => (
          <ProgramTile
            key={program.id}
            program={program}
            isSelected={selectedProgramIds.has(program.id)}
            onSelect={() => handleProgramSelect(program.id)}
          />
        ))}
      </div>

      <div className={styles['add-program-actions']}>
        <button className={styles['cancel-button']} onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button
          className={styles['add-button']}
          disabled={selectedProgramIds.size === 0}
          onClick={handleAddPrograms}
        >
          Add {selectedProgramIds.size || ''} Selected
        </button>
      </div>
    </div>
  )
}
