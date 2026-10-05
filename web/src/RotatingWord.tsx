import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { languageName, t } from './i18n'
import { getSettings } from './settings'

type Word = {
  /** 화면에 보이는 표기 */
  text: string
  /** 사전 언어 코드 (항목 페이지 링크용) */
  code: string
  /** 그 언어 자신의 이름 */
  native: string
  rtl?: boolean
  /** 항목 표제어가 보이는 표기와 다를 때 (간체 单词 → 번체 單詞 항목) */
  entry?: string
}

/** 각 언어로 "word"라는 뜻의 단어. 모두 사전 DB에 항목이 있는 것만 넣는다. 처음 보이는 단어는 현재 UI 언어의 것이다(startIndex). */
const WORDS: Word[] = [
  { text: '단어', code: 'ko', native: '한국어' },
  { text: 'word', code: 'en', native: 'English' },
  { text: 'Wort', code: 'de', native: 'Deutsch' },
  { text: 'mot', code: 'fr', native: 'Français' },
  { text: 'palabra', code: 'es', native: 'Español' },
  { text: 'parola', code: 'it', native: 'Italiano' },
  { text: 'palavra', code: 'pt', native: 'Português' },
  { text: 'слово', code: 'ru', native: 'Русский' },
  { text: '単語', code: 'ja', native: '日本語' },
  { text: '单词', code: 'zh', native: '中文', entry: '單詞' },
  { text: 'كلمة', code: 'ar', native: 'العربية', rtl: true },
  { text: 'מילה', code: 'he', native: 'עברית', rtl: true },
  { text: 'کلمه', code: 'fa', native: 'فارسی', rtl: true },
  { text: 'शब्द', code: 'hi', native: 'हिन्दी' },
  { text: 'শব্দ', code: 'bn', native: 'বাংলা' },
  { text: 'சொல்', code: 'ta', native: 'தமிழ்' },
  { text: 'คำ', code: 'th', native: 'ไทย' },
  { text: 'từ', code: 'vi', native: 'Tiếng Việt' },
  { text: 'kata', code: 'id', native: 'Bahasa Indonesia' },
  { text: 'kelime', code: 'tr', native: 'Türkçe' },
  { text: 'λέξη', code: 'el', native: 'Ελληνικά' },
  { text: 'woord', code: 'nl', native: 'Nederlands' },
  { text: 'ord', code: 'sv', native: 'Svenska' },
  { text: 'orð', code: 'is', native: 'Íslenska' },
  { text: 'sana', code: 'fi', native: 'Suomi' },
  { text: 'szó', code: 'hu', native: 'Magyar' },
  { text: 'słowo', code: 'pl', native: 'Polski' },
  { text: 'slovo', code: 'cs', native: 'Čeština' },
  { text: 'cuvânt', code: 'ro', native: 'Română' },
  { text: 'სიტყვა', code: 'ka', native: 'ქართული' },
  { text: 'բառ', code: 'hy', native: 'Հայերեն' },
  { text: 'verbum', code: 'la', native: 'Latina' },
  { text: 'vorto', code: 'eo', native: 'Esperanto' },
  { text: 'neno', code: 'sw', native: 'Kiswahili' },
  { text: 'gair', code: 'cy', native: 'Cymraeg' },
  { text: 'focal', code: 'ga', native: 'Gaeilge' },
]

const INTERVAL_MS = 5000
const ANIM_MS = 650

/**
 * 처음 보여 줄 단어: 현재 UI 언어의 "word" (한국어 화면이면 단어, 영어면 word, 독일어면 Wort …).
 * UI 언어 8개(ko en ja zh de fr es eo)는 모두 WORDS에 있다. 혹시 없으면 맨 앞 단어.
 */
const startIndex = () => Math.max(0, WORDS.findIndex((w) => w.code === getSettings().locale))

type Item = { id: number; idx: number; phase: 'idle' | 'enter' | 'leave' }

const shuffled = (xs: number[]) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 5초마다 현재 단어가 위로 밀려 나가고, 랜덤한 다른 언어의 "word"가 아래에서 올라온다.
 * 한 바퀴를 다 돌 때까지 같은 단어가 반복되지 않는다(연속 중복도 없다).
 * 클릭하면 그 단어의 항목 페이지로 이동한다. 마우스를 올리면(또는 키보드 포커스) 단어 위에 어떤 언어인지 페이드로 나타난다.
 * 마우스를 올리거나 포커스가 있는 동안은 넘어가지 않는다 (클릭하려는 순간에 바뀌지 않게).
 */
export default function RotatingWord({ hrefEntry }: { hrefEntry: (lang: string, word: string) => string }) {
  const [items, setItems] = useState<Item[]>(() => [{ id: 0, idx: startIndex(), phase: 'idle' }])
  const [width, setWidth] = useState<number>()
  const bag = useRef<number[]>([])
  const idRef = useRef(0)
  const idxRef = useRef(startIndex()) // 첫 전환 때 처음 단어가 다시 뽑히지 않게 현재 단어로 시작한다
  const paused = useRef(false)
  const nodeRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const next = () => {
      if (!bag.current.length) bag.current = shuffled(WORDS.map((_, i) => i).filter((i) => i !== idxRef.current))
      const idx = bag.current.pop()!
      idxRef.current = idx
      const id = ++idRef.current
      setItems((old) => [
        ...old.filter((i) => i.phase !== 'leave').map((i) => ({ ...i, phase: 'leave' as const })),
        { id, idx, phase: 'enter' },
      ])
      window.setTimeout(() => setItems((old) => old.filter((i) => i.phase !== 'leave').map((i) => ({ ...i, phase: 'idle' }))), ANIM_MS + 50)
    }
    const timer = window.setInterval(() => {
      if (!document.hidden && !paused.current) next() // 탭이 숨겨져 있거나 사용자가 올려 둔 동안은 넘기지 않는다
    }, INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  // 새 단어의 폭에 맞춰 컨테이너 폭을 부드럽게 바꾼다 (줄바꿈/가운데 정렬이 튀지 않게).
  const newest = items[items.length - 1]
  useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node) return
    const measure = () => setWidth(node.getBoundingClientRect().width)
    measure()
    const ro = new ResizeObserver(measure) // 글꼴이 늦게 로드돼도 다시 잰다
    ro.observe(node)
    return () => ro.disconnect()
  }, [newest.id])

  const cur = WORDS[newest.idx]
  // 언어 이름: 브라우저가 UI 언어로 알려 주는 이름(독일어 → German / ドイツ語 / alemán …), 모르면 그 언어 자신의 이름
  const langLabel = languageName(cur.code) ?? cur.native

  return (
    <a
      className="rw"
      style={width ? { width } : undefined}
      href={hrefEntry(cur.code, cur.entry ?? cur.text)}
      aria-label={t('rw.open', { text: cur.text, lang: langLabel })}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      <span className="rw-clip" aria-hidden="true">
        {items.map((it) => {
          const w = WORDS[it.idx]
          return (
            <span key={it.id} ref={it.id === newest.id ? nodeRef : undefined} className={`rw-item ${it.phase}`} dir={w.rtl ? 'rtl' : undefined}>
              {w.text}
            </span>
          )
        })}
      </span>
      {/* 어떤 언어인지: 평소엔 숨겨 두고 호버/포커스 때만 페이드로 보여준다 (스크린리더는 링크의 aria-label로 읽는다) */}
      <span className="rw-label" aria-hidden="true">
        {langLabel}
        {cur.native !== langLabel && <span className="rw-native"> · {cur.native}</span>}
      </span>
    </a>
  )
}
