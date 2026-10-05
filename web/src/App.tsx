import { useEffect, useMemo, useState } from 'react'
import { api, type Entry, type Hit, type InflTable, type Lang, type ReverseHit } from './api'
import RotatingWord from './RotatingWord'
import SettingsPage from './SettingsPage'
import { effectiveScheme, updateSettings, useSettings } from './settings'
import './App.css'

type Route =
  | { page: 'home' }
  | { page: 'settings' }
  | { page: 'search'; q: string; lang: string }
  | { page: 'reverse'; q: string }
  | { page: 'entry'; lang: string; word: string }

function parseHash(): Route {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
  const [kind, ...rest] = h.split('/')
  if (kind === 'entry' && rest.length >= 2) return { page: 'entry', lang: rest[0], word: rest.slice(1).join('/') }
  if (kind === 'settings') return { page: 'settings' }
  if (kind === 'search') {
    const p = new URLSearchParams(rest.join('/'))
    return { page: 'search', q: p.get('q') ?? '', lang: p.get('lang') ?? '' }
  }
  if (kind === 'reverse') return { page: 'reverse', q: new URLSearchParams(rest.join('/')).get('q') ?? '' }
  return { page: 'home' }
}

const hrefEntry = (lang: string, word: string) => `#/entry/${lang}/${encodeURIComponent(word)}`
const hrefSearch = (q: string, lang: string) => `#/search/${new URLSearchParams({ q, ...(lang && { lang }) })}`
const hrefReverse = (q: string) => `#/reverse/${new URLSearchParams({ q })}`

