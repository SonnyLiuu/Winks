import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          // Defines your main window's entry point
          main: resolve(__dirname, 'src/renderer/index.html'),
          // Defines your overlay window's entry point
          overlay: resolve(__dirname, 'src/renderer/Overlay.html'),
          // Defines the entry point for the "get click" overlay
          overlayGetClick: resolve(__dirname, 'src/renderer/OverlayGetClick.html')
        }
      },
      outDir: 'out/renderer'
    }
  }
})