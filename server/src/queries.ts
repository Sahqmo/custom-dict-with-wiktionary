import { db } from "./db.js";
import { normalize } from "./normalize.js";
import { inflectionTables, parseGenders } from "./tables/index.js";

export type Hit = {
  word: string;
  lang_code: string;
  lang: string;
  pos: string[];
  match: "exact" | "normalized" | "form" | "prefix";
};

const MATCH_RANK = { exact: 0, normalized: 1, form: 2, prefix: 3 } as const;
// 자동완성은 "치고 있는 글자로 시작하는 단어"가 핵심이라 접두사 일치를 활용형 일치보다 앞에 둔다.
const MATCH_RANK_AUTOCOMPLETE = { exact: 0, normalized: 1, prefix: 2, form: 3 } as const;

// patch_db.py / 최신 ingest.py 로 만든 DB에는 entries.weight(뜻 개수)가 있다. 없는 옛 DB도 동작하게 한다.
const HAS_WEIGHT = (db.prepare("PRAGMA table_info(entries)").all() as Array<{ name: string }>).some((c) => c.name === "weight");
const W = HAS_WEIGHT ? "weight" : "0";

type Row = { word: string; lang_code: string; lang: string; pos: string | null; w: number };
type Opts = {
  lang?: string;
  pos?: string;
  limit?: number;
  /** 자주 보는 언어: 같은 일치 단계 안에서 이 언어들을 먼저 보여 준다 */
  prefer?: ReadonlySet<string>;
  /** 타이핑 중 자동완성용: 접두사 일치를 활용형보다 앞에 둔다 */
  autocomplete?: boolean;
};

type Stmt = { all: (...args: unknown[]) => unknown[] };
const stmts = new Map<string, Stmt>();
const prep = (sql: string): Stmt => {
  let s = stmts.get(sql);
  if (!s) stmts.set(sql, (s = db.prepare(sql) as unknown as Stmt));
  return s;
};

// 언어/품사 필터는 SQL 안에서 건다. (예전에는 LIMIT 300 뒤에 걸러서 "stra"+독일어 같은 검색이 0개가 되었다.)
const filter = (opts: Opts, alias = "") => {
  const sql: string[] = [];
  const args: string[] = [];
  if (opts.lang) (sql.push(`AND ${alias}lang_code = ?`), args.push(opts.lang));
  if (opts.pos) (sql.push(`AND ${alias}pos = ?`), args.push(opts.pos));
  return { sql: sql.join(" "), args };
};

const SEL = `word, lang_code, lang, pos, ${W} AS w`;

const byExact = (q: string, o: Opts) => {
  const f = filter(o);
  return prep(`SELECT ${SEL} FROM entries WHERE word = ? ${f.sql} ORDER BY w DESC LIMIT 300`).all(q, ...f.args) as Row[];
};
const byNorm = (nq: string, o: Opts) => {
  const f = filter(o);
  return prep(`SELECT ${SEL} FROM entries WHERE norm_word = ? ${f.sql} ORDER BY w DESC LIMIT 300`).all(nq, ...f.args) as Row[];
};
// 활용형(forms)에 맞으면 그 활용형이 속한 원형 항목을 돌려준다.
const byForm = (nq: string, o: Opts) => {
  const f = filter(o, "e.");
  return prep(
    `SELECT e.word, e.lang_code, e.lang, e.pos, e.${W} AS w
       FROM forms f JOIN entries e ON e.id = f.entry_id
      WHERE f.norm_form = ? ${f.sql} ORDER BY w DESC LIMIT 300`,
  ).all(nq, ...f.args) as Row[];
};
// 접두사: 뜻이 많은(=흔한) 단어를 먼저, 같으면 짧은 것을 먼저. 사전순 앞 300개만 보던 예전 방식은 "dic"에서 dictionary를 놓쳤다.
const byPrefix = (nq: string, o: Opts) => {
  const f = filter(o);
  return prep(
    `SELECT ${SEL} FROM entries WHERE norm_word >= ? AND norm_word < ? ${f.sql}
      ORDER BY w DESC, length(norm_word) LIMIT 300`,
  ).all(nq, nq + "\uffff", ...f.args) as Row[];
};

