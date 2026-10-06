// API 테스트: 브라우저 없이 서버만 확인한다 — 이상 입력에 안전한지, 응답 규칙이 지켜지는지.
const BASE = process.env.BASE ?? 'http://127.0.0.1:3057/'
let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '✔' : '✘'} ${name}${extra ? '  — ' + extra : ''}`)
}
const get = async (p) => {
  const res = await fetch(BASE + 'api/' + p)
  return { status: res.status, json: await res.json().catch(() => null) }
}
const q = encodeURIComponent

/* ---------- 이상 입력은 오류 없이 끝난다 ---------- */
for (const [name, p, ok] of [
  ['빈 검색어', 'search?q=', [200]],
  ['SQL 따옴표', `search?q=${q("a' OR 1=1 --")}`, [200]],
  ['검색 문법 특수문자', `reverse?q=${q('"* ( ) NEAR AND OR')}`, [200]],
  ['따옴표 하나', `reverse?q=${q('"')}`, [200]],
  ['와일드카드', `search?q=${q('%_%')}`, [200]],
  ['없는 언어 항목', 'entry?lang=zz&word=x', [200]],
  ['언어 누락', 'entry?word=x', [400]],
  ['잘못된 날짜', 'daily?date=abc', [400]],
  ['없는 언어로 오늘의 단어', 'daily?date=2026-10-06&langs=zz,qq', [200]],
  ['없는 언어 랜덤', 'random?langs=zz', [404]],
  ['음수 limit', 'history?limit=-5', [200]],
]) {
  const r = await get(p)
  check(`이상 입력: ${name}`, ok.includes(r.status), `HTTP ${r.status}`)
}

/* ---------- 오늘의 단어 ---------- */
const d1 = (await get('daily?date=2026-10-06')).json
const d2 = (await get('daily?date=2026-10-06')).json
const d3 = (await get('daily?date=2026-10-07')).json
check('오늘의 단어: 6개, 언어 중복 없음', d1.length === 6 && new Set(d1.map((x) => x.lang_code)).size === 6, d1.map((x) => x.lang_code).join(','))
check('오늘의 단어: 같은 날짜는 같은 결과', JSON.stringify(d1) === JSON.stringify(d2))
check('오늘의 단어: 다른 날짜는 다른 결과', JSON.stringify(d1) !== JSON.stringify(d3))
const dp = (await get('daily?date=2026-10-06&langs=de,fr,ko')).json
check('오늘의 단어: 자주 쓰는 언어마다 1개 (순서 유지)', dp.map((x) => x.lang_code).join() === 'de,fr,ko', dp.map((x) => x.lang_code).join())

/* ---------- 연관어 ---------- */
const trinken = (await get('entry?lang=de&word=trinken')).json.find((e) => e.pos === 'verb')
const allRel = Object.values(trinken.relations).flat()
check('연관어: Thesaurus 안내 문구는 빠진다', !allRel.some((w) => /thesaurus:/i.test(w)))
const sulko = (await get('entry?lang=eo&word=sulko')).json[0]
check('연관어: 항목 없는 단어는 relMissing에 든다 (sulko→falto)', sulko.relMissing.includes('falto'), JSON.stringify(sulko.relMissing))
check('연관어: relMissing은 relations의 부분집합', sulko.relMissing.every((w) => Object.values(sulko.relations).flat().includes(w)))
const water = (await get('entry?lang=en&word=water')).json[0]
check('연관어: 있는 단어는 relMissing에 없다 (water→fluid 계열)', !water.relMissing.includes('liquid'))

/* ---------- 검색: 각 언어 그룹의 첫 결과가 가장 잘 맞는 결과 (카드 섹션의 전제) ---------- */
const RANK = { exact: 0, normalized: 1, form: 2, prefix: 3 }
let bad = 0
for (const w of ['amor', 'water', 'casa', 'sol', '한국', 'さくら', 'haus', 'bank', 'gato']) {
  const hits = (await get(`search?q=${q(w)}`)).json
  const groups = new Map()
  for (const h of hits) (groups.get(h.lang_code) ?? groups.set(h.lang_code, []).get(h.lang_code)).push(h)
  for (const hs of groups.values()) if (RANK[hs[0].match] !== Math.min(...hs.map((h) => RANK[h.match]))) bad++
}
check('검색: 언어 그룹의 첫 결과가 가장 높은 일치 단계', bad === 0, `어긋난 그룹 ${bad}`)

/* ---------- 굴절표 ---------- */
const gehen = (await get('entry?lang=de&word=gehen')).json.find((e) => e.pos === 'verb')
const ind = gehen.tables.find((t) => t.title === 'Indicative')
check('굴절표: 동사 표는 시제가 열, 인칭이 행', ind.cols[0] === 'Present' && ind.rows[0].label === 'ich', `${ind.cols[0]} / ${ind.rows[0].label}`)
const fi = (await get('entry?lang=fi&word=talo')).json.find((e) => e.pos === 'noun')
check('굴절표: 설계도 없는 언어(핀란드어)도 자동 표 생성', fi.tables.length >= 1 && fi.tables[0].rows.length > 5, `${fi.tables.length}개`)
const tr = (await get('entry?lang=tr&word=gitmek')).json.find((e) => e.pos === 'verb')
check('굴절표: 터키어는 자동 표를 쓰지 않는다', tr.tables.length === 0, `${tr.tables.length}개`)

console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과')
process.exitCode = fails ? 1 : 0
