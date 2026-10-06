// UI 언어 8개: 설정 화면에서 바꾸기, 화면별 한글 문구 누출 검사
import { puppeteer, exe, BASE as BASE_URL, OUT } from './lib.mjs'

const out = OUT
const BASE = BASE_URL
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '✔' : '✘'} ${name}${extra ? '  — ' + extra : ''}`) }
const HANGUL = /[\uac00-\ud7a3]/g
// 사전 데이터라서 한글이 보여도 되는 것: 예시 검색 칩(사전), 회전 단어(단어/한국어), 내 단어 저장 목록의 단어
const ALLOWED = ['사전', '단어', '한국어']

const browser = await puppeteer.launch({ executablePath: exe, headless: true })

/* ---------- 1) 설정 화면에서 직접 바꿔 보기 (실제 사용 흐름) ---------- */
const page = await browser.newPage()
await page.setViewport({ width: 1000, height: 900 })
await page.goto(BASE + '#/settings', { waitUntil: 'networkidle0' })
const title0 = await page.$eval('h1', (h) => h.textContent)
check('기본은 한국어', title0 === '설정' && (await page.evaluate(() => document.documentElement.lang)) === 'ko', title0)
const chips = await page.$$eval('.locale-chips .chip', (c) => c.map((x) => x.textContent))
check('언어 목록 8개', chips.join(',') === '한국어,English,日本語,中文,Deutsch,Français,Español,Esperanto', chips.join(','))

await page.evaluate(() => [...document.querySelectorAll('.locale-chips .chip')].find((c) => c.textContent === 'English').click())
await wait(300)
const s1 = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, lang: document.documentElement.lang, title: document.title, pressed: [...document.querySelectorAll('.locale-chips .chip')].find((c) => c.getAttribute('aria-checked') === 'true').textContent }))
check('English 선택 즉시 반영 (제목/html lang/문서 제목)', s1.h1 === 'Settings' && s1.lang === 'en' && s1.title.startsWith('Settings'), JSON.stringify(s1))
await page.reload({ waitUntil: 'networkidle0' }); await wait(300)
check('새로고침 후에도 유지', (await page.$eval('h1', (h) => h.textContent)) === 'Settings' && (await page.evaluate(() => document.documentElement.lang)) === 'en')
await page.goto(BASE + '#/', { waitUntil: 'networkidle0' }); await wait(600)
check('홈 문구도 영어', (await page.$eval('.hero h1', (h) => h.textContent)).includes('from every language'), await page.$eval('.hero h1', (h) => h.textContent.trim().replace(/\s+/g, ' ')))
await page.close()

/* ---------- 2) 8개 언어 × 여러 화면: 한글 문구가 새어 나오지 않는지 ---------- */
const PAGES = [['홈', '#/'], ['설정', '#/settings'], ['내 단어', '#/library'], ['검색 결과', '#/search/q=dictionary'], ['정의 검색', '#/reverse/q=sea'], ['항목(독일어 동사)', '#/entry/de/gehen'], ['검색 없음', '#/search/q=zzzqqxx']]
const sheet = []
for (const loc of ['ko', 'en', 'ja', 'zh', 'de', 'fr', 'es', 'eo']) {
  const p = await browser.newPage()
  await p.setViewport({ width: 1000, height: 800 })
  await p.evaluateOnNewDocument((l) => localStorage.setItem('settings.v1', JSON.stringify({ mode: 'system', accentLight: '#4f46e5', accentDark: '#8f95ff', highlight: true, preferredLangs: [], locale: l })), loc)
  const leaks = []
  for (const [name, hash] of PAGES) {
    await p.goto(BASE + hash, { waitUntil: 'networkidle0' }); await wait(450)
    // 화면에 보이는 텍스트 + placeholder/aria-label/title 속성 전부
    const texts = await p.evaluate(() => {
      // 사전 데이터(검색 결과·항목 본문·저장 목록·회전 단어·예시 칩·최근 본 단어)는 그 자체가 한글일 수 있어 UI 검사에서 뺀다
      const clone = document.body.cloneNode(true)
      clone.querySelectorAll('.results, article, .lib-row, .rw, .example-chips a, .recent a, .pref-chips, .pref-list').forEach((e) => e.remove())
      const t = [clone.textContent, document.title]
      document.querySelectorAll('[placeholder],[aria-label],[title]').forEach((e) => t.push(e.getAttribute('placeholder') ?? '', e.getAttribute('aria-label') ?? '', e.getAttribute('title') ?? ''))
      document.querySelectorAll('option,optgroup').forEach((e) => t.push(e.label ?? e.textContent))
      return t.join('\n')
    })
    if (loc !== 'ko') {
      let cleaned = texts
      for (const a of ALLOWED) cleaned = cleaned.split(a).join('')
      const m = cleaned.match(HANGUL)
      // 내 단어·항목 페이지는 사전 데이터(단어/언어명)에 한글이 섞일 수 있어 어떤 줄에서 나왔는지 같이 본다
      if (m) leaks.push(`${name}: ${[...new Set(cleaned.split('\n').filter((l) => HANGUL.test(l)))].slice(0, 2).join(' | ')}`)
      HANGUL.lastIndex = 0
    }
  }
  if (loc !== 'ko') check(`${loc}: 한글 문구 누출 없음`, leaks.length === 0, leaks.join(' || '))
  // 홈 스크린샷
  await p.goto(BASE + '#/', { waitUntil: 'networkidle0' }); await wait(500)
  const hl = await p.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('.hero h1').textContent.trim().replace(/\s+/g, ' '), sub: document.querySelector('.hero > p').textContent, ph: document.querySelector('.searchbar input').placeholder, rand: document.querySelector('.chip.action').textContent.trim() }))
  console.log(`   ${loc}:`, JSON.stringify(hl))
  sheet.push({ loc, img: (await p.screenshot({ clip: { x: 40, y: 56, width: 920, height: 420 } })).toString('base64') })
  await p.close()
}
const html = `<body style="margin:0;background:#777"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px;width:1860px">${sheet.map((s) => `<div><div style="color:#fff;font:700 14px system-ui;padding:2px 4px">${s.loc}</div><img src="data:image/png;base64,${s.img}" style="width:100%;display:block"></div>`).join('')}</div></body>`
const sp = await browser.newPage(); await sp.setViewport({ width: 1880, height: 900 }); await sp.setContent(html)
await sp.screenshot({ path: out + '/i18n-home.png', fullPage: true })
console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과')
await browser.close()
process.exitCode = fails ? 1 : 0
