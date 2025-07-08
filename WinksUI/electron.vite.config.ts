import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    // --- Add this optimizeDeps section ---
    // This explicitly tells the dev server to NOT bundle robotjs.
    optimizeDeps: {
      exclude: ['@hurdlegroup/robotjs']
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          overlay: resolve(__dirname, 'src/renderer/Overlay.html'),
          overlayGetClick: resolve(__dirname, 'src/renderer/OverlayGetClick.html')
        }
      },
      outDir: 'out/renderer'
    }
  }
})
