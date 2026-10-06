// 테스트 공통 도구. run.mjs가 서버를 띄우고 BASE/OUT/USER_DB 환경변수를 넘겨 준다.
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

export { puppeteer }
export const BASE = process.env.BASE ?? 'http://127.0.0.1:3057/'
export const OUT = process.env.OUT ?? path.join(import.meta.dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })

// 화면 테스트에 쓸 브라우저: BROWSER 환경변수, 없으면 흔한 설치 위치에서 Edge/Chrome을 찾는다.
const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
export const exe = CANDIDATES.find((p) => p && fs.existsSync(p))
if (!exe) {
  console.error('브라우저(Edge/Chrome)를 찾지 못했습니다. BROWSER 환경변수에 실행 파일 경로를 지정하세요.')
  process.exit(2)
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** check(이름, 조건, 부가설명) — 실패 개수를 세고, finish()가 종료 코드를 정한다 */
let fails = 0
export const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '✔' : '✘'} ${name}${extra ? '  — ' + extra : ''}`)
}
export const finish = () => {
  console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과')
  process.exitCode = fails ? 1 : 0
}
export const launch = () => puppeteer.launch({ executablePath: exe, headless: true })
