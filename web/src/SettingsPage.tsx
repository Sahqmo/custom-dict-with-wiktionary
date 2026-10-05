import { useEffect, useMemo, useState } from 'react'
import { api, type Lang } from './api'
import { t } from './i18n'
import { LOCALES } from './locales'
import { DEFAULTS, MAX_PREFERRED, PRESETS, accentContrast, isHex, resetSettings, updateSettings, useSettings, type Mode } from './settings'

const MODES = [
  { value: 'system', key: 'mode.system' },
  { value: 'light', key: 'mode.light' },
  { value: 'dark', key: 'mode.dark' },
] as const satisfies readonly { value: Mode; key: 'mode.system' | 'mode.light' | 'mode.dark' }[]

function Segmented({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={t('set.mode')}>
      {MODES.map((m) => (
        <button
          key={m.value}
          role="radio"
          aria-checked={value === m.value}
          className={value === m.value ? 'on' : ''}
          onClick={() => onChange(m.value)}
        >
          {t(m.key)}
        </button>
      ))}
    </div>
  )
}

/** 화면(UI) 언어. 사전 내용(정의·어원 등)은 바뀌지 않고 버튼·안내 문구만 바뀐다. */
function LanguagePanel() {
  const s = useSettings()
  return (
    <section className="panel">
      <h2>{t('set.language')}</h2>
      <p className="muted">{t('set.languageHelp')}</p>
      <div className="chips locale-chips" role="radiogroup" aria-label={t('set.language')}>
        {LOCALES.map((l) => (
          <button
            key={l.code}
            role="radio"
            aria-checked={s.locale === l.code}
            // lang 속성: 한·중·일 글자가 그 언어에 맞는 글리프로 그려지고 스크린리더가 올바른 발음으로 읽는다
            lang={l.code}
            className={`chip pick${s.locale === l.code ? ' on' : ''}`}
            onClick={() => updateSettings({ locale: l.code })}
          >
            {l.name}
          </button>
        ))}
      </div>
    </section>
  )
}

/** 색 하나를 고르는 입력: 색상 선택기 + HEX 직접 입력 */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value
  return (
    <div className="colorfield">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('set.pickColor', { label })} />
      <input
        className="hex"
        value={shown}
        spellCheck={false}
        maxLength={7}
        aria-label={t('set.hexValue', { label })}
        aria-invalid={draft !== null && !isHex(draft)}
        onChange={(e) => {
          const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
          setDraft(v)
          if (isHex(v)) onChange(v.toLowerCase())
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  )
}

/** 포인트 컬러가 그 모드의 배경 위에서 글자로 읽기 충분한지 알려 준다 */
function ContrastNote({ hex, scheme }: { hex: string; scheme: 'light' | 'dark' }) {
  const c = accentContrast(hex, scheme)
  const ok = c >= 4.5
  return (
    <p className={`contrast ${ok ? 'ok' : 'warn'}`}>
      {ok ? '✓' : '⚠'} {t('contrast.text', { n: c.toFixed(1) })}
      {ok ? '' : t('contrast.warn')}
    </p>
  )
}

/** 해당 모드로 강제 렌더되는 미리보기. 실제 페이지와 같은 토큰을 쓴다. */
function Preview({ scheme }: { scheme: 'light' | 'dark' }) {
  return (
    <div className="preview" data-scheme={scheme}>
      <div className="pv-head">
        <span className="pv-logo">Wiktionary</span>
        <span className="pv-search">{t('pv.search')}</span>
      </div>
      <div className="pv-body">
        <div className="pv-title">
          dictionary <span className="code">en</span>
        </div>
        <div className="pv-grad">
          <span className="grad">{t('hero.grad')}</span>
          {t('hero.rest')}
        </div>
        <span className="pv-pos">noun</span>
        <p>
          A reference work listing words, with <a href="#/settings" onClick={(e) => e.preventDefault()}>links</a> in the accent color.
        </p>
        <div className="pv-row">
          <button className="btn primary" tabIndex={-1}>{t('search.submit')}</button>
          <button className="btn" tabIndex={-1}>{t('pv.cancel')}</button>
          <span className="chip">synonym</span>
        </div>
      </div>
    </div>
  )
}

