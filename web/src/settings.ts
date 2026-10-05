import { useSyncExternalStore } from 'react'
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales'

export type Mode = 'system' | 'light' | 'dark'

export type Settings = {
  mode: Mode
  /** 라이트/다크 모드의 포인트 컬러. 각각 따로 지정한다. */
  accentLight: string
  accentDark: string
  /** 동사 굴절표에서 어미/불규칙 형태를 강조해서 보여줄지 */
  highlight: boolean
  /** 자주 쓰는 언어(코드). 검색 결과·자동완성에서 먼저 보이고, 랜덤 단어도 이 언어들에서 뽑는다. */
  preferredLangs: string[]
  /** 화면(UI) 문구의 언어. 사전 내용은 영향받지 않는다. */
  locale: Locale
}

export const DEFAULTS: Settings = { mode: 'system', accentLight: '#4f46e5', accentDark: '#8f95ff', highlight: true, preferredLangs: [], locale: DEFAULT_LOCALE }

/** 라이트/다크에서 각각 읽기 좋게 맞춘 프리셋. 라이트 쪽은 흰 카드/회색 배경 위 글자 대비 4.5:1 이상(WCAG AA)으로 골랐다. */
export const PRESETS: { name: string; light: string; dark: string }[] = [
  { name: 'Indigo', light: '#4f46e5', dark: '#8f95ff' },
  { name: 'Blue', light: '#2563eb', dark: '#6ea8ff' },
  { name: 'Teal', light: '#0f766e', dark: '#4fd1c5' },
  { name: 'Green', light: '#15803d', dark: '#6ee7a0' },
  { name: 'Amber', light: '#b45309', dark: '#fbbf24' },
  { name: 'Rose', light: '#be123c', dark: '#fb7185' },
  { name: 'Violet', light: '#7c3aed', dark: '#b794f6' },
  { name: 'Slate', light: '#475569', dark: '#a8b3c7' },
]

export const MAX_PREFERRED = 10
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
        preferredLangs: Array.isArray(raw.preferredLangs)
          ? raw.preferredLangs.filter((c: unknown): c is string => typeof c === 'string' && c.length > 0 && c.length <= 20).slice(0, MAX_PREFERRED)
          : [],
        locale: isLocale(raw.locale) ? raw.locale : DEFAULTS.locale,
      }
    }
  } catch {
    // 저장소를 못 읽으면 기본값으로 동작한다.
  }
  return DEFAULTS
}

const relLum = (hex: string) => {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 두 색의 명암 대비 (1~21). 글자는 4.5 이상이 권장(WCAG AA). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** 각 모드에서 포인트 컬러 글자가 올라가는 배경(카드/페이지). index.css 토큰과 같은 값. */
export const SURFACES = { light: ['#ffffff', '#f6f6f9'], dark: ['#17171d', '#0e0e12'] } as const

/** 그 모드의 카드/페이지 배경 위에서 가장 나쁜 대비 */
export const accentContrast = (hex: string, scheme: 'light' | 'dark') =>
  Math.min(...SURFACES[scheme].map((bg) => contrastRatio(hex, bg)))

/* ---------- 색 공간: sRGB ↔ OKLCH (Björn Ottosson의 OKLab) ----------
   OKLCH는 밝기(L)·채도(C)·색상(h)이 사람 눈의 지각에 가깝게 분리돼 있어서, 색상만 돌려도 밝기가 유지된다.
   (sRGB로 보색 근처의 두 색을 섞으면 중간이 탁한 회색이 된다 — 초록+분홍이 대표적.) */
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360]
}

/** OKLCH → sRGB 선형값. 범위를 벗어나면(=sRGB로 표현 불가) null */
function oklchToLinear(L: number, C: number, h: number): [number, number, number] | null {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb: [number, number, number] = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return rgb.every((c) => c >= -0.0005 && c <= 1.0005) ? rgb : null
}

/** OKLCH → #rrggbb. 표현할 수 없는 채도면 같은 밝기·색상에서 채도만 줄여 가장 선명한 색으로 맞춘다. */
function oklchToHex(L: number, C: number, h: number): string {
  let lo = 0
  let hi = C
  let best = oklchToLinear(L, 0, h) ?? [L, L, L]
  if (oklchToLinear(L, C, h)) lo = C
  for (let i = 0; i < 24 && hi - lo > 1e-4; i++) {
    const mid = (lo + hi) / 2
    const rgb = oklchToLinear(L, mid, h)
    if (rgb) (lo = mid), (best = rgb)
    else hi = mid
  }
  if (lo === C) best = oklchToLinear(L, C, h) ?? best
  return '#' + best.map((c) => Math.round(Math.min(1, Math.max(0, fromLinear(Math.min(1, Math.max(0, c))))) * 255).toString(16).padStart(2, '0')).join('')
}

/**
 * 포인트 컬러와 어울리는 "짝 색" (그라데이션의 두 번째 색).
 * 밝기는 거의 그대로 두고 색상만 돌린다 — 그래서 어떤 포인트 컬러에서도 중간 색이 탁해지지 않는다.
 *   - 노랑~주황~연두 영역(색상 40~110°)은 따뜻한 쪽(빨강/코랄)으로, 그 밖은 +50°(초록→청록, 청록→파랑, 파랑→보라, 인디고→분홍).
 *   - 채도가 거의 없는 회색 계열(Slate)은 최소한의 색기를 줘서 단색처럼 보이지 않게 한다.
 */
export function partnerColor(hex: string): string {
  const [L, C, h] = hexToOklch(hex)
  const shift = h >= 40 && h < 110 ? -45 : 50
  return oklchToHex(Math.min(0.97, L + 0.02), Math.max(C, 0.05), (h + shift + 360) % 360)
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
  root.lang = s.locale // 화면 읽기/번역 도구/글꼴 선택(한·중·일 글리프)이 이 값을 본다
  root.style.setProperty('--accent-l', s.accentLight)
  root.style.setProperty('--on-accent-l', onAccent(s.accentLight))
  root.style.setProperty('--accent-2-l', partnerColor(s.accentLight))
  root.style.setProperty('--accent-d', s.accentDark)
  root.style.setProperty('--on-accent-d', onAccent(s.accentDark))
  root.style.setProperty('--accent-2-d', partnerColor(s.accentDark))
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
