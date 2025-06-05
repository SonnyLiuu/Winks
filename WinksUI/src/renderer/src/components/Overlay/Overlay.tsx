import { createRoot } from 'react-dom/client'

import ScrollMenu from './ScrollMenu'

const container = document.getElementById('overlay-root')
if (container) {
  createRoot(container).render(<ScrollMenu />)
}
