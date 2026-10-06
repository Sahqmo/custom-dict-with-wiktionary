// 라틴어 연관어 링크(amō)와 리다이렉트 회귀 테스트
import { puppeteer, exe, BASE as BASE_URL, OUT } from './lib.mjs'

const out = OUT
const BASE = BASE_URL
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '✔' : '✘'} ${name}${extra ? '  — ' + extra : ''}`) }
const browser = await puppeteer.launch({ executablePath: exe, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1000, height: 800 })
const hash = () => page.evaluate(() => decodeURIComponent(location.hash))

/* ---- 사용자가 겪은 상황 그대로: amare 페이지 → 연관어 'amō' 칩 클릭 ---- */
await page.goto(BASE + '#/entry/la/amare', { waitUntil: 'networkidle0' })
await wait(500)
const chips = await page.$$eval('.rel .chip', (c) => c.map((x) => ({ t: x.textContent, h: decodeURIComponent(x.getAttribute('href')) })))
const amoChip = chips.find((c) => c.t.startsWith('am') && c.h.includes('/la/am'))
check('amare 페이지에 form_of 칩이 있다', !!amoChip, JSON.stringify(chips.slice(0, 3)))
console.log('   칩 링크:', amoChip?.h)
await page.evaluate((h) => { [...document.querySelectorAll('.rel .chip')].find((c) => decodeURIComponent(c.getAttribute('href')) === h).click() }, amoChip.h)
await wait(1200)
check('클릭하면 항목을 보여준다 ("항목이 없습니다" 아님)', (await page.$('article h1')) !== null && !(await page.$eval('main', (m) => m.textContent.includes('항목이 없습니다'))))
check('주소가 실제 표제어(amo)로 바뀐다', (await hash()) === '#/entry/la/amo', await hash())
check('제목이 amo', (await page.$eval('article h1', (h) => h.textContent)) === 'amo')
check('뒤로 가기가 amare 로 돌아간다 (replace)', await (async () => { await page.goBack(); await wait(500); return (await hash()) === '#/entry/la/amare' })(), await hash())

/* ---- 라틴어 동사 표 (능동/수동 묶음) ---- */
await page.goto(BASE + '#/entry/la/amo', { waitUntil: 'networkidle0' }); await wait(600)
const titles = await page.$$eval('.infl h4', (h) => h.map((x) => x.textContent))
check('라틴어 동사 굴절표가 나온다', titles.length >= 6, titles.join(' | '))
const groups = await page.$$eval('.infl-group > summary', (s) => s.map((x) => x.textContent))
check('능동/수동이 접이식 묶음', groups.join(',') === 'Active,Passive', groups.join(','))
const open = await page.$$eval('.infl-group', (g) => g.map((x) => x.open))
check('능동만 펼쳐져 있다', open[0] === true && open[1] === false, open.join(','))
await page.screenshot({ path: out + '/h-la-verb.png', fullPage: false, clip: { x: 0, y: 460, width: 1000, height: 340 } })

/* ---- 러시아어 ---- */
await page.goto(BASE + '#/entry/ru/' + encodeURIComponent('сло́во'), { waitUntil: 'networkidle0' }); await wait(800)
check('강세 표시가 있는 링크도 열린다 (сло́во → слово)', (await hash()) === '#/entry/ru/слово', await hash())
await page.goto(BASE + '#/entry/ru/' + encodeURIComponent('красивый'), { waitUntil: 'networkidle0' }); await wait(600)
await page.screenshot({ path: out + '/h-ru-adj.png', clip: { x: 0, y: 420, width: 1000, height: 380 } })
await page.goto(BASE + '#/entry/it/studente', { waitUntil: 'networkidle0' }); await wait(600)
check('이탈리아어 명사 정관사', (await page.$eval('.infl td', (t) => t.textContent.trim())).startsWith('lo studente'))

/* ---- 기존 동작 유지 ---- */
await page.goto(BASE + '#/entry/zh/' + encodeURIComponent('单词'), { waitUntil: 'networkidle0' }); await wait(800)
check('리다이렉트 자동 이동 유지 (单词 → 單詞)', (await hash()) === '#/entry/zh/單詞', await hash())
await page.goto(BASE + '#/entry/xx/doesnotexist', { waitUntil: 'networkidle0' }); await wait(500)
check('없는 단어는 여전히 "항목이 없습니다"', await page.$eval('main', (m) => m.textContent.includes('항목이 없습니다')))

console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과')
await browser.close()
process.exitCode = fails ? 1 : 0
