// Swadesh 기초 단어 페이지. data/swadesh.json이 없으면(scripts/extract_swadesh.py + build_swadesh.py 실행 전) 건너뛴다.
import { BASE, check, finish, launch, wait } from './lib.mjs'

const probe = await fetch(BASE + 'api/swadesh')
if (probe.status === 503) {
  console.log('- data/swadesh.json 없음: 건너뜀 (README의 "Swadesh 데이터 만들기" 참고)')
  const page503 = await (await fetch(BASE + 'api/swadesh/de')).status
  check('데이터가 없으면 503으로 안내', page503 === 503, `HTTP ${page503}`)
  finish()
  process.exit()
}

/* ---------- API ---------- */
const list = await probe.json()
check('언어 목록: 200개 이상, 항목 수 207', list.langs.length > 200 && list.total === 207, `${list.langs.length}개 언어`)
check('언어 목록: 영어 Wiktionary 번역표에 있는 주요 언어 포함', ['de', 'ko', 'ja', 'fr', 'es', 'ru'].every((c) => list.langs.some((l) => l.lang_code === c)))
const de = await (await fetch(BASE + 'api/swadesh/de')).json()
check('독일어: 207항목, 대부분 채워짐', de.items.length === 207 && de.filled > 190, `${de.filled}/${de.total}`)
const pick = (n) => de.items.find((i) => i.n === n).words.map((w) => w.word)
check('독일어: 기본 단어가 맞다 (I→ich, water→Wasser, fire→Feuer)', pick(1).includes('ich') && pick(150).includes('Wasser') && pick(167).includes('Feuer'), `${pick(1)} / ${pick(150)} / ${pick(167)}`)
check('독일어: you 단수/복수는 다른 단어 (du / ihr)', pick(2).includes('du') && pick(5).includes('ihr'))
check('핵심 100 표시가 100개', de.items.filter((i) => i.core).length === 100)
check('없는 언어는 404', (await fetch(BASE + 'api/swadesh/zz')).status === 404)

/* ---------- 화면 ---------- */
const browser = await launch()
const p = await browser.newPage()
await p.setViewport({ width: 1100, height: 900 })
await p.goto(BASE + '#/', { waitUntil: 'networkidle0' })
await wait(500)
await p.click('header .hdr-pill')
await wait(700)
check('헤더 '기초 단어' 버튼 → 언어 목록 (현재 페이지 표시)', p.url().endsWith('#/swadesh') && !!(await p.$('header .hdr-pill[aria-current="page"]')))
check('언어 목록에 카드가 200개 이상', (await p.$$('.swa-lang')).length > 200)
await p.type('.swa-filter', 'germ'); await wait(200)
check('언어 검색 (germ → German)', (await p.$$eval('.swa-lang-name', (e) => e.map((x) => x.textContent))).includes('German'))
await p.goto(BASE + '#/swadesh/de', { waitUntil: 'networkidle0' }); await wait(700)
check('독일어 페이지: 207행', (await p.$$('.swa-table tbody tr')).length === 207)
await p.click('.swa-seg button:nth-child(2)'); await wait(200)
check('핵심 100 보기', (await p.$$('.swa-table tbody tr')).length === 100)
await p.click('.swa-word[href]'); await wait(800)
check('단어를 누르면 항목 페이지가 열린다', p.url().includes('#/entry/de/') && !(await p.evaluate(() => document.body.innerText.includes('항목이 없습니다'))), p.url())
await p.setViewport({ width: 390, height: 800 })
await p.goto(BASE + '#/swadesh/ja', { waitUntil: 'networkidle0' }); await wait(700)
check('모바일 가로 넘침 없음', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
await browser.close()
finish()
