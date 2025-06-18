import { createRoot } from 'react-dom/client'

import Menu from './Menu'

const container = document.getElementById('overlay-root')
if (container) {
  createRoot(container).render(<Menu />)
}
