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
}

async function get<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
  const res = await fetch(`/api/${path}?${qs}`)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

export const api = {
  search: (q: string, lang?: string) => get<Hit[]>('search', { q, lang }),
  reverse: (q: string) => get<ReverseHit[]>('reverse', { q }),
  entry: (word: string, lang: string) => get<Entry[]>('entry', { word, lang }),
  langs: () => get<Lang[]>('langs', {}),
}
