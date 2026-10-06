// 화면 기능 테스트: 언어 선택기, 가장 유사한 단어 카드(+더 보기), 링크 없는 연관어, 홈 위치, 오늘의 단어 칩.
import { BASE, check, finish, launch, wait } from './lib.mjs'

const browser = await launch()
const newPage = async ({ width = 1100, height = 800, scheme = 'light', prefs = [] } = {}) => {
  const p = await browser.newPage()
  await p.setViewport({ width, height })
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
  await p.evaluateOnNewDocument((pr) => localStorage.setItem('settings.v1', JSON.stringify({ mode: 'system', accentLight: '#4f46e5', accentDark: '#8f95ff', highlight: true, preferredLangs: pr, locale: 'ko' })), prefs)
  return p
}
const open = async (p, hash) => {
  await p.goto(BASE + hash, { waitUntil: 'networkidle0' })
  await wait(600)
}

/* ---------- 언어 선택기 ---------- */
let p = await newPage({ prefs: ['de', 'fr', 'ko'] })
await open(p, '#/')
await p.click('.lp-trigger')
await wait(250)
check('선택기: 열린다', !!(await p.$('.lp-panel')))
check('선택기: "자주 쓰는 언어" 구역이 있다', (await p.$$eval('.lp-head', (e) => e.map((x) => x.textContent))).includes('자주 쓰는 언어'))
await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter')
await wait(200)
check('선택기: ↑↓ + Enter로 고르고 닫힌다', !(await p.$('.lp-panel')) && (await p.$eval('.lp-label', (e) => e.textContent)) !== '모든 언어')
await p.click('.lp-trigger'); await wait(200)
await p.keyboard.type('germ'); await wait(150)
check('선택기: 즉석 검색 (germ → German)', (await p.$$eval('.lp-item .lp-name', (e) => e.map((x) => x.textContent))).includes('German'))
await p.keyboard.press('Enter'); await wait(200)
await p.type('.searchbar input[role=combobox]', 'haus'); await p.keyboard.press('Enter'); await wait(800)
check('선택기: 고른 언어가 검색 주소에 반영', decodeURIComponent(p.url()).includes('lang=de'), decodeURIComponent(p.url()))
await p.click('.lp-trigger'); await wait(150); await p.keyboard.press('Escape'); await wait(150)
check('선택기: Esc로 닫힌다', !(await p.$('.lp-panel')))
await p.click('.lp-trigger'); await wait(150); await p.mouse.click(5, 400); await wait(150)
check('선택기: 바깥을 누르면 닫힌다', !(await p.$('.lp-panel')))
await p.close()

/* ---------- 가장 유사한 단어 카드 ---------- */
p = await newPage()
await open(p, '#/search/q=amor')
let info = await p.evaluate(() => {
  const cards = [...document.querySelectorAll('.best-card')]
  const r = cards[0]?.getBoundingClientRect()
  return { n: cards.length, ratio: r ? r.width / r.height : 0, cols: new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size, more: document.querySelector('.best-more')?.textContent ?? '' }
})
check('카드: 처음에는 12개만', info.n === 12, `${info.n}개`)
check('카드: 4:3 비율, 4열', Math.abs(info.ratio - 4 / 3) < 0.05 && info.cols === 4, `비율 ${info.ratio.toFixed(2)}, ${info.cols}열`)
check('카드: "더 보기" 버튼에 남은 언어 수', /\d+개 언어 더 보기/.test(info.more), info.more)
await p.click('.best-more'); await wait(200)
const all = await p.evaluate(() => ({ n: document.querySelectorAll('.best-card').length, btn: !!document.querySelector('.best-more') }))
check('카드: 더 보기를 누르면 전부 보이고 버튼은 사라진다', all.n > 12 && !all.btn, `${all.n}개`)
const dup = await p.evaluate(() =>
  [...document.querySelectorAll('.best-card')].some((c) => {
    const word = c.querySelector('.bc-word').textContent
    const code = c.querySelector('.bc-lang .code').textContent
    return [...document.querySelectorAll('section.card')].some((s) => s.querySelector('.lang .code')?.textContent === code && [...s.querySelectorAll('.w')].some((x) => x.textContent === word))
  }),
)
check('카드: 아래 목록에 같은 단어가 또 나오지 않는다', !dup)
await open(p, '#/search/q=' + encodeURIComponent('사전'))
check('카드: 결과 언어가 하나여도 카드가 나온다 (한국어)', (await p.$$('.best-card')).length === 1)
await open(p, '#/search/q=amor')
check('카드: 검색어가 바뀌면 다시 12개로', (await p.$$('.best-card')).length === 12)
await p.setViewport({ width: 390, height: 800 })
await wait(300)
check('카드: 모바일 2열, 가로 넘침 없음', (await p.evaluate(() => new Set([...document.querySelectorAll('.best-card')].map((c) => Math.round(c.getBoundingClientRect().left))).size)) === 2 && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
await p.close()

/* ---------- 링크 없는 연관어 ---------- */
p = await newPage()
await open(p, '#/entry/eo/sulko')
const dead = await p.evaluate(() => ({ dead: [...document.querySelectorAll('.rel .chip.dead')].map((e) => e.tagName + ':' + e.textContent) }))
check('연관어: 항목 없는 단어는 링크 없는 흐린 칩', dead.dead.includes('SPAN:falto'), dead.dead.join())
const before = p.url()
await p.click('.rel .chip.dead'); await wait(300)
check('연관어: 흐린 칩은 눌러도 이동하지 않는다', p.url() === before)
await open(p, '#/entry/en/water')
await p.click('.rel a.chip'); await wait(800)
check('연관어: 있는 단어는 열린다', !(await p.evaluate(() => document.body.innerText.includes('항목이 없습니다'))))
await p.close()

/* ---------- 홈: 위치와 오늘의 단어 ---------- */
p = await newPage({ prefs: ['de', 'fr', 'ko'] })
await open(p, '#/')
const home = await p.evaluate(() => {
  const r = document.querySelector('.hero').getBoundingClientRect()
  return { top: r.top, bottom: r.bottom, vh: innerHeight, chips: [...document.querySelectorAll('.example-chips a.chip')].map((a) => decodeURIComponent(a.getAttribute('href'))) }
})
check('홈: 가운데 묶음이 화면 안에 있고 윗부분에 치우치지 않는다', home.top > 100 && home.bottom < home.vh, `top ${Math.round(home.top)}, bottom ${Math.round(home.bottom)}`)
check('홈: 오늘의 단어 칩 = 자주 쓰는 언어 3개', home.chips.length === 3 && home.chips.map((h) => h.split('/')[2]).join() === 'de,fr,ko', home.chips.join(' '))
await p.close()

await browser.close()
finish()
