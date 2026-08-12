import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  // basicSsl chỉ để test local qua HTTPS trên điện thoại (getUserMedia/mic cần secure context).
  // GitHub Pages khi deploy thật vốn đã là HTTPS nên không cần plugin này lúc build production.
  plugins: [react(), basicSsl()],
  // Dùng đường dẫn tương đối để build chạy đúng dù deploy ở subpath nào của GitHub Pages
  base: './',
})
