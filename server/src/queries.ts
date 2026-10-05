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

const qExact = db.prepare("SELECT word, lang_code, lang, pos FROM entries WHERE word = ? LIMIT 300");
const qNorm = db.prepare("SELECT word, lang_code, lang, pos FROM entries WHERE norm_word = ? LIMIT 300");
// 활용형(forms)에 맞으면 그 활용형이 속한 원형 항목을 돌려준다.
const qForm = db.prepare(
  `SELECT e.word, e.lang_code, e.lang, e.pos
     FROM forms f JOIN entries e ON e.id = f.entry_id
    WHERE f.norm_form = ? LIMIT 300`,
);
const qPrefix = db.prepare(
  `SELECT word, lang_code, lang, pos FROM entries
    WHERE norm_word >= ? AND norm_word < ? LIMIT 300`,
);

type Row = { word: string; lang_code: string; lang: string; pos: string | null };

export function search(q: string, opts: { lang?: string; pos?: string; limit?: number } = {}): Hit[] {
  q = q.trim();
  if (!q) return [];
  const nq = normalize(q);
  const limit = opts.limit ?? 60;
  const hits = new Map<string, Hit>();

  const add = (rows: Row[], match: Hit["match"]) => {
    for (const r of rows) {
      if (opts.lang && r.lang_code !== opts.lang) continue;
      if (opts.pos && r.pos !== opts.pos) continue;
      const key = `${r.lang_code}\u0000${r.word}`;
      let h = hits.get(key);
      if (!h) {
        h = { word: r.word, lang_code: r.lang_code, lang: r.lang, pos: [], match };
        hits.set(key, h);
      }
      if (r.pos && !h.pos.includes(r.pos)) h.pos.push(r.pos);
    }
  };

  add(qExact.all(q) as Row[], "exact");
  add(qNorm.all(nq) as Row[], "normalized");
  add(qForm.all(nq) as Row[], "form");
  if (hits.size < limit) add(qPrefix.all(nq, nq + "￿") as Row[], "prefix");

  return [...hits.values()]
    .sort(
      (a, b) =>
        MATCH_RANK[a.match] - MATCH_RANK[b.match] ||
        a.word.length - b.word.length ||
        a.word.localeCompare(b.word),
    )
    .slice(0, limit);
}

/* ---------- 항목 상세 ---------- */

const qEntries = db.prepare(
  "SELECT id, word, lang_code, lang, pos, etymology, etymology_number, head FROM entries WHERE word = ? AND lang_code = ? ORDER BY etymology_number, id",
);
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
  const rows = qEntries.all(word, langCode) as Array<{ id: number; etymology: string | null } & Record<string, unknown>>;
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

let langCache: Array<{ lang_code: string; lang: string; count: number }> | null = null;

export function getLangs() {
  langCache ??= db
    // 같은 lang_code에 이름이 여러 개 붙은 경우가 있어 코드 기준으로 묶는다. (이름은 가장 흔한 것을 쓸 수 없으니 MIN으로 고정)
    .prepare("SELECT lang_code, MIN(lang) AS lang, COUNT(*) AS count FROM entries GROUP BY lang_code ORDER BY count DESC")
    .all() as Array<{ lang_code: string; lang: string; count: number }>;
  return langCache;
}
