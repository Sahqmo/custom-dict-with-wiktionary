// 화면 흐름 테스트: 자동완성, 단축키, 즐겨찾기/기록, 자주 쓰는 언어, 다크 모드 등 (임시 사용자 DB로 실행)
import { puppeteer, exe, BASE as BASE_URL, OUT } from './lib.mjs'
async function pickLang(pg, code) { await pg.click('.lp-trigger'); await pg.type('.lp-filter', code); await new Promise(r => setTimeout(r, 150)); await pg.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 150)) }

const out = OUT
const BASE = BASE_URL
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '✔' : '✘'} ${name}${extra ? '  — ' + extra : ''}`)
}

// 깨끗한 상태에서 시작 (서버의 즐겨찾기/기록 비우기)
for (const f of await (await fetch(BASE + 'api/favorites')).json()) await fetch(`${BASE}api/favorites?lang=${f.lang_code}&word=${encodeURIComponent(f.word)}`, { method: 'DELETE' })
await fetch(BASE + 'api/history', { method: 'DELETE' })

const browser = await puppeteer.launch({ executablePath: exe, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1000, height: 760 })
const dialogs = []
page.on('dialog', (d) => { dialogs.push(d.message()); d.accept() })
const hash = () => page.evaluate(() => decodeURIComponent(location.hash))
const sugs = () => page.$$eval('.suggest li', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))

/* ---------- 자동완성 ---------- */
await page.goto(BASE + '#/', { waitUntil: 'networkidle0' })
await page.type('.searchbar input', 'dic', { delay: 40 })
await page.waitForSelector('.suggest li', { timeout: 5000 })
let list = await sugs()
check('자동완성 목록이 뜬다', list.length > 0, list.slice(0, 3).join(' | '))
check('같은 철자는 "N개 언어"로 묶인다 (dic)', list.some((t) => /dic\s*\d+개 언어/.test(t)), list[0])
await page.screenshot({ path: out + '/f-suggest-light.png', clip: { x: 150, y: 240, width: 700, height: 420 } })

// 키보드: ↓ 두 번 → Enter
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown')
const onText = await page.$eval('.suggest li.on', (e) => e.textContent.trim())
check('↓ 키로 항목이 선택된다', !!onText, onText)
check('aria-activedescendant 가 선택 항목을 가리킨다', await page.$eval('.searchbar input', (i) => !!i.getAttribute('aria-activedescendant')))
await page.keyboard.press('Escape')
check('Esc 로 목록이 닫힌다', (await page.$$('.suggest li')).length === 0)
await page.keyboard.press('ArrowDown')
check('닫힌 뒤 ↓ 로 다시 열린다', (await page.$$('.suggest li')).length > 0)

// 첫 항목(여러 언어) 선택 → 검색 결과 페이지
await page.keyboard.press('ArrowUp') // 마지막 → ... 맨 앞으로 가려면 active=0 이 되도록 위로
await page.evaluate(() => document.querySelector('.suggest li')?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })))
await page.keyboard.press('Enter')
await wait(700)
check('여러 언어 철자를 고르면 검색 결과로 간다', (await hash()).startsWith('#/search/q=dic'), await hash())

// 언어를 고르면 한 언어로 특정되어 항목 페이지로 간다
await page.goto(BASE + '#/', { waitUntil: 'networkidle0' })
await pickLang(page, 'English')
await page.type('.searchbar input', 'dictio', { delay: 40 })
await page.waitForSelector('.suggest li')
list = await sugs()
check('언어 필터가 자동완성에도 적용된다', list[0]?.startsWith('dictionary'), list.slice(0, 3).join(' | '))
await page.mouse.move(0, 0)
await page.click('.suggest li:first-child')
await wait(900)
check('클릭하면 항목 페이지로 간다', (await hash()) === '#/entry/en/dictionary', await hash())

/* ---------- '/' 단축키 ---------- */
await page.evaluate(() => document.activeElement?.blur())
await page.keyboard.press('/')
check("'/' 로 검색창에 포커스", await page.evaluate(() => document.activeElement?.matches('.searchbar input')))
await page.keyboard.type('a/b')
check("입력 중의 '/' 는 글자로 들어간다", (await page.$eval('.searchbar input', (i) => i.value)).includes('a/b') || (await page.$eval('.searchbar input', (i) => i.value)).endsWith('a/b'))

/* ---------- 즐겨찾기 / 기록 ---------- */
await page.goto(BASE + '#/entry/de/Haus', { waitUntil: 'networkidle0' })
await wait(500)
check('별 버튼이 있고 처음엔 꺼져 있다', (await page.$eval('.star', (b) => b.getAttribute('aria-pressed'))) === 'false')
await page.click('.star'); await wait(400)
check('클릭하면 켜진다', (await page.$eval('.star', (b) => b.getAttribute('aria-pressed'))) === 'true')
const favs = await (await fetch(BASE + 'api/favorites')).json()
check('서버에 저장된다', favs.some((f) => f.word === 'Haus' && f.lang_code === 'de'), JSON.stringify(favs.map((f) => f.word)))
await page.screenshot({ path: out + '/f-entry-star.png', clip: { x: 0, y: 60, width: 1000, height: 150 } })

await page.goto(BASE + '#/entry/ko/' + encodeURIComponent('단어'), { waitUntil: 'networkidle0' })
await wait(500)
await page.reload({ waitUntil: 'networkidle0' }); await wait(500)
await page.goto(BASE + '#/entry/de/Haus', { waitUntil: 'networkidle0' }); await wait(600)
check('새로고침 후에도 별이 켜져 있다 (서버 저장)', (await page.$eval('.star', (b) => b.getAttribute('aria-pressed'))) === 'true')

await page.goto(BASE + '#/library', { waitUntil: 'networkidle0' }); await wait(500)
const favRows = await page.$$eval('.lib-row .w', (e) => e.map((x) => x.textContent))
check('내 단어 > 즐겨찾기에 보인다', favRows.includes('Haus'), favRows.join(','))
await page.click('[role=tab]:nth-child(2)'); await wait(300)
const histRows = await page.$$eval('.lib-row .w', (e) => e.map((x) => x.textContent))
check('최근 본 단어에 방문한 항목이 최신순으로 있다', histRows[0] === 'Haus' && histRows.includes('단어') && histRows.includes('dictionary'), histRows.join(','))
await page.screenshot({ path: out + '/f-library.png', clip: { x: 150, y: 60, width: 700, height: 420 } })

// 한 건 지우기 / 전체 지우기
await page.click('.lib-row:nth-child(2) .icon-btn'); await wait(300)
check('기록 한 건 지우기', (await page.$$('.lib-row')).length === histRows.length - 1)
await page.click('.lib-head .btn'); await wait(400)
check('전체 지우기(확인창 후)', dialogs.length === 1 && (await page.$$('.lib-row')).length === 0, dialogs[0])
check('서버 기록도 비었다', (await (await fetch(BASE + 'api/history')).json()).length === 0)

// 홈의 "최근 본 단어"
await page.goto(BASE + '#/entry/fr/maison', { waitUntil: 'networkidle0' }); await wait(500)
await page.goto(BASE + '#/', { waitUntil: 'networkidle0' }); await wait(600)
check('홈에 최근 본 단어 칩이 보인다', (await page.$$eval('.recent .chip', (c) => c.map((x) => x.textContent))).includes('maison'))

/* ---------- 랜덤 + 자주 쓰는 언어 ---------- */
await page.click('.chip.action'); await wait(900)
check('랜덤 단어 버튼이 항목 페이지로 보낸다', (await hash()).startsWith('#/entry/'), await hash())

await page.goto(BASE + '#/settings', { waitUntil: 'networkidle0' }); await wait(300)
await page.type('input[aria-label="자주 쓰는 언어 찾기"]', 'german', { delay: 30 }); await wait(200)
check('언어 이름으로 찾는다', (await page.$$('.pref-list button')).length > 0, await page.$$eval('.pref-list button', (b) => b.map((x) => x.textContent.replace(/\s+/g, ' ')).join(' | ')))
await page.click('.pref-list button'); await wait(200)
await page.type('input[aria-label="자주 쓰는 언어 찾기"]', 'ko', { delay: 30 }); await wait(200)
await page.click('.pref-list li:first-child button'); await wait(200)
const prefChips = await page.$$eval('.pref-chips .chip', (c) => c.map((x) => x.textContent.replace(/[✕]/g, '').replace(/\s+/g, ' ').trim()))
check('자주 쓰는 언어가 칩으로 담긴다', prefChips.length === 2, prefChips.join(' | '))
await page.screenshot({ path: out + '/f-settings-pref.png', clip: { x: 150, y: 430, width: 700, height: 330 } })

await page.goto(BASE + '#/', { waitUntil: 'networkidle0' }); await wait(400)
const langs = new Set()
for (let i = 0; i < 6; i++) { await page.click('.chip.action'); await wait(450); langs.add((await hash()).split('/')[2]); await page.goto(BASE + '#/', { waitUntil: 'networkidle0' }) }
check('랜덤은 자주 쓰는 언어에서만 뽑힌다', [...langs].every((l) => ['de', 'ko'].includes(l)), [...langs].join(','))

await page.click('.lp-trigger'); await wait(200)
const groups = await page.$$eval('.lp-head', (g) => g.map((x) => x.textContent))
await page.keyboard.press('Escape')
check('언어 선택에 "자주 쓰는 언어" 묶음이 맨 위에 있다', groups[0] === '자주 쓰는 언어', groups.join(' / '))

// 자주 쓰는 언어가 검색 결과 순서에 반영된다 ('mot'을 가진 언어 중 fr/sv/en... 에서 de/ko가 있으면 앞으로)
await page.goto(BASE + '#/search/q=Wort', { waitUntil: 'networkidle0' }); await wait(600)
const firstGroup = await page.$eval('.results .lang', (e) => e.textContent.trim())
check('검색 결과에서 자주 쓰는 언어(독일어)가 첫 묶음', firstGroup.startsWith('German'), firstGroup)

// 다크 모드 외관
const dark = await browser.newPage()
await dark.setViewport({ width: 1000, height: 760 })
await dark.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
await dark.goto(BASE + '#/', { waitUntil: 'networkidle0' })
await dark.type('.searchbar input', 'hab', { delay: 40 })
await pickLang(dark, 'Spanish')
await dark.waitForSelector('.suggest li', { timeout: 5000 }).catch(() => {})
await wait(400)
await dark.screenshot({ path: out + '/f-suggest-dark.png', clip: { x: 150, y: 240, width: 700, height: 420 } })
await dark.close()

console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과')
await browser.close()
process.exitCode = fails ? 1 : 0
