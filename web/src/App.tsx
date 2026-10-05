import { useEffect, useId, useMemo, useState } from 'react'
import { api, type Entry, type Hit, type InflTable, type Lang, type ReverseHit, type Suggestion } from './api'
import LibraryPage from './LibraryPage'
import { loadLibrary, recordVisit, toggleFavorite, useLibrary } from './library'
import RotatingWord from './RotatingWord'
import { HREF_LIBRARY, hrefEntry, hrefReverse, hrefSearch } from './routes'
import SettingsPage from './SettingsPage'
import { effectiveScheme, updateSettings, useSettings } from './settings'
import './App.css'

type Route =
  | { page: 'home' }
  | { page: 'settings' }
  | { page: 'library' }
  | { page: 'search'; q: string; lang: string }
  | { page: 'reverse'; q: string }
  | { page: 'entry'; lang: string; word: string }

function parseHash(): Route {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
  const [kind, ...rest] = h.split('/')
  if (kind === 'entry' && rest.length >= 2) return { page: 'entry', lang: rest[0], word: rest.slice(1).join('/') }
  if (kind === 'settings') return { page: 'settings' }
  if (kind === 'library') return { page: 'library' }
  if (kind === 'search') {
    const p = new URLSearchParams(rest.join('/'))
    return { page: 'search', q: p.get('q') ?? '', lang: p.get('lang') ?? '' }
  }
  if (kind === 'reverse') return { page: 'reverse', q: new URLSearchParams(rest.join('/')).get('q') ?? '' }
  return { page: 'home' }
}

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

/**
 * 비동기 데이터 훅. 결과에 "어느 요청(deps)의 것인지"를 붙여 둔다.
 * 예전에는 요청이 바뀌어도 이전 data를 loading 플래그가 켜질 때까지(=렌더 한 번 뒤의 effect) 그대로 돌려줘서,
 * 새 단어로 이동한 첫 렌더에서 "이전 단어의 데이터"를 "새 단어의 결과"로 착각하는 경쟁 상태가 있었다.
 * 지금은 deps가 달라진 즉시 loading=true, data=undefined 로 보인다.
 */
