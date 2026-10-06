import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발 중에는 /api 를 Fastify 서버(3000)로 넘긴다.
// host를 명시하지 않으면 Windows에서 IPv6(::1)에만 열려 http://127.0.0.1:5173 으로는 접속이 안 된다.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:3000' } },
})
