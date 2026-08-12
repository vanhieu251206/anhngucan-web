import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dùng đường dẫn tương đối để build chạy đúng dù deploy ở subpath nào của GitHub Pages
  base: './',
})