// 언어를 고르지 않은 1~2글자 접두사는 수백만 행을 훑어야 해서 건너뛴다 (정확/정규화/활용형 일치는 그대로 찾는다).
const MIN_PREFIX_ALL_LANGS = 3;

// 독일어 전사: Haeuser → hauser(=Häuser의 정규화), schoenes → schones
const deTranslit = (nq: string) => nq.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");

export function search(q: string, opts: Opts = {}): Hit[] {
  q = q.trim();
  if (!q) return [];
  const nq = normalize(q);
  const limit = opts.limit ?? 60;
  const hits = new Map<string, Hit & { w: number }>();

  const add = (rows: Row[], match: Hit["match"]) => {
    for (const r of rows) {
      const key = `${r.lang_code}\u0000${r.word}`;
      let h = hits.get(key);
      if (!h) {
        h = { word: r.word, lang_code: r.lang_code, lang: r.lang, pos: [], match, w: 0 };
        hits.set(key, h);
      }
      if (r.pos && !h.pos.includes(r.pos)) h.pos.push(r.pos);
      if (r.w > h.w) h.w = r.w;
    }
  };

  add(byExact(q, opts), "exact");
  add(byNorm(nq, opts), "normalized");
  add(byForm(nq, opts), "form");
  if (hits.size === 0 || opts.lang === "de") {
    const alt = deTranslit(nq);
    if (alt !== nq) {
      add(byNorm(alt, opts), "normalized");
      add(byForm(alt, opts), "form");
    }
  }
  if ((hits.size < limit || opts.autocomplete) && (opts.lang || nq.length >= MIN_PREFIX_ALL_LANGS)) add(byPrefix(nq, opts), "prefix");

  const rank = opts.autocomplete ? MATCH_RANK_AUTOCOMPLETE : MATCH_RANK;
  return [...hits.values()]
    .sort(
      (a, b) =>
        rank[a.match] - rank[b.match] ||
        Number(opts.prefer?.has(b.lang_code) ?? false) - Number(opts.prefer?.has(a.lang_code) ?? false) ||
        b.w - a.w ||
        a.word.length - b.word.length ||
        a.word.localeCompare(b.word),
    )
    .slice(0, limit)
    .map(({ w: _w, ...h }) => h);
}

/* ---------- 항목 상세 ---------- */

const ENTRY_COLS = "id, word, lang_code, lang, pos, etymology, etymology_number, head";
const qEntries = db.prepare(`SELECT ${ENTRY_COLS} FROM entries WHERE word = ? AND lang_code = ? ORDER BY etymology_number, id`);
// 정확한 표제어가 없을 때의 대체 조회. 같은 언어 안에서 정규화한 철자로 찾는다.
// 연관어 링크는 장음/강세 표시가 붙은 표기(라틴어 amō, 러시아어 сло́во)를 쓰는데, 항목 표제어는 표시 없는 문서 제목(amo, слово)이라서
// 정확 일치로만 찾으면 "항목이 없습니다"가 나왔다 (라틴어/러시아어 연관어 링크의 대부분).
const qEntriesNorm = db.prepare(`SELECT ${ENTRY_COLS} FROM entries WHERE norm_word = ? AND lang_code = ? ORDER BY ${W} DESC, id`);
const qSenses = db.prepare("SELECT gloss, tags, examples FROM senses WHERE entry_id = ? ORDER BY id");
const qSounds = db.prepare("SELECT ipa, tags, audio_ogg, audio_mp3 FROM sounds WHERE entry_id = ?");
// 표를 만들려면 활용형을 충분히 읽어야 하므로 넉넉히 읽고, 표에 못 들어간 나머지만 FORMS_CAP개까지 내려보낸다.
const qForms = db.prepare("SELECT form, tags FROM forms WHERE entry_id = ? LIMIT 2000");
const FORMS_CAP = 400;
const qRels = db.prepare("SELECT type, target FROM relations WHERE entry_id = ?");

