import { useState } from 'react'
import { DEFAULTS, PRESETS, isHex, resetSettings, updateSettings, useSettings, type Mode } from './settings'

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

export default function SettingsPage() {
  const s = useSettings()
  const isDefault = s.mode === DEFAULTS.mode && s.accentLight === DEFAULTS.accentLight && s.accentDark === DEFAULTS.accentDark && s.highlight === DEFAULTS.highlight

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
            <Preview scheme="light" />
          </div>
          <div>
            <h3>다크 모드</h3>
            <ColorField label="다크 모드" value={s.accentDark} onChange={(accentDark) => updateSettings({ accentDark })} />
            <Preview scheme="dark" />
          </div>
        </div>
      </section>

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
