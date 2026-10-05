import { useSyncExternalStore } from 'react'
import { api, type Saved } from './api'

/**
 * 내 단어(즐겨찾기 + 최근 본 단어)의 클라이언트 쪽 저장소. 진짜 저장은 서버의 data/user.sqlite.
 * 화면은 낙관적으로 먼저 바꾸고 서버에 보낸다. 서버 호출이 실패하면 서버 상태로 다시 맞춘다.
 */
type State = { loaded: boolean; failed: boolean; favorites: Saved[]; history: Saved[] }

let state: State = { loaded: false, failed: false, favorites: [], history: [] }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const useLibrary = (): State =>
  useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => state,
  )

export const keyOf = (lang: string, word: string) => `${lang}\t${word}`

let loading: Promise<void> | null = null
/** 앱이 시작될 때 한 번 (실패하면 다시 호출해 재시도할 수 있다) */
export function loadLibrary(force = false): Promise<void> {
  if (loading && !force) return loading
  loading = Promise.all([api.favorites(), api.history()]).then(
    ([favorites, history]) => set({ loaded: true, failed: false, favorites, history }),
    () => set({ loaded: true, failed: true }),
  )
  return loading
}

export const isFavorite = (lang: string, word: string) => state.favorites.some((f) => f.lang_code === lang && f.word === word)

export function toggleFavorite(lang: string, word: string, langName: string) {
  const had = isFavorite(lang, word)
  set({
    favorites: had
      ? state.favorites.filter((f) => !(f.lang_code === lang && f.word === word))
      : [{ lang_code: lang, lang: langName, word, at: Date.now() }, ...state.favorites],
  })
  ;(had ? api.removeFavorite(lang, word) : api.addFavorite(lang, word)).catch(() => loadLibrary(true))
}

export function removeFavorite(lang: string, word: string) {
  set({ favorites: state.favorites.filter((f) => !(f.lang_code === lang && f.word === word)) })
  api.removeFavorite(lang, word).catch(() => loadLibrary(true))
}

/** 항목 페이지를 열었을 때 기록에 남긴다 (같은 단어는 맨 위로 올라온다) */
export function recordVisit(lang: string, word: string, langName: string) {
  set({
    history: [
      { lang_code: lang, lang: langName, word, at: Date.now() },
      ...state.history.filter((h) => !(h.lang_code === lang && h.word === word)),
    ].slice(0, 1000),
  })
  api.visit(lang, word).catch(() => {})
}

export function removeHistory(lang: string, word: string) {
  set({ history: state.history.filter((h) => !(h.lang_code === lang && h.word === word)) })
  api.removeHistory(lang, word).catch(() => loadLibrary(true))
}

export function clearHistory() {
  set({ history: [] })
  api.clearHistory().catch(() => loadLibrary(true))
}