const REL_CAP = 100;
const split = (s: string | null) => (s ? s.split(",") : []);

// kaikki의 etymology_text는 "Etymology tree" 계통도 줄들이 앞에 붙는 경우가 있다.
// 계통도 줄은 짧은 용어 나열이므로, 처음으로 문장다운 줄(단어 6개 이상, 또는 From 등으로 시작)이 나올 때까지 건너뛴다.
const ETY_START = /^(From|Borrowed|Inherited|Learned|Compound|Univerbation|Clipping|Calque|Back-formation|Short for|Abbreviation|Ultimately|Possibly|Probably|Uncertain|Of unknown)\b/;
function cleanEtymology(text: string | null): string | null {
  if (!text) return null;
  if (!text.startsWith("Etymology tree")) return text;
  const lines = text.split("\n");
  const i = lines.findIndex((l, idx) => idx > 0 && (ETY_START.test(l) || l.split(/\s+/).length >= 6));
  return i < 0 ? null : lines.slice(i).join("\n");
}

export function getEntry(word: string, langCode: string) {
  type Row = { id: number; word: string; etymology: string | null; etymology_number: number | null } & Record<string, unknown>;
  let rows = qEntries.all(word, langCode) as Row[];
  if (!rows.length) {
    // 가장 뜻이 많은 표제어 하나를 고른다 (같은 철자로 정규화되는 서로 다른 표제어가 여럿이면 흔한 쪽).
    // 화면은 돌려받은 표제어가 요청과 다르면 주소를 실제 표제어로 바꾼다.
    const alt = qEntriesNorm.all(normalize(word), langCode) as Row[];
    if (alt.length) {
      const best = alt[0].word;
      rows = alt.filter((r) => r.word === best).sort((a, b) => (a.etymology_number ?? 0) - (b.etymology_number ?? 0) || a.id - b.id);
    }
  }
  return rows.map(({ id, ...e }) => {
    e.etymology = cleanEtymology(e.etymology);
    const relations: Record<string, string[]> = {};
    for (const r of qRels.all(id) as Array<{ type: string; target: string }>) {
      const list = (relations[r.type] ??= []);
      if (list.length < REL_CAP && !list.includes(r.target)) list.push(r.target);
    }
    return {
      ...e,
      senses: (qSenses.all(id) as Array<{ gloss: string; tags: string | null; examples: string | null }>).map((s) => ({
        glosses: s.gloss.split("\n"),
        tags: split(s.tags),
        examples: s.examples ? JSON.parse(s.examples) : [],
      })),
      sounds: (
        qSounds.all(id) as Array<{ ipa: string | null; tags: string | null; audio_ogg: string | null; audio_mp3: string | null }>
      ).map((s) => ({ ipa: s.ipa, tags: split(s.tags), audio_ogg: s.audio_ogg, audio_mp3: s.audio_mp3 })),
      ...(() => {
        const all = (qForms.all(id) as Array<{ form: string; tags: string | null }>).map((f) => ({
          form: f.form,
          tags: split(f.tags),
        }));
        const word = e.word as string;
        const ctx = {
          genders: parseGenders(e.head as string | null, word),
          ipa: (qSounds.all(id) as Array<{ ipa: string | null }>).map((s) => s.ipa).filter((x): x is string => !!x),
        };
        const { tables, leftover } = inflectionTables(e.lang_code as string, e.pos as string | null, word, all, ctx);
        return { tables, forms: leftover.slice(0, FORMS_CAP) };
      })(),
      relations,
    };
  });
}

/* ---------- 정의 텍스트 역방향 검색 (FTS5) ---------- */

const qReverse = db.prepare(
  `SELECT e.word, e.lang_code, e.lang, e.pos, s.gloss
     FROM senses_fts f
     JOIN senses s ON s.id = f.rowid
     JOIN entries e ON e.id = s.entry_id
    WHERE senses_fts MATCH ?
    ORDER BY rank LIMIT ?`,
);

