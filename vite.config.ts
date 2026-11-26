import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // Zweite Seite: die Gästetür (middleware.js leitet Nicht-Gäste dorthin).
      input: { main: 'index.html', gate: 'gate.html' },
    },
  },
})
