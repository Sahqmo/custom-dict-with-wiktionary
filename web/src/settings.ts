import { useSyncExternalStore } from 'react'

export type Mode = 'system' | 'light' | 'dark'

export type Settings = {
  mode: Mode
  /** 라이트/다크 모드의 포인트 컬러. 각각 따로 지정한다. */
  accentLight: string
  accentDark: string
  /** 동사 굴절표에서 어미/불규칙 형태를 강조해서 보여줄지 */
  highlight: boolean
}

export const DEFAULTS: Settings = { mode: 'system', accentLight: '#4f46e5', accentDark: '#8f95ff', highlight: true }

/** 라이트/다크에서 각각 읽기 좋게 맞춘 프리셋 */
export const PRESETS: { name: string; light: string; dark: string }[] = [
  { name: 'Indigo', light: '#4f46e5', dark: '#8f95ff' },
  { name: 'Blue', light: '#2563eb', dark: '#6ea8ff' },
  { name: 'Teal', light: '#0d9488', dark: '#4fd1c5' },
  { name: 'Green', light: '#16a34a', dark: '#6ee7a0' },
  { name: 'Amber', light: '#d97706', dark: '#fbbf24' },
  { name: 'Rose', light: '#e11d48', dark: '#fb7185' },
  { name: 'Violet', light: '#7c3aed', dark: '#b794f6' },
  { name: 'Slate', light: '#475569', dark: '#a8b3c7' },
]

const KEY = 'settings.v1'
const HEX = /^#[0-9a-f]{6}$/i

export const isHex = (s: string) => HEX.test(s)

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw && typeof raw === 'object') {
      return {
        mode: raw.mode === 'light' || raw.mode === 'dark' ? raw.mode : 'system',
        accentLight: isHex(raw.accentLight) ? raw.accentLight : DEFAULTS.accentLight,
        accentDark: isHex(raw.accentDark) ? raw.accentDark : DEFAULTS.accentDark,
        highlight: typeof raw.highlight === 'boolean' ? raw.highlight : DEFAULTS.highlight,
      }
    }
  } catch {
    // 저장소를 못 읽으면 기본값으로 동작한다.
  }
  return DEFAULTS
}

/** 포인트 컬러 위에 올릴 글자색(흰색/검정) — 대비가 더 큰 쪽 */
function onAccent(hex: string): string {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255))
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? '#ffffff' : '#111111'
}

export function applySettings(s: Settings) {
  const root = document.documentElement
  if (s.mode === 'system') delete root.dataset.theme
  else root.dataset.theme = s.mode
  root.dataset.hl = s.highlight ? 'on' : 'off'
  root.style.setProperty('--accent-l', s.accentLight)
  root.style.setProperty('--on-accent-l', onAccent(s.accentLight))
  root.style.setProperty('--accent-d', s.accentDark)
  root.style.setProperty('--on-accent-d', onAccent(s.accentDark))
}

let current = load()
const listeners = new Set<() => void>()

export function getSettings() {
  return current
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  applySettings(current)
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // 저장 실패해도 이번 세션에는 적용된다.
  }
  listeners.forEach((l) => l())
}

export function resetSettings() {
  updateSettings(DEFAULTS)
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

/** 실제로 지금 적용되는 모드 (system이면 OS 설정 기준) */
export function effectiveScheme(mode: Mode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
