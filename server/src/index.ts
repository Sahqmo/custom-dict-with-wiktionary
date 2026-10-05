import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalize } from "./normalize.js";
import { dailyEntries, getEntry, getLangs, randomEntry, reverseSearch, search } from "./queries.js";
import { favorites, history, type Saved } from "./userdb.js";

const app = Fastify({ logger: { level: "warn" } });

const MAX_LEN = 300;
const clean = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= MAX_LEN ? v : null);
/** "de,fr,es" → ["de","fr","es"] (최대 20개) */
const codes = (v: unknown) =>
  typeof v === "string"
    ? [...new Set(v.split(",").map((x) => x.trim()).filter((x) => x.length > 0 && x.length <= 20))].slice(0, 20)
    : [];

/* ---------- 사전 ---------- */

app.get<{ Querystring: { q?: string; lang?: string; pos?: string; prefer?: string } }>("/api/search", async (req) => {
  const { q = "", lang, pos, prefer } = req.query;
  return search(q, { lang: lang || undefined, pos: pos || undefined, prefer: new Set(codes(prefer)) });
});

// 자동완성: 같은 검색을 적은 개수로. 입력할 때마다 불리므로 가볍게 유지한다.
// 같은 철자(대소문자·악센트 변형 포함)가 여러 언어/표기로 흩어져 있으면 "wat, wät, wAt, Wat…"가 목록을 다 차지하므로
// 정규화한 철자 기준으로 하나로 묶고 언어 수를 알려 준다. langs > 1 이면 한 항목으로 특정할 수 없으니
// 화면에서는 검색 결과 페이지(언어별로 정리됨)로 보낸다. (한 언어 안의 변형은 가장 잘 맞는 항목을 대표로 한다.)
const SUGGEST_MAX = 8;
app.get<{ Querystring: { q?: string; lang?: string; prefer?: string } }>("/api/suggest", async (req) => {
  const { q = "", lang, prefer } = req.query;
  if (q.trim().length === 0) return [];
  const hits = search(q, { lang: lang || undefined, prefer: new Set(codes(prefer)), limit: 60, autocomplete: true });
  const groups = new Map<string, { hit: (typeof hits)[number]; langs: Set<string> }>();
  for (const h of hits) {
    const key = normalize(h.word);
    const g = groups.get(key);
    if (g) g.langs.add(h.lang_code);
    else if (groups.size < SUGGEST_MAX) groups.set(key, { hit: h, langs: new Set([h.lang_code]) });
  }
  return [...groups.values()].map(({ hit, langs }) => ({ ...hit, langs: langs.size }));
});

app.get<{ Querystring: { langs?: string } }>("/api/random", async (req, reply) => {
  const r = randomEntry(codes(req.query.langs));
  return r ?? reply.code(404).send({ error: "조건에 맞는 단어가 없습니다" });
});

app.get<{ Querystring: { date?: string; langs?: string } }>("/api/daily", async (req, reply) => {
  const date = req.query.date ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply.code(400).send({ error: "date(YYYY-MM-DD) 필요" });
  return dailyEntries(date, codes(req.query.langs));
});

app.get<{ Querystring: { word?: string; lang?: string } }>("/api/entry", async (req, reply) => {
  const { word, lang } = req.query;
  if (!word || !lang) return reply.code(400).send({ error: "word, lang 필요" });
  return getEntry(word, lang);
});

app.get<{ Querystring: { q?: string } }>("/api/reverse", async (req) => reverseSearch(req.query.q ?? ""));

app.get("/api/langs", async () => getLangs());

/* ---------- 내 단어: 즐겨찾기 / 기록 (data/user.sqlite) ---------- */

const langName = new Map(getLangs().map((l) => [l.lang_code, l.lang]));
const withLang = (rows: Saved[]) => rows.map((r) => ({ ...r, lang: langName.get(r.lang_code) ?? r.lang_code }));

app.get("/api/favorites", async () => withLang(favorites.list()));

app.put<{ Body: { lang?: unknown; word?: unknown } }>("/api/favorites", async (req, reply) => {
  const lang = clean(req.body?.lang);
  const word = clean(req.body?.word);
  if (!lang || !word) return reply.code(400).send({ error: "lang, word 필요" });
  favorites.add(lang, word);
  return { ok: true };
});

app.delete<{ Querystring: { lang?: string; word?: string } }>("/api/favorites", async (req, reply) => {
  const lang = clean(req.query.lang);
  const word = clean(req.query.word);
  if (!lang || !word) return reply.code(400).send({ error: "lang, word 필요" });
  favorites.remove(lang, word);
  return { ok: true };
});

app.get<{ Querystring: { limit?: string } }>("/api/history", async (req) =>
  withLang(history.list(Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000))),
);

app.post<{ Body: { lang?: unknown; word?: unknown } }>("/api/history", async (req, reply) => {
  const lang = clean(req.body?.lang);
  const word = clean(req.body?.word);
  if (!lang || !word) return reply.code(400).send({ error: "lang, word 필요" });
  history.visit(lang, word);
  return { ok: true };
});

// lang/word가 있으면 한 건, 없으면 전체 삭제
app.delete<{ Querystring: { lang?: string; word?: string } }>("/api/history", async (req) => {
  const lang = clean(req.query.lang);
  const word = clean(req.query.word);
  if (lang && word) history.remove(lang, word);
  else history.clear();
  return { ok: true };
});

/* ---------- 화면 ---------- */

// 빌드된 UI가 있으면 같이 서빙한다 (개발 중에는 vite dev 서버가 /api를 프록시).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (fs.existsSync(dist)) await app.register(fastifyStatic, { root: dist });

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "127.0.0.1" });
console.log(`http://127.0.0.1:${port}`);
