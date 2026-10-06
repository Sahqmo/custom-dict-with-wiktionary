export type Hit = {
  word: string
  lang_code: string
  lang: string
  pos: string[]
  match: 'exact' | 'normalized' | 'form' | 'prefix'
}

export type ReverseHit = {
  word: string
  lang_code: string
  lang: string
  pos: string | null
  gloss: string
}

export type Lang = { lang_code: string; lang: string; count: number }

export type Sense = {
  glosses: string[]
  tags: string[]
  examples: { text: string; ref?: string }[]
}

/** m: 'e' = 굴절하는 부분(어미 등), 'i' = 불규칙이라 단어 전체 */
export type FormPart = { t: string; m?: 'e' | 'i' }

export type TableCell = { form: string; note?: string; article?: string; parts?: FormPart[] }[]

/** 서버가 활용형 태그로 조립한 굴절표 (독일어/스페인어/프랑스어) */
export type InflTable = {
  title: string
  group?: string
  cols: string[]
  rows: { label: string; cells: TableCell[] }[]
}

export type Entry = {
  word: string
  lang_code: string
  lang: string
  pos: string | null
  etymology: string | null
  etymology_number: number | null
  head: string | null
  senses: Sense[]
  sounds: { ipa: string | null; tags: string[]; audio_ogg: string | null; audio_mp3: string | null }[]
  tables: InflTable[]
  /** 표에 들어가지 않은 나머지 활용형 */
  forms: { form: string; tags: string[] }[]
  relations: Record<string, string[]>
  /** relations 중 항목이 없는 단어 */
  relMissing: string[]
}

/** 자동완성 항목. 같은 철자(대소문자·악센트 변형 포함)는 하나로 묶이고, langs = 그 철자가 있는 언어 수. */
export type Suggestion = Hit & { langs: number }

/** 즐겨찾기/기록 한 줄 */
export type Saved = { lang_code: string; lang: string; word: string; at: number }

export type RandomPick = { word: string; lang_code: string; lang: string; pos: string | null }

export type SwadeshLang = { lang_code: string; lang: string; filled: number; count: number }
export type SwadeshWord = { word: string; roman?: string; tags?: string; exists: boolean }
export type SwadeshItem = { n: number; label: string; core: boolean; words: SwadeshWord[] }

async function request<T>(
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  path: string,
  { params = {}, body, signal }: { params?: Record<string, string | undefined>; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
  const res = await fetch(`/api/${path}${qs.size ? `?${qs}` : ''}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

const get = <T>(path: string, params: Record<string, string | undefined> = {}, signal?: AbortSignal) => request<T>('GET', path, { params, signal })

export const api = {
  /** prefer: 자주 쓰는 언어 코드 ("de,fr") — 같은 일치 단계에서 이 언어들을 먼저 보여 준다 */
  search: (q: string, lang?: string, prefer?: string, signal?: AbortSignal) => get<Hit[]>('search', { q, lang, prefer }, signal),
  suggest: (q: string, lang?: string, prefer?: string, signal?: AbortSignal) => get<Suggestion[]>('suggest', { q, lang, prefer }, signal),
  random: (langs?: string) => get<RandomPick>('random', { langs }),
  daily: (date: string, langs?: string, signal?: AbortSignal) => get<RandomPick[]>('daily', { date, langs }, signal),
  reverse: (q: string, signal?: AbortSignal) => get<ReverseHit[]>('reverse', { q }, signal),
  entry: (word: string, lang: string, signal?: AbortSignal) => get<Entry[]>('entry', { word, lang }, signal),
  langs: (signal?: AbortSignal) => get<Lang[]>('langs', {}, signal),
  swadeshLangs: (signal?: AbortSignal) => get<{ total: number; langs: SwadeshLang[] }>('swadesh', {}, signal),
  swadeshList: (lang: string, signal?: AbortSignal) =>
    get<{ lang_code: string; lang: string; total: number; filled: number; items: SwadeshItem[] }>(`swadesh/${encodeURIComponent(lang)}`, {}, signal),

  favorites: () => get<Saved[]>('favorites'),
  addFavorite: (lang: string, word: string) => request('PUT', 'favorites', { body: { lang, word } }),
  removeFavorite: (lang: string, word: string) => request('DELETE', 'favorites', { params: { lang, word } }),
  history: () => get<Saved[]>('history'),
  visit: (lang: string, word: string) => request('POST', 'history', { body: { lang, word } }),
  removeHistory: (lang: string, word: string) => request('DELETE', 'history', { params: { lang, word } }),
  clearHistory: () => request('DELETE', 'history'),
}
