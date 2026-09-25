import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

function originOf(url) {
  try {
    return url ? new URL(url).origin : ''
  } catch {
    return ''
  }
}

// Content-Security-Policy dạng thẻ <meta> (audit bảo mật 2026-09-25) — GitHub Pages không cho đặt HTTP header nên
// chỉ làm được qua meta (frame-ancestors/report-uri không dùng được ở dạng này). Chặn script lạ (XSS) chạy trên
// trang. CHỈ gắn khi build: dev server của Vite cần script inline (React Refresh) nên bật ở dev sẽ hỏng HMR.
// Thêm dịch vụ bên ngoài mới (script/iframe/API) thì phải thêm domain vào đây, nếu không trình duyệt sẽ chặn.
function cspPlugin(env) {
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN ? `https://${env.VITE_FIREBASE_AUTH_DOMAIN}` : ''
  const csp = [
    "default-src 'self'",
    // apis.google.com + iframe authDomain: Firebase Auth nạp sẵn khung xác thực của Google.
    // googletagmanager: Google Analytics (lib/analytics.js). google.com/gstatic: reCAPTCHA của App Check (lib/firebase.js).
    "script-src 'self' https://apis.google.com https://www.googletagmanager.com https://www.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Ảnh/audio bài học: Cloudinary + URL dán tay trong CMS (nguồn bất kỳ, chỉ https).
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    `connect-src 'self' https://*.googleapis.com https://api.cloudinary.com https://res.cloudinary.com https://*.workers.dev https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.google.com ${originOf(env.VITE_WORKER_URL)}`,
    `frame-src 'self' https://*.firebaseapp.com https://www.google.com ${authDomain}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ]
    .map(d => d.trim())
    .join('; ')
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    // basicSsl chỉ để test local qua HTTPS trên điện thoại (getUserMedia/mic cần secure context).
    // GitHub Pages khi deploy thật vốn đã là HTTPS nên không cần plugin này lúc build production.
    plugins: [react(), basicSsl(), cspPlugin(env)],
    // Dùng đường dẫn tương đối để build chạy đúng dù deploy ở subpath nào của GitHub Pages
    base: './',
  }
})
