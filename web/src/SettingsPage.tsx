import { useEffect, useMemo, useState } from 'react'
import { api, type Lang } from './api'
import { DEFAULTS, MAX_PREFERRED, PRESETS, accentContrast, isHex, resetSettings, updateSettings, useSettings, type Mode } from './settings'

const MODES: { value: Mode; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

function Segmented({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="화면 모드">
      {MODES.map((m) => (
        <button
          key={m.value}
          role="radio"
          aria-checked={value === m.value}
          className={value === m.value ? 'on' : ''}
          onClick={() => onChange(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

/** 색 하나를 고르는 입력: 색상 선택기 + HEX 직접 입력 */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value
  return (
    <div className="colorfield">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} 색상 선택`} />
      <input
        className="hex"
        value={shown}
        spellCheck={false}
        maxLength={7}
        aria-label={`${label} HEX 값`}
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
      {ok ? '✓' : '⚠'} 글자 대비 {c.toFixed(1)}:1{ok ? '' : ' — 링크/강조 글자가 읽기 어려울 수 있어요 (권장 4.5 이상)'}
    </p>
  )
}

/** 해당 모드로 강제 렌더되는 미리보기. 실제 페이지와 같은 토큰을 쓴다. */
function Preview({ scheme }: { scheme: 'light' | 'dark' }) {
  return (
    <div className="preview" data-scheme={scheme}>
      <div className="pv-head">
        <span className="pv-logo">Wiktionary</span>
        <span className="pv-search">단어 검색</span>
      </div>
      <div className="pv-body">
        <div className="pv-title">
          dictionary <span className="code">en</span>
        </div>
        <div className="pv-grad">
          <span className="grad">한 곳에서</span> 찾아보세요
        </div>
        <span className="pv-pos">noun</span>
        <p>
          A reference work listing words, with <a href="#/settings" onClick={(e) => e.preventDefault()}>links</a> in the accent color.
        </p>
        <div className="pv-row">
          <button className="btn primary" tabIndex={-1}>검색</button>
          <button className="btn" tabIndex={-1}>취소</button>
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
      <h2>자주 쓰는 언어</h2>
      <p className="muted">
        여기 담은 언어는 검색 결과와 자동완성에서 먼저 보이고, 언어 선택 목록 맨 위에 나오며, 홈의 랜덤 단어도 이 언어들에서 뽑습니다. (최대 {MAX_PREFERRED}개)
      </p>

      {s.preferredLangs.length > 0 && (
        <div className="chips pref-chips">
          {s.preferredLangs.map((code) => (
            <span key={code} className="chip removable">
              {byCode.get(code)?.lang ?? code} <small>{code}</small>
              <button
                aria-label={`${byCode.get(code)?.lang ?? code} 빼기`}
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
          placeholder={full ? `최대 ${MAX_PREFERRED}개까지 담을 수 있어요` : '언어 이름(영어)이나 코드로 찾기 — 예: german, ko'}
          disabled={full}
          aria-label="자주 쓰는 언어 찾기"
        />
        {matches.length > 0 && (
          <ul className="pref-list" role="listbox" aria-label="검색된 언어">
            {matches.map((l) => (
              <li key={l.lang_code}>
                <button onClick={() => add(l.lang_code)}>
                  <span>{l.lang}</span>
                  <small>
                    {l.lang_code} · {l.count.toLocaleString()}개
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {f && matches.length === 0 && <p className="muted pref-none">일치하는 언어가 없어요.</p>}
      </div>
    </section>
  )
}

export default function SettingsPage() {
  const s = useSettings()
  const isDefault = s.mode === DEFAULTS.mode && s.accentLight === DEFAULTS.accentLight && s.accentDark === DEFAULTS.accentDark && s.highlight === DEFAULTS.highlight && s.preferredLangs.length === 0

  return (
    <div className="settings">
      <h1>설정</h1>
      <p className="muted lead">이 브라우저에 저장됩니다. 라이트/다크 모드의 포인트 컬러를 따로 지정할 수 있습니다.</p>

      <section className="panel">
        <h2>화면 모드</h2>
        <Segmented value={s.mode} onChange={(mode) => updateSettings({ mode })} />
      </section>

      <section className="panel">
        <h2>포인트 컬러</h2>
        <p className="muted">프리셋을 고르면 라이트/다크 모두 읽기 좋은 톤으로 바뀝니다. 아래에서 직접 지정할 수도 있습니다.</p>
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
            <h3>라이트 모드</h3>
            <ColorField label="라이트 모드" value={s.accentLight} onChange={(accentLight) => updateSettings({ accentLight })} />
            <ContrastNote hex={s.accentLight} scheme="light" />
            <Preview scheme="light" />
          </div>
          <div>
            <h3>다크 모드</h3>
            <ColorField label="다크 모드" value={s.accentDark} onChange={(accentDark) => updateSettings({ accentDark })} />
            <ContrastNote hex={s.accentDark} scheme="dark" />
            <Preview scheme="dark" />
          </div>
        </div>
      </section>

      <PreferredLangs />

      <section className="panel">
        <h2>굴절표</h2>
        <label className="check">
          <input type="checkbox" checked={s.highlight} onChange={(e) => updateSettings({ highlight: e.target.checked })} />
          <span>
            동사 변화에서 굴절하는 부분 강조
            <small className="muted">
              어간 뒤의 어미를 포인트 컬러 볼드체로, 불규칙 형태는 단어 전체를 강조합니다.
            </small>
          </span>
        </label>
        <p className="hl-sample">
          <span>parl<b className="m-end">ons</b></span>
          <span><b className="m-irr">allons</b> → <span>all<b className="m-end">ons</b></span></span>
        </p>
      </section>

      <div className="actions">
        <button className="btn" onClick={resetSettings} disabled={isDefault}>
          기본값으로 되돌리기
        </button>
        <a className="btn" href="#/">돌아가기</a>
      </div>
    </div>
  )
}
