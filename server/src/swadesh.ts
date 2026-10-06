// Swadesh 기초 단어 목록. 데이터는 scripts/extract_swadesh.py + build_swadesh.py 가 만든 data/swadesh.json
// (영어 Wiktionary 영어 항목의 번역표에서 뽑은 것). 단어가 우리 사전에 항목으로 있는지는 요청할 때 확인한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { entryExists, getLangs } from "./queries.js";

type Raw = {
  items: { n: number; label: string; core: boolean; sense: string }[];
  langs: Record<string, { lang: string; words: Record<string, [string, string, string][]> }>;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const SWADESH_PATH = process.env.SWADESH ?? path.join(root, "data", "swadesh.json");

let cache: Raw | null | undefined;
function load(): Raw | null {
  if (cache === undefined) {
    try {
      cache = JSON.parse(fs.readFileSync(SWADESH_PATH, "utf8")) as Raw;
    } catch {
      cache = null; // 파일이 없으면 기능만 꺼 둔다 (서버는 정상 동작)
    }
  }
  return cache;
}

/** 이 정도는 채워진 언어만 목록에 보여 준다 (번역표가 거의 없는 언어는 빈 칸투성이라 의미가 없다) */
const MIN_FILLED = 20;

export function swadeshLangs() {
  const raw = load();
  if (!raw) return null;
  const counts = new Map(getLangs().map((l) => [l.lang_code, l.count]));
  return {
    total: raw.items.length,
    langs: Object.entries(raw.langs)
      .map(([lang_code, v]) => ({ lang_code, lang: v.lang, filled: Object.keys(v.words).length, count: counts.get(lang_code) ?? 0 }))
      .filter((l) => l.filled >= MIN_FILLED)
      .sort((a, b) => b.count - a.count || b.filled - a.filled),
  };
}

export function swadeshList(code: string) {
  const raw = load();
  if (!raw) return null;
  const L = raw.langs[code];
  if (!L) return undefined;
  const items = raw.items.map((it) => ({
    n: it.n,
    label: it.label,
    core: it.core,
    words: (L.words[String(it.n)] ?? []).map(([word, roman, tags]) => ({
      word,
      roman: roman || undefined,
      tags: tags || undefined,
      exists: entryExists(code, word),
    })),
  }));
  return { lang_code: code, lang: L.lang, total: items.length, filled: items.filter((i) => i.words.length).length, items };
}
