import { useMemo, useState } from 'react'
import { api, type SwadeshLang } from './api'
import { t } from './i18n'
import { hrefEntry, hrefSwadesh } from './routes'
import { useSettings } from './settings'
import { useAsync } from './useAsync'

const Notice = ({ children }: { children: React.ReactNode }) => <p className="muted swa-notice">{children}</p>

/** 서버가 503이면 데이터 파일이 없는 것이다 */
const missingData = (error?: string) => !!error && /503/.test(error)

/* ---------------------------- 언어 고르기 ---------------------------- */

export function SwadeshIndex() {
  const preferred = useSettings().preferredLangs
  const { data, loading, error } = useAsync((signal) => api.swadeshLangs(signal), [])
  const [filter, setFilter] = useState('')

  const { pref, rest } = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const match = (l: SwadeshLang) => !f || l.lang.toLowerCase().includes(f) || l.lang_code.toLowerCase().startsWith(f)
    const all = (data?.langs ?? []).filter(match)
    const pref = preferred.map((c) => all.find((l) => l.lang_code === c)).filter((l): l is SwadeshLang => !!l)
    return { pref, rest: all.filter((l) => !preferred.includes(l.lang_code)) }
  }, [data, filter, preferred])

  const card = (l: SwadeshLang) => (
    <a key={l.lang_code} className="swa-lang" href={hrefSwadesh(l.lang_code)}>
      <span className="swa-lang-name">{l.lang}</span>
      <span className="swa-lang-meta">
        <span className="code">{l.lang_code}</span>
        <span className="swa-count">{t('swa.filled', { n: l.filled, total: data?.total ?? 207 })}</span>
      </span>
    </a>
  )

  return (
    <section className="swadesh">
      <h1>{t('swa.title')}</h1>
      <p className="muted">{t('swa.sub')}</p>
      <input
        className="swa-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t('lang.filter')}
        aria-label={t('lang.filter')}
        autoComplete="off"
        spellCheck={false}
      />
      {loading && <Notice>…</Notice>}
      {missingData(error) && <Notice>{t('swa.unavailable')}</Notice>}
      {error && !missingData(error) && <p className="error swa-notice">{error}</p>}
      {data && pref.length > 0 && (
        <>
          <h2 className="sec-title">{t('lang.preferred')}</h2>
          <div className="swa-grid">{pref.map(card)}</div>
        </>
      )}
      {data && rest.length > 0 && (
        <>
          {pref.length > 0 && <h2 className="sec-title more">{t('lang.all')}</h2>}
          <div className="swa-grid">{rest.map(card)}</div>
        </>
      )}
      {data && pref.length + rest.length === 0 && <Notice>{t('pref.none')}</Notice>}
    </section>
  )
}

/* ---------------------------- 한 언어의 목록 ---------------------------- */

export function SwadeshLangPage({ lang }: { lang: string }) {
  const { data, loading, error } = useAsync((signal) => api.swadeshList(lang, signal), [lang])
  const [coreOnly, setCoreOnly] = useState(false)

  if (loading) return <Notice>…</Notice>
  if (error || !data)
    return (
      <section className="swadesh">
        <a className="swa-back" href={hrefSwadesh()}>
          {t('swa.back')}
        </a>
        <Notice>{missingData(error) ? t('swa.unavailable') : t('entry.none')}</Notice>
      </section>
    )

  const items = coreOnly ? data.items.filter((i) => i.core) : data.items
  const coreCount = data.items.filter((i) => i.core).length

  return (
    <section className="swadesh">
      <a className="swa-back" href={hrefSwadesh()}>
        {t('swa.back')}
      </a>
      <header className="swa-head">
        <h1>
          {data.lang} <span className="code">{data.lang_code}</span>
        </h1>
        <div className="seg-mini swa-seg" role="radiogroup" aria-label={t('swa.title')}>
          <button type="button" role="radio" aria-checked={!coreOnly} className={!coreOnly ? 'on' : ''} onClick={() => setCoreOnly(false)}>
            {t('swa.all', { n: data.total })}
          </button>
          <button type="button" role="radio" aria-checked={coreOnly} className={coreOnly ? 'on' : ''} onClick={() => setCoreOnly(true)}>
            {t('swa.core', { n: coreCount })}
          </button>
        </div>
      </header>
      <p className="muted swa-sum">
        {t('swa.filled', { n: data.filled, total: data.total })} · {t('swa.note')}
      </p>

      <div className="card swa-card">
        <table className="swa-table">
          <thead>
            <tr>
              <th className="swa-n">#</th>
              <th>{t('swa.meaning')}</th>
              <th>{t('swa.word')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.n} className={it.words.length ? undefined : 'swa-empty'}>
                <td className="swa-n">{it.n}</td>
                <td className="swa-meaning">{it.label}</td>
                <td>
                  {it.words.length === 0 ? (
                    <span className="swa-none">—</span>
                  ) : (
                    <ul className="swa-words">
                      {it.words.map((w) => (
                        <li key={w.word}>
                          {w.exists ? (
                            <a className="swa-word" href={hrefEntry(data.lang_code, w.word)}>
                              {w.word}
                            </a>
                          ) : (
                            <span className="swa-word dead" title={t('rel.missing')}>
                              {w.word}
                            </span>
                          )}
                          {w.roman && <span className="swa-roman">{w.roman}</span>}
                          {w.tags && <span className="swa-tags">{w.tags}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