export function reverseSearch(q: string, limit = 50) {
  // 사용자 입력을 FTS 문법으로 해석하지 않도록 토큰을 따옴표로 감싼다.
  const tokens = q.match(/[\p{L}\p{N}]+/gu);
  if (!tokens) return [];
  const match = tokens.map((t) => `"${t}"`).join(" ");
  return (
    qReverse.all(match, limit) as Array<{ word: string; lang_code: string; lang: string; pos: string | null; gloss: string }>
  ).map((r) => ({ ...r, gloss: r.gloss.split("\n").join(" ") }));
}

/* ---------- 언어 목록 ---------- */

type LangRow = { lang_code: string; lang: string; count: number };
let langCache: LangRow[] | null = null;

const HAS_LANGS = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='langs'").get();

export function getLangs() {
  langCache ??= (
    HAS_LANGS
      ? // patch_db.py / ingest.py 가 미리 집계해 둔 테이블: 즉시 읽는다.
        db.prepare("SELECT lang_code, lang, count FROM langs ORDER BY count DESC").all()
      : // 옛 DB: 1,000만 행을 집계하느라 수 초 걸린다. 같은 lang_code에 이름이 여러 개 붙은 경우가 있어 코드 기준으로 묶는다.
        db.prepare("SELECT lang_code, MIN(lang) AS lang, COUNT(*) AS count FROM entries GROUP BY lang_code ORDER BY count DESC").all()
  ) as LangRow[];
  return langCache;
}

/* ---------- 랜덤 단어 ---------- */

type RandomRow = { word: string; lang_code: string; lang: string; pos: string | null };

const BIG_LANG = 100_000;
const MIN_RANDOM_WEIGHT = 3;
// 활용형/대체 표기 항목("…의 복수형")은 뜻 줄이 많아도 읽을 거리가 아니다 — 원형 관계가 있으면 거른다.
const NOT_A_FORM = "AND NOT EXISTS (SELECT 1 FROM relations r WHERE r.entry_id = entries.id AND r.type IN ('form_of', 'alt_of'))"; // 뜻이 3개 이상인 항목만: 활용형/리다이렉트 같은 빈약한 항목을 거른다

let langCountMap: Map<string, number> | null = null;
const langCounts = () => (langCountMap ??= new Map(getLangs().map((l) => [l.lang_code, l.count])));

/**
 * 무작위 단어 하나. langs를 주면 그 언어들 중에서 고른다.
 * 항목 id는 연속이라 임의의 id에서 시작해 조건에 맞는 첫 항목을 집으면 균등에 가깝게 뽑힌다 (전체 정렬/집계가 필요 없다).
 */
export function randomEntry(langs: string[] = []): RandomRow | null {
  const maxId = (prep("SELECT MAX(id) AS m FROM entries").all()[0] as { m: number }).m;
  for (let attempt = 0; attempt < 5; attempt++) {
    const start = 1 + Math.floor(Math.random() * maxId);
    const lang = langs.length ? langs[Math.floor(Math.random() * langs.length)] : null;
    // 큰 언어(영어 150만 건 등)는 언어 인덱스를 타면 전부 id로 정렬해야 해서 느리다(1초+).
    // `+lang_code`로 인덱스 사용을 막아 id 순서로 훑으며 거르게 한다. 작은 언어는 인덱스가 훨씬 빠르다.
    const big = lang !== null && (langCounts().get(lang) ?? 0) > BIG_LANG;
    const row = (
      lang
        ? prep(
            `SELECT word, lang_code, lang, pos FROM entries WHERE id >= ? AND ${big ? "+" : ""}lang_code = ? AND ${W} >= ${MIN_RANDOM_WEIGHT} ${NOT_A_FORM} ORDER BY id LIMIT 1`,
          ).all(start, lang)
        : prep(`SELECT word, lang_code, lang, pos FROM entries WHERE id >= ? AND ${W} >= ${MIN_RANDOM_WEIGHT} ${NOT_A_FORM} ORDER BY id LIMIT 1`).all(start)
    )[0] as RandomRow | undefined;
    if (row) return row;
  }
  return null;
}