function useRoute() {
  const [route, setRoute] = useState<Route>(parseHash)
  useEffect(() => {
    const on = () => {
      setRoute(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: undefined }))
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (e) => alive && setState({ error: String(e), loading: false }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

/* ---------------------------------- 아이콘 ---------------------------------- */

const Icon = ({ d, label }: { d: string; label?: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={!label} aria-label={label}>
    <path d={d} />
  </svg>
)
const ICON = {
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
}

/* ---------------------------------- 앱 ---------------------------------- */

export default function App() {
  const route = useRoute()
  const langs = useAsync(() => api.langs(), [])
  const settings = useSettings()
  const dark = effectiveScheme(settings.mode) === 'dark'

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <a className="brand" href="#/">
            <span className="mark">W</span>
            <span className="brand-name">Wiktionary</span>
          </a>
          {route.page !== 'home' && <SearchBar route={route} langs={langs.data ?? []} />}
          <div className="top-actions">
            <button
              className="icon-btn"
              title={dark ? '라이트 모드로' : '다크 모드로'}
              aria-label="라이트/다크 전환"
              onClick={() => updateSettings({ mode: dark ? 'light' : 'dark' })}
            >
              <Icon d={dark ? ICON.sun : ICON.moon} />
            </button>
            <a className="icon-btn" href="#/settings" title="설정" aria-label="설정">
              <Icon d={ICON.gear} />
            </a>
          </div>
        </div>
      </header>

      <main>
        {route.page === 'home' && <Home route={route} langs={langs.data ?? []} />}
        {route.page === 'settings' && <SettingsPage />}
        {route.page === 'search' && <SearchResults q={route.q} lang={route.lang} />}
        {route.page === 'reverse' && <ReverseResults q={route.q} />}
        {route.page === 'entry' && <EntryPage lang={route.lang} word={route.word} />}
      </main>

      <footer>
        내용 출처: <a href="https://en.wiktionary.org">English Wiktionary</a> 기여자들 (
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>) · 데이터 가공:{' '}
        <a href="https://kaikki.org">kaikki.org</a> (Wiktextract)
      </footer>
    </>
  )
}

const EXAMPLES: { q: string; lang?: string }[] = [
  { q: 'dictionary' },
  { q: 'Straße', lang: 'de' },
  { q: 'parler', lang: 'fr' },
  { q: 'hablar', lang: 'es' },
  { q: '사전', lang: 'ko' },
  { q: '辞書', lang: 'ja' },
]

function Home({ route, langs }: { route: Route; langs: Lang[] }) {
  return (
    <section className="hero">
      <h1>
        <span className="h1-line">
          모든 언어의 <RotatingWord hrefEntry={hrefEntry} />
          <span className="particle">를</span>
        </span>
        <br />
        <span className="grad">한 곳에서</span> 찾아보세요
      </h1>
      <p className="muted">정의 · 어원 · 발음 · 활용표를 영어 Wiktionary 기준으로 보여 드립니다.</p>
      <SearchBar route={route} langs={langs} large />
      <div className="example-chips">
        {EXAMPLES.map((e) => (
          <a key={e.q} className="chip" href={hrefSearch(e.q, e.lang ?? '')}>
            {e.q}
          </a>
        ))}
      </div>
    </section>
  )
}

function SearchBar({ route, langs, large }: { route: Route; langs: Lang[]; large?: boolean }) {
  const [mode, setMode] = useState<'word' | 'def'>(route.page === 'reverse' ? 'def' : 'word')
  const [q, setQ] = useState('')
  const [lang, setLang] = useState('')

  useEffect(() => {
    if (route.page === 'search') {
      setMode('word')
      setQ(route.q)
      setLang(route.lang)
    } else if (route.page === 'reverse') {
      setMode('def')
      setQ(route.q)
    }
  }, [route])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    location.hash = mode === 'word' ? hrefSearch(q.trim(), lang) : hrefReverse(q.trim())
  }

  return (
    <form className={`searchbar${large ? ' large' : ''}`} onSubmit={submit} role="search">
      <div className="seg-mini" role="radiogroup" aria-label="검색 방식">
        <button type="button" role="radio" aria-checked={mode === 'word'} className={mode === 'word' ? 'on' : ''} onClick={() => setMode('word')}>
          단어
        </button>
        <button type="button" role="radio" aria-checked={mode === 'def'} className={mode === 'def' ? 'on' : ''} onClick={() => setMode('def')}>
          정의
        </button>
      </div>
      <input
        autoFocus={large}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={mode === 'word' ? '단어 검색 (모든 언어)' : '영어 정의로 검색 — 예: reference work listing words'}
        aria-label="검색어"
      />
      {mode === 'word' && (
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="언어 필터">
          <option value="">모든 언어</option>
          {langs.map((l) => (
            <option key={l.lang_code} value={l.lang_code}>
              {l.lang} ({l.count.toLocaleString()})
            </option>
          ))}
        </select>
      )}
      <button className="go" type="submit" aria-label="검색">
        <Icon d={ICON.search} />
      </button>
    </form>
  )
}

const MATCH_LABEL: Record<Hit['match'], string> = {
  exact: '',
  normalized: '철자 근사',
  form: '활용형 → 원형',
  prefix: '접두사',
}

function groupBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>()
  for (const it of items) {
    const k = key(it)
    const list = m.get(k)
    if (list) list.push(it)
    else m.set(k, [it])
  }
  return [...m.entries()]
}

function Status({ loading, error, empty }: { loading: boolean; error?: string; empty?: React.ReactNode }) {
  if (loading) return <p className="muted status">불러오는 중…</p>
  if (error) return <p className="error status">{error}</p>
  return <p className="muted status">{empty}</p>
}

function SearchResults({ q, lang }: { q: string; lang: string }) {
  const { data, loading, error } = useAsync(() => api.search(q, lang || undefined), [q, lang])
  const groups = useMemo(() => groupBy(data ?? [], (h) => `${h.lang_code}\t${h.lang}`), [data])

  if (loading || error || !data?.length)
    return (
      <Status
        loading={loading}
        error={error}
        empty={
          <>
            “{q}” 결과가 없습니다. <a href={hrefReverse(q)}>정의에서 찾아보기</a>
          </>
        }
      />
    )

  // 결과가 정확히 일치하는 항목 하나뿐이면 바로 항목 페이지를 보여 준다.
  if (data.length === 1 && data[0].match === 'exact') return <EntryPage lang={data[0].lang_code} word={data[0].word} />

  return (
    <div className="results">
      <p className="muted count">
        “{q}” 결과 {data.length}개 · {groups.length}개 언어
      </p>
      {groups.map(([k, hits]) => {
        const [code, name] = k.split('\t')
        return (
          <section key={k} className="card">
            <h2 className="lang">
              {name} <span className="code">{code}</span>
            </h2>
            <ul>
              {hits.map((h) => (
                <li key={h.word}>
                  <a className="row" href={hrefEntry(h.lang_code, h.word)}>
                    <span className="w">{h.word}</span>
                    <span className="meta">
                      {h.pos.map((p) => (
                        <span key={p} className="pill">
                          {p}
                        </span>
                      ))}
                      {MATCH_LABEL[h.match] && <span className="badge">{MATCH_LABEL[h.match]}</span>}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function ReverseResults({ q }: { q: string }) {
  const { data, loading, error } = useAsync(() => api.reverse(q), [q])
  if (loading || error || !data?.length) return <Status loading={loading} error={error} empty={<>“{q}”에 해당하는 정의가 없습니다.</>} />
  return (
    <div className="results">
      <p className="muted count">정의 검색 “{q}” · {data.length}개</p>
      <section className="card">
        <ul className="reverse">
          {data.map((r: ReverseHit, i) => (
            <li key={i}>
              <a className="row col" href={hrefEntry(r.lang_code, r.word)}>
                <span className="w">
                  {r.word}
                  <span className="meta">
                    <span className="pill">{r.lang}</span>
                    {r.pos && <span className="pill">{r.pos}</span>}
                  </span>
                </span>
                <span className="gloss">{r.gloss}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function WordLink({ lang, word }: { lang: string; word: string }) {
  return <a href={hrefEntry(lang, word)}>{word}</a>
}

function EntryPage({ lang, word }: { lang: string; word: string }) {
  const { data, loading, error } = useAsync(() => api.entry(word, lang), [lang, word])
  if (loading || error || !data?.length) return <Status loading={loading} error={error} empty="항목이 없습니다." />

  return (
    <article>
      <header className="entry-head">
        <h1>{word}</h1>
        <span className="code lg">{data[0].lang}</span>
      </header>
      {data.map((e, i) => (
        <EntryBlock key={i} e={e} />
      ))}
    </article>
  )
}

function InflTableView({ t }: { t: InflTable }) {
  const hasHeader = t.cols.length > 1 || t.cols[0] !== ''
  return (
    <div className="infl">
      <h4>{t.title}</h4>
      <div className="table-scroll">
        <table>
          {hasHeader && (
            <thead>
              <tr>
                <th />
                {t.cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={i}>
                <th scope="row">{r.label}</th>
                {r.cells.map((cell, j) => (
                  <td key={j}>
                    {cell.length === 0
                      ? <span className="empty">·</span>
                      : cell.map((x, k) => (
                          <div key={k} className={x.note ? 'variant' : undefined}>
                            {x.article && <span className="art">{x.article.endsWith("'") ? x.article : `${x.article} `}</span>}
                            {x.parts
                              ? x.parts.map((p, n) => (
                                  <span key={n} className={p.m === 'e' ? 'm-end' : p.m === 'i' ? 'm-irr' : undefined}>
                                    {p.t}
                                  </span>
                                ))
                              : x.form}
                            {x.note && <small> {x.note}</small>}
                          </div>
                        ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 같은 group의 표는 접이식으로 묶는다 (예: 독일어 형용사의 원급/비교급/최상급). */
function InflectionTables({ tables }: { tables: InflTable[] }) {
  const blocks: { group?: string; items: InflTable[] }[] = []
  for (const t of tables) {
    const last = blocks[blocks.length - 1]
    if (last && last.group === t.group) last.items.push(t)
    else blocks.push({ group: t.group, items: [t] })
  }
  const firstGrouped = blocks.findIndex((x) => x.group)
  const hasMarks = tables.some((t) => t.rows.some((r) => r.cells.some((c) => c.some((x) => x.parts))))
  return (
    <>
      {hasMarks && (
        <p className="legend">
          <span><b className="m-end">어미</b> 굴절하는 부분</span>
          <span><b className="m-irr">불규칙</b> 어간까지 달라진 형태</span>
        </p>
      )}
      {blocks.map((b, i) =>
        b.group ? (
          <details key={i} open={i === firstGrouped} className="infl-group">
            <summary>{b.group}</summary>
            <div className="infl-grid">{b.items.map((t, j) => <InflTableView key={j} t={t} />)}</div>
          </details>
        ) : (
          <div key={i} className="infl-grid">
            {b.items.map((t, j) => (
              <InflTableView key={j} t={t} />
            ))}
          </div>
        ),
      )}
    </>
  )
}

/** 표에 들어가지 못한 활용형. 스페인어의 대명사 결합형은 양이 많아 따로 접는다. */
function FormList({ forms, lang, hasTables }: { forms: Entry['forms']; lang: string; hasTables: boolean }) {
  const combined = forms.filter((f) => f.tags.includes('combined-form'))
  const rest = forms.filter((f) => !f.tags.includes('combined-form'))
  const list = (items: Entry['forms']) => (
    <table className="forms">
      <tbody>
        {items.map((f, i) => (
          <tr key={i}>
            <td>
              <WordLink lang={lang} word={f.form} />
            </td>
            <td className="tags">{f.tags.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return (
    <>
      {rest.length > 0 && (
        <details className="fold">
          <summary>
            {hasTables ? '그 밖의 형태' : '활용형'} <span className="count-pill">{rest.length}</span>
          </summary>
          {list(rest)}
        </details>
      )}
      {combined.length > 0 && (
        <details className="fold">
          <summary>
            대명사 결합형 <span className="count-pill">{combined.length}</span>
          </summary>
          {list(combined)}
        </details>
      )}
    </>
  )
}

const REL_ORDER = ['form_of', 'alt_of', 'synonyms', 'antonyms', 'hypernyms', 'hyponyms', 'coordinate_terms', 'derived', 'related']
const REL_LABEL: Record<string, string> = {
  form_of: '원형', alt_of: '대체 표기 대상', synonyms: '동의어', antonyms: '반의어', hypernyms: '상위어',
  hyponyms: '하위어', coordinate_terms: '동위어', derived: '파생어', related: '관련어',
}

function EntryBlock({ e }: { e: Entry }) {
  const ipa = e.sounds.filter((s) => s.ipa)
  const audio = e.sounds.find((s) => s.audio_ogg || s.audio_mp3)

  return (
    <section className="card entry">
      <h2 className="entry-pos">
        <span className="posname">{e.pos}</span>
        {e.etymology_number ? <span className="code">어원 {e.etymology_number}</span> : null}
      </h2>
      {e.head && <p className="head">{e.head}</p>}

      {(ipa.length > 0 || audio) && (
        <div className="sounds">
          {ipa.slice(0, 6).map((s, i) => (
            <span key={i} className="ipa">
              {s.ipa}
              {s.tags.length > 0 && <small>{s.tags.join(', ')}</small>}
            </span>
          ))}
          {audio && (
            <audio controls preload="none">
              {audio.audio_ogg && <source src={audio.audio_ogg} type="audio/ogg" />}
              {audio.audio_mp3 && <source src={audio.audio_mp3} type="audio/mpeg" />}
            </audio>
          )}
        </div>
      )}

      <ol className="senses">
        {e.senses.map((s, i) => (
          <li key={i}>
            <div className="sense-body">
              {s.glosses.length > 1 && <div className="parent">{s.glosses.slice(0, -1).join(' ')}</div>}
              <span>{s.glosses[s.glosses.length - 1]}</span>
              {s.tags.length > 0 && (
                <span className="sense-tags">
                  {s.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </span>
              )}
              {s.examples.length > 0 && (
                <details className="examples">
                  <summary>예문 {s.examples.length}</summary>
                  {s.examples.map((x, j) => (
                    <blockquote key={j}>
                      {x.text}
                      {x.ref && <cite>{x.ref}</cite>}
                    </blockquote>
                  ))}
                </details>
              )}
            </div>
          </li>
        ))}
      </ol>

      {e.etymology && (
        <details open className="fold">
          <summary>어원</summary>
          <p className="ety">{e.etymology}</p>
        </details>
      )}

      {e.tables.length > 0 && (
        <details open className="fold infl-wrap">
          <summary>굴절표</summary>
          <InflectionTables tables={e.tables} />
        </details>
      )}

      <FormList forms={e.forms} lang={e.lang_code} hasTables={e.tables.length > 0} />

      {REL_ORDER.filter((k) => e.relations[k]?.length).map((k) => (
        <div key={k} className="rel">
          <strong>{REL_LABEL[k]}</strong>
          <div className="chips">
            {e.relations[k].map((w) => (
              <a key={w} className="chip" href={hrefEntry(e.lang_code, w)}>
                {w}
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
