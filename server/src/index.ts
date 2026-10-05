import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getEntry, getLangs, reverseSearch, search } from "./queries.js";

const app = Fastify({ logger: { level: "warn" } });

app.get<{ Querystring: { q?: string; lang?: string; pos?: string } }>("/api/search", async (req) => {
  const { q = "", lang, pos } = req.query;
  return search(q, { lang: lang || undefined, pos: pos || undefined });
});

app.get<{ Querystring: { word?: string; lang?: string } }>("/api/entry", async (req, reply) => {
  const { word, lang } = req.query;
  if (!word || !lang) return reply.code(400).send({ error: "word, lang 필요" });
  return getEntry(word, lang);
});

app.get<{ Querystring: { q?: string } }>("/api/reverse", async (req) => reverseSearch(req.query.q ?? ""));

app.get("/api/langs", async () => getLangs());

// 빌드된 UI가 있으면 같이 서빙한다 (개발 중에는 vite dev 서버가 /api를 프록시).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (fs.existsSync(dist)) await app.register(fastifyStatic, { root: dist });

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "127.0.0.1" });
console.log(`http://127.0.0.1:${port}`);