function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const key = JSON.stringify(deps)
  type S = { key: string; data?: T; error?: string; loading: boolean }
  const [state, setState] = useState<S>({ key, loading: true })
  useEffect(() => {
    let alive = true
    setState({ key, loading: true })
    fn().then(
      (data) => alive && setState({ key, data, loading: false }),
      (e) => alive && setState({ key, error: String(e), loading: false }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state.key === key ? state : { key, loading: true }
}

/* ---------------------------------- 아이콘 ---------------------------------- */

const Icon = ({ d, label, filled }: { d: string; label?: string; filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={!label} aria-label={label}>
    <path d={d} />
  </svg>
)
const ICON = {
  star: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z',
  bookmark: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z',
  shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
}

/** 탭/북마크/히스토리에서 구분되도록 화면마다 문서 제목을 바꾼다 */
function titleFor(r: Route): string {
  switch (r.page) {
    case 'entry':
      return `${r.word} · Wiktionary`
    case 'search':
      return r.q ? `${r.q} — 검색 · Wiktionary` : 'Personal Wiktionary'
    case 'reverse':
      return r.q ? `정의 검색: ${r.q} · Wiktionary` : 'Personal Wiktionary'
    case 'settings':
      return '설정 · Wiktionary'
    case 'library':
      return '내 단어 · Wiktionary'
    default:
      return 'Personal Wiktionary'
  }
}

/* ---------------------------------- 앱 ---------------------------------- */

export default function App() {
  const route = useRoute()
  const langs = useAsync(() => api.langs(), [])
  const settings = useSettings()
  const dark = effectiveScheme(settings.mode) === 'dark'

  useEffect(() => {
    document.title = titleFor(route)
  }, [route])

  // 즐겨찾기/기록을 서버에서 한 번 불러온다
  useEffect(() => {
    loadLibrary()
  }, [])

  // '/' 를 누르면 어디서든 검색창으로 (입력 중일 때는 그대로 글자로 입력된다)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const input = document.querySelector<HTMLInputElement>('.searchbar input')
      if (!input) return
      e.preventDefault()
      input.focus()
      input.select()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

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
            <a className="icon-btn" href={HREF_LIBRARY} title="내 단어 (즐겨찾기 · 기록)" aria-label="내 단어">
              <Icon d={ICON.bookmark} />
            </a>
            <a className="icon-btn" href="#/settings" title="설정" aria-label="설정">
              <Icon d={ICON.gear} />
            </a>
          </div>
        </div>
      </header>

      <main>
        {route.page === 'home' && <Home route={route} langs={langs.data ?? []} />}
        {route.page === 'settings' && <SettingsPage />}
        {route.page === 'library' && <LibraryPage />}
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
  const settings = useSettings()
  const lib = useLibrary()
  const [busy, setBusy] = useState(false)

  // 랜덤 단어: 자주 쓰는 언어가 있으면 그 안에서, 없으면 전체에서
  const random = async () => {
    setBusy(true)
    try {
      const r = await api.random(settings.preferredLangs.join(',') || undefined)
      location.hash = hrefEntry(r.lang_code, r.word)
    } catch {
      // 서버 오류면 그대로 둔다
    } finally {
      setBusy(false)
    }
  }

  const recent = lib.history.slice(0, 8)
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
        <button
          className="chip action"
          onClick={random}
          disabled={busy}
          title={settings.preferredLangs.length ? '자주 쓰는 언어에서 무작위로' : '모든 언어에서 무작위로'}
        >
          <Icon d={ICON.shuffle} /> 랜덤 단어
        </button>
      </div>
      {recent.length > 0 && (
        <div className="recent">
          <span className="muted">최근 본 단어</span>
          <div className="chips">
            {recent.map((h) => (
              <a key={`${h.lang_code}\t${h.word}`} className="chip" href={hrefEntry(h.lang_code, h.word)} title={h.lang}>
                {h.word}
              </a>
            ))}
            <a className="chip more" href={HREF_LIBRARY}>
              전체 보기
            </a>
          </div>
        </div>
      )}
    </section>
  )
}

function SearchBar({ route, langs, large }: { route: Route; langs: Lang[]; large?: boolean }) {
  const settings = useSettings()
  const prefer = settings.preferredLangs.join(',')
  const [mode, setMode] = useState<'word' | 'def'>(route.page === 'reverse' ? 'def' : 'word')
  const [q, setQ] = useState('')
  const [lang, setLang] = useState('')
  const [focused, setFocused] = useState(false)
  const [sugs, setSugs] = useState<Suggestion[]>([])
  const [active, setActive] = useState(-1)
  const [dismissed, setDismissed] = useState(false)
  const listId = useId()

  useEffect(() => {
    if (route.page === 'search') {
      setMode('word')
      setQ(route.q)
      setLang(route.lang)
    } else if (route.page === 'reverse') {
      setMode('def')
      setQ(route.q)
    }
    setDismissed(true) // 화면이 바뀌면 열려 있던 제안은 닫는다
  }, [route])

  // 자동완성: 입력이 멈춘 뒤(130ms)에 요청하고, 늦게 도착한 오래된 응답은 버린다.
  useEffect(() => {
    if (mode !== 'word' || !focused || !q.trim()) {
      setSugs([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      api.suggest(q.trim(), lang || undefined, prefer || undefined).then(
        (d) => alive && (setSugs(d), setActive(-1)),
        () => alive && setSugs([]),
      )
    }, 130)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, lang, mode, focused, prefer])

  const open = focused && !dismissed && mode === 'word' && sugs.length > 0

  // 한 언어로 특정되면 항목 페이지로, 여러 언어에 있는 철자면 검색 결과(언어별)로 보낸다
  const go = (sg: Suggestion) => {
    setDismissed(true)
    location.hash = sg.langs > 1 ? hrefSearch(sg.word, lang) : hrefEntry(sg.lang_code, sg.word)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    setDismissed(true)
    location.hash = mode === 'word' ? hrefSearch(q.trim(), lang) : hrefReverse(q.trim())
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!sugs.length || mode !== 'word') return
      e.preventDefault()
      if (!open) return setDismissed(false)
      const d = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (a + d + sugs.length) % sugs.length)
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setDismissed(true)
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault()
      go(sugs[active])
    }
  }

  const preferred = settings.preferredLangs.map((c) => langs.find((l) => l.lang_code === c)).filter((l): l is Lang => !!l)
  const rest = preferred.length ? langs.filter((l) => !settings.preferredLangs.includes(l.lang_code)) : langs
  const option = (l: Lang) => (
    <option key={l.lang_code} value={l.lang_code}>
      {l.lang} ({l.count.toLocaleString()})
    </option>
  )

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
        onChange={(e) => {
          setQ(e.target.value)
          setDismissed(false)
        }}
        onFocus={() => {
          setFocused(true)
          setDismissed(false)
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder={mode === 'word' ? '단어 검색 (모든 언어)' : '영어 정의로 검색 — 예: reference work listing words'}
        aria-label="검색어"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      {!focused && !q && <kbd className="kbd" aria-hidden="true" title="검색창으로 이동">/</kbd>}
      {mode === 'word' && (
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="언어 필터">
          <option value="">모든 언어</option>
          {preferred.length > 0 ? (
            <>
              <optgroup label="자주 쓰는 언어">{preferred.map(option)}</optgroup>
              <optgroup label="모든 언어">{rest.map(option)}</optgroup>
            </>
          ) : (
            langs.map(option)
          )}
        </select>
      )}
      <button className="go" type="submit" aria-label="검색">
        <Icon d={ICON.search} />
      </button>

      {open && (
        <ul className="suggest" id={listId} role="listbox" aria-label="자동완성">
          {sugs.map((sg, i) => (
            <li
              key={`${sg.word}\t${sg.lang_code}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'on' : ''}
              // mousedown에서 처리해야 입력창이 blur되면서 목록이 닫히기 전에 선택된다
              onMouseDown={(e) => {
                e.preventDefault()
                go(sg)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="s-word">{sg.word}</span>
              <span className="s-meta">
                {sg.langs > 1 ? (
                  <span className="pill">{sg.langs}개 언어</span>
                ) : (
                  <>
                    <span className="pill">{sg.lang}</span>
                    {sg.pos.slice(0, 2).map((p) => (
                      <span key={p} className="pill">
                        {p}
                      </span>
                    ))}
                  </>
                )}
                {MATCH_LABEL[sg.match] && <span className="badge">{MATCH_LABEL[sg.match]}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
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
  const prefer = useSettings().preferredLangs.join(',')
  const { data, loading, error } = useAsync(() => api.search(q, lang || undefined, prefer || undefined), [q, lang, prefer])
  const groups = useMemo(() => groupBy(data ?? [], (h) => `${h.lang_code}\t${h.lang}`), [data])

  // 언어를 고르지 않은 1~2글자 검색은 정확히 일치하는 것만 찾는다 (서버가 접두사 검색을 건너뜀).
  const shortHint = !lang && q.trim().length < 3

  if (loading || error || !data?.length)
    return (
      <Status
        loading={loading}
        error={error}
        empty={
          <>
            “{q}” 결과가 없습니다. <a href={hrefReverse(q)}>정의에서 찾아보기</a>
            {shortHint && <> · 짧은 검색어는 언어를 고르면 더 찾아볼 수 있어요.</>}
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
        {shortHint && ' · 짧은 검색어는 언어를 고르면 더 찾아볼 수 있어요.'}
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

  // useAsync는 새 요청을 기다리는 동안 이전 data를 그대로 둔다. 그 낡은 data로 판단하면 엉뚱한 곳으로 이동/기록하므로
  // (예: amare → amō 로 가는 순간 낡은 data의 표제어 amare 와 비교해 amare 로 되돌려 버림) 로딩이 끝난 data만 쓴다.
  const fresh = !loading && !error && !!data?.length

  // 뜻 없이 다른 항목으로 연결만 하는 항목(예: 간체 单词 → 번체 單詞). 목적지가 하나면 바로 따라간다.
  const onlyRedirects = fresh && data!.every((e) => e.pos === 'soft-redirect')
  const targets = onlyRedirects ? [...new Set(data!.flatMap((e) => e.relations.redirect ?? []))] : []
  const target = targets.length === 1 ? targets[0] : null
  useEffect(() => {
    if (target) location.replace(hrefEntry(lang, target)) // replace: 뒤로 가기에 빈 항목이 남지 않게
  }, [lang, target])

  // 열어 본 항목은 기록에 남긴다 (빈 리다이렉트는 제외)
  const lang0 = data?.[0]?.lang
  useEffect(() => {
    if (fresh && data![0].word === word && !onlyRedirects && lang0) recordVisit(lang, word, lang0)
  }, [data, fresh, onlyRedirects, lang, word, lang0])
  const lib = useLibrary()
  const fav = lib.favorites.some((f) => f.lang_code === lang && f.word === word)

  // 요청한 표기(amō)와 실제 표제어(amo)가 다르면 서버가 정규화로 찾아 준 것이다 → 주소를 실제 표제어로 바꾼다.
  const canonical = fresh && data![0].word !== word ? data![0].word : null
  useEffect(() => {
    if (canonical) location.replace(hrefEntry(lang, canonical))
  }, [lang, canonical])

  if (target || canonical) return <Status loading error={undefined} empty={null} />
  if (loading || error || !data?.length) return <Status loading={loading} error={error} empty="항목이 없습니다." />

  return (
    <article>
      <header className="entry-head">
        <h1>{word}</h1>
        <span className="code lg">{data[0].lang}</span>
        <button
          className={`star${fav ? ' on' : ''}`}
          onClick={() => toggleFavorite(lang, word, data[0].lang)}
          aria-pressed={fav}
          title={fav ? '즐겨찾기에서 빼기' : '즐겨찾기에 담기'}
          aria-label={fav ? '즐겨찾기에서 빼기' : '즐겨찾기에 담기'}
        >
          <Icon d={ICON.star} filled={fav} />
        </button>
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
  if (e.pos === 'soft-redirect') {
    const to = e.relations.redirect ?? []
    return (
      <section className="card entry">
        <h2 className="entry-pos">
          <span className="posname">연결 항목</span>
        </h2>
        <p className="muted">{to.length ? '이 표기는 다른 항목으로 연결됩니다.' : '이 표기는 다른 항목으로 연결되지만 목적지 정보가 없습니다.'}</p>
        <div className="chips">
          {to.map((w) => (
            <a key={w} className="chip" href={hrefEntry(e.lang_code, w)}>
              {w}
            </a>
          ))}
        </div>
      </section>
    )
  }
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
