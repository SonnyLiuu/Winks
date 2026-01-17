import styles from './AddProgram.module.css'

// Define the shape of our program object for TypeScript
interface Program {
  id: number
  name: string
  icon: string
  path: string
}

interface ProgramTileProps {
  program: Program
  isSelected: boolean
  onSelect: (id: number) => void
}

export default function ProgramTile({ program, isSelected, onSelect }: ProgramTileProps) {
  // This variable correctly combines the base class and the conditional 'selected' class.
  const tileClassName = `${styles['program-tile']} ${isSelected ? styles['selected'] : ''}`

  return (
    // The fix is to use the 'tileClassName' variable here.
    <div className={tileClassName} onClick={() => onSelect(program.id)}>
      {isSelected && (
        <div className={styles['checkmark-overlay']}>
          <span className={styles['checkmark']}>✔</span>
        </div>
      )}
      <img src={program.icon} alt={program.name} className={styles['tile-icon']} />
      <span className={styles['tile-label']}>{program.name}</span>
    </div>
  )
}
