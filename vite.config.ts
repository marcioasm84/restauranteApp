import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bind to 0.0.0.0 so tablets/phones on the same Wi-Fi can open the app
  // (e.g. http://<seu-ip-local>:5173) — needed for real multi-device testing.
  server: {
    host: true,
  },
})