/** 자주 쓰는 언어: 검색 결과/자동완성에서 먼저 보이고, 랜덤 단어도 이 언어들에서 뽑는다 */
function PreferredLangs() {
  const s = useSettings()
  const [langs, setLangs] = useState<Lang[]>([])
  const [filter, setFilter] = useState('')
  useEffect(() => {
    api.langs().then(setLangs, () => {})
  }, [])

  const byCode = useMemo(() => new Map(langs.map((l) => [l.lang_code, l])), [langs])
  const full = s.preferredLangs.length >= MAX_PREFERRED
  const f = filter.trim().toLowerCase()
  // 이름(영어)이나 코드로 찾는다. 이름이 검색어로 시작하는 것을 먼저, 그다음 항목이 많은 언어 순.
  const matches = f
    ? langs
        .filter((l) => !s.preferredLangs.includes(l.lang_code) && (l.lang.toLowerCase().includes(f) || l.lang_code.toLowerCase() === f))
        .sort((a, b) => Number(b.lang.toLowerCase().startsWith(f)) - Number(a.lang.toLowerCase().startsWith(f)) || b.count - a.count)
        .slice(0, 8)
    : []

  const add = (code: string) => {
    if (full || s.preferredLangs.includes(code)) return
    updateSettings({ preferredLangs: [...s.preferredLangs, code] })
    setFilter('')
  }

  return (
    <section className="panel">
      <h2>{t('lang.preferred')}</h2>
      <p className="muted">{t('pref.help', { max: MAX_PREFERRED })}</p>

      {s.preferredLangs.length > 0 && (
        <div className="chips pref-chips">
          {s.preferredLangs.map((code) => (
            <span key={code} className="chip removable">
              {byCode.get(code)?.lang ?? code} <small>{code}</small>
              <button
                aria-label={t('pref.remove', { lang: byCode.get(code)?.lang ?? code })}
                onClick={() => updateSettings({ preferredLangs: s.preferredLangs.filter((c) => c !== code) })}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="pref-add">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={full ? t('pref.full', { max: MAX_PREFERRED }) : t('pref.placeholder')}
          disabled={full}
          aria-label={t('pref.find')}
        />
        {matches.length > 0 && (
          <ul className="pref-list" role="listbox" aria-label={t('pref.found')}>
            {matches.map((l) => (
              <li key={l.lang_code}>
                <button onClick={() => add(l.lang_code)}>
                  <span>{l.lang}</span>
                  <small>
                    {l.lang_code} · {t('pref.entries', { n: l.count.toLocaleString() })}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {f && matches.length === 0 && <p className="muted pref-none">{t('pref.none')}</p>}
      </div>
    </section>
  )
}

export default function SettingsPage() {
  const s = useSettings()
  const isDefault =
    s.mode === DEFAULTS.mode &&
    s.accentLight === DEFAULTS.accentLight &&
    s.accentDark === DEFAULTS.accentDark &&
    s.highlight === DEFAULTS.highlight &&
    s.preferredLangs.length === 0 &&
    s.locale === DEFAULTS.locale

  return (
    <div className="settings">
      <h1>{t('set.title')}</h1>
      <p className="muted lead">{t('set.lead')}</p>

      <LanguagePanel />

      <section className="panel">
        <h2>{t('set.mode')}</h2>
        <Segmented value={s.mode} onChange={(mode) => updateSettings({ mode })} />
      </section>

      <section className="panel">
        <h2>{t('set.accent')}</h2>
        <p className="muted">{t('set.accentHelp')}</p>
        <div className="presets">
          {PRESETS.map((p) => {
            const active = p.light === s.accentLight && p.dark === s.accentDark
            return (
              <button
                key={p.name}
                className={`preset${active ? ' on' : ''}`}
                title={p.name}
                aria-label={p.name}
                aria-pressed={active}
                onClick={() => updateSettings({ accentLight: p.light, accentDark: p.dark })}
              >
                <span className="swatch" style={{ background: `linear-gradient(135deg, ${p.light} 50%, ${p.dark} 50%)` }} />
                <span>{p.name}</span>
              </button>
            )
          })}
        </div>

        <div className="duo">
          <div>
            <h3>{t('set.lightMode')}</h3>
            <ColorField label={t('set.lightMode')} value={s.accentLight} onChange={(accentLight) => updateSettings({ accentLight })} />
            <ContrastNote hex={s.accentLight} scheme="light" />
            <Preview scheme="light" />
          </div>
          <div>
            <h3>{t('set.darkMode')}</h3>
            <ColorField label={t('set.darkMode')} value={s.accentDark} onChange={(accentDark) => updateSettings({ accentDark })} />
            <ContrastNote hex={s.accentDark} scheme="dark" />
            <Preview scheme="dark" />
          </div>
        </div>
      </section>

      <PreferredLangs />

      <section className="panel">
        <h2>{t('infl.title')}</h2>
        <label className="check">
          <input type="checkbox" checked={s.highlight} onChange={(e) => updateSettings({ highlight: e.target.checked })} />
          <span>
            {t('set.inflHl')}
            <small className="muted">{t('set.inflHlHelp')}</small>
          </span>
        </label>
        <p className="hl-sample">
          <span>
            parl<b className="m-end">ons</b>
          </span>
          <span>
            <b className="m-irr">allons</b>
          </span>
          <span>
            dom<b className="m-end">inus</b>
          </span>
        </p>
      </section>

      <div className="actions">
        <button className="btn" onClick={resetSettings} disabled={isDefault}>
          {t('set.reset')}
        </button>
        <a className="btn" href="#/">{t('set.back')}</a>
      </div>
    </div>
  )
}
