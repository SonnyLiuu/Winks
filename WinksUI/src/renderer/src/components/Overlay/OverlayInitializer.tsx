import { createRoot } from 'react-dom/client'
import Overlay from './Overlay'

const container = document.getElementById('overlay-root')
if (container) {
  createRoot(container).render(<Overlay />)
}
