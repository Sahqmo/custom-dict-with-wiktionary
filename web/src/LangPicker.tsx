import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Lang } from './api'
import { t } from './i18n'

type Row = { kind: 'lang'; code: string; label: string; count?: number } | { kind: 'head'; label: string }

const Svg = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
const GLOBE = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.5 3.7 5.5 3.7 9s-1.2 6.5-3.7 9c-2.5-2.5-3.7-5.5-3.7-9S9.5 5.5 12 3z'
const CHEVRON = 'M6 9l6 6 6-6'
const CHECK = 'M5 12.5l4.5 4.5L19 7.5'

/**
 * 검색창의 언어 필터. 기본 <select>는 목록 모양을 바꿀 수 없어서, 같은 역할(+ 즉석 검색, 자주 쓰는 언어 맨 위)을 하는 목록을 직접 만들었다.
 * 키보드: ↑↓ 이동 · Enter 선택 · Esc 닫기, 바깥을 누르면 닫힌다.
 */
export default function LangPicker({ langs, value, onChange, preferred }: { langs: Lang[]; value: string; onChange: (code: string) => void; preferred: string[] }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()

  const byCode = useMemo(() => new Map(langs.map((l) => [l.lang_code, l])), [langs])
  const current = value ? byCode.get(value) : undefined
  const label = current?.lang ?? t('lang.all')

  const rows: Row[] = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const match = (l: Lang) => !f || l.lang.toLowerCase().includes(f) || l.lang_code.toLowerCase().startsWith(f)
    const out: Row[] = []
    if (!f) out.push({ kind: 'lang', code: '', label: t('lang.all') })
    const pref = preferred.map((c) => byCode.get(c)).filter((l): l is Lang => !!l && match(l))
    if (pref.length) {
      out.push({ kind: 'head', label: t('lang.preferred') })
      for (const l of pref) out.push({ kind: 'lang', code: l.lang_code, label: l.lang, count: l.count })
    }
    const rest = langs.filter((l) => !preferred.includes(l.lang_code) && match(l))
    if (rest.length) {
      if (pref.length) out.push({ kind: 'head', label: t('lang.all') })
      for (const l of rest) out.push({ kind: 'lang', code: l.lang_code, label: l.lang, count: l.count })
    }
    return out
  }, [filter, langs, preferred, byCode])

  const selectable = useMemo(() => rows.flatMap((r, i) => (r.kind === 'lang' ? [i] : [])), [rows])

  const close = () => {
    setOpen(false)
    setFilter('')
  }
  const choose = (code: string) => {
    onChange(code)
    close()
  }

  // 열면 현재 선택 항목이 보이게 하고, 검색 칸에 포커스를 둔다
  useEffect(() => {
    if (!open) return
    const at = rows.findIndex((r) => r.kind === 'lang' && r.code === value)
    setActive(at >= 0 ? at : (selectable[0] ?? 0))
    input.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 검색어가 바뀌면 첫 결과를 가리킨다
  useEffect(() => {
    if (open) setActive(selectable[0] ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  useEffect(() => {
    if (!open) return
    const on = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      ;(root.current?.querySelector('.lp-trigger') as HTMLElement | null)?.focus()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!selectable.length) return
      const pos = selectable.indexOf(active)
      const next = selectable[(pos + (e.key === 'ArrowDown' ? 1 : -1) + selectable.length) % selectable.length]
      setActive(next)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = rows[active]
      if (r?.kind === 'lang') choose(r.code)
    }
  }

  return (
    <div className="lang-picker" ref={root}>
      <button
        type="button"
        className={`lp-trigger${value ? ' set' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${t('search.langFilter')}: ${label}`}
        title={t('search.langFilter')}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Svg d={GLOBE} />
        <span className="lp-label">{label}</span>
        <span className={`lp-chev${open ? ' up' : ''}`}>
          <Svg d={CHEVRON} size={14} />
        </span>
      </button>

      {open && (
        <div className="lp-panel" onKeyDown={onKeyDown}>
          <input
            ref={input}
            className="lp-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('lang.filter')}
            aria-label={t('search.langFilter')}
            aria-controls={id}
            aria-activedescendant={rows[active]?.kind === 'lang' ? `${id}-${active}` : undefined}
            role="combobox"
            aria-expanded="true"
            autoComplete="off"
            spellCheck={false}
          />
          <ul className="lp-list" id={id} role="listbox" ref={listRef}>
            {rows.map((r, i) =>
              r.kind === 'head' ? (
                <li key={`h${i}`} className="lp-head" role="presentation">
                  {r.label}
                </li>
              ) : (
                <li
                  key={`${r.code}-${i}`}
                  id={`${id}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={r.code === value}
                  className={`lp-item${i === active ? ' on' : ''}${r.code === value ? ' sel' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(r.code)}
                >
                  <span className="lp-name">{r.label}</span>
                  {r.count !== undefined && <span className="lp-count">{r.count.toLocaleString()}</span>}
                  {r.code === value && (
                    <span className="lp-check">
                      <Svg d={CHECK} size={15} />
                    </span>
                  )}
                </li>
              ),
            )}
            {selectable.length === 0 && <li className="lp-empty">{t('pref.none')}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
