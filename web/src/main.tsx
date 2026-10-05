import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applySettings, getSettings } from './settings.ts'

// 첫 렌더 전에 저장된 테마/포인트 컬러를 적용해 화면이 깜빡이지 않게 한다.
applySettings(getSettings())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
