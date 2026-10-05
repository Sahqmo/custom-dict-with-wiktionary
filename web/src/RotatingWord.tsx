import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type Word = {
  /** 화면에 보이는 표기 */
  text: string
  /** 사전 언어 코드 (항목 페이지 링크용) */
  code: string
  /** 한국어로 된 언어 이름 */
  ko: string
  /** 그 언어 자신의 이름 */
  native: string
  rtl?: boolean
  /** 항목 표제어가 보이는 표기와 다를 때 (간체 单词 → 번체 單詞 항목) */
  entry?: string
}

/** 각 언어로 "word"라는 뜻의 단어. 모두 사전 DB에 항목이 있는 것만 넣는다. 첫 항목(한국어)으로 시작한다. */
const WORDS: Word[] = [
  { text: '단어', code: 'ko', ko: '한국어', native: '한국어' },
  { text: 'word', code: 'en', ko: '영어', native: 'English' },
  { text: 'Wort', code: 'de', ko: '독일어', native: 'Deutsch' },
  { text: 'mot', code: 'fr', ko: '프랑스어', native: 'Français' },
  { text: 'palabra', code: 'es', ko: '스페인어', native: 'Español' },
  { text: 'parola', code: 'it', ko: '이탈리아어', native: 'Italiano' },
  { text: 'palavra', code: 'pt', ko: '포르투갈어', native: 'Português' },
  { text: 'слово', code: 'ru', ko: '러시아어', native: 'Русский' },
  { text: '単語', code: 'ja', ko: '일본어', native: '日本語' },
  { text: '单词', code: 'zh', ko: '중국어', native: '中文', entry: '單詞' },
  { text: 'كلمة', code: 'ar', ko: '아랍어', native: 'العربية', rtl: true },
  { text: 'מילה', code: 'he', ko: '히브리어', native: 'עברית', rtl: true },
  { text: 'کلمه', code: 'fa', ko: '페르시아어', native: 'فارسی', rtl: true },
  { text: 'शब्द', code: 'hi', ko: '힌디어', native: 'हिन्दी' },
  { text: 'শব্দ', code: 'bn', ko: '벵골어', native: 'বাংলা' },
  { text: 'சொல்', code: 'ta', ko: '타밀어', native: 'தமிழ்' },
  { text: 'คำ', code: 'th', ko: '태국어', native: 'ไทย' },
  { text: 'từ', code: 'vi', ko: '베트남어', native: 'Tiếng Việt' },
  { text: 'kata', code: 'id', ko: '인도네시아어', native: 'Bahasa Indonesia' },
  { text: 'kelime', code: 'tr', ko: '튀르키예어', native: 'Türkçe' },
  { text: 'λέξη', code: 'el', ko: '그리스어', native: 'Ελληνικά' },
  { text: 'woord', code: 'nl', ko: '네덜란드어', native: 'Nederlands' },
  { text: 'ord', code: 'sv', ko: '스웨덴어', native: 'Svenska' },
  { text: 'orð', code: 'is', ko: '아이슬란드어', native: 'Íslenska' },
  { text: 'sana', code: 'fi', ko: '핀란드어', native: 'Suomi' },
  { text: 'szó', code: 'hu', ko: '헝가리어', native: 'Magyar' },
  { text: 'słowo', code: 'pl', ko: '폴란드어', native: 'Polski' },
  { text: 'slovo', code: 'cs', ko: '체코어', native: 'Čeština' },
  { text: 'cuvânt', code: 'ro', ko: '루마니아어', native: 'Română' },
  { text: 'სიტყვა', code: 'ka', ko: '조지아어', native: 'ქართული' },
  { text: 'բառ', code: 'hy', ko: '아르메니아어', native: 'Հայերեն' },
  { text: 'verbum', code: 'la', ko: '라틴어', native: 'Latina' },
  { text: 'vorto', code: 'eo', ko: '에스페란토', native: 'Esperanto' },
  { text: 'neno', code: 'sw', ko: '스와힐리어', native: 'Kiswahili' },
  { text: 'gair', code: 'cy', ko: '웨일스어', native: 'Cymraeg' },
  { text: 'focal', code: 'ga', ko: '아일랜드어', native: 'Gaeilge' },
]

const INTERVAL_MS = 5000
const ANIM_MS = 650

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
  const [items, setItems] = useState<Item[]>([{ id: 0, idx: 0, phase: 'idle' }])
  const [width, setWidth] = useState<number>()
  const bag = useRef<number[]>([])
  const idRef = useRef(0)
  const idxRef = useRef(0)
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

  return (
    <a
      className="rw"
      style={width ? { width } : undefined}
      href={hrefEntry(cur.code, cur.entry ?? cur.text)}
      aria-label={`${cur.text} (${cur.ko}) 항목 보기`}
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
        {cur.ko}
        {cur.native !== cur.ko && <span className="rw-native"> · {cur.native}</span>}
      </span>
    </a>
  )
}
