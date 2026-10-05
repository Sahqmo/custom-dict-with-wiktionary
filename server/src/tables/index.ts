import { autoTables } from "./auto.js";
import { buildTables, type Ctx, type FormRow, type OutTable } from "./engine.js";
import { SPECS } from "./specs.js";

export type { Ctx, OutTable } from "./engine.js";

/**
 * 명사의 성을 head 문자열("Haus n (strong, ...)", "Gummi m or n (...)", "Eltern pl (...)")에서 읽는다.
 * 성이 없는 head(활용형 항목 등)는 빈 배열.
 */
export function parseGenders(head: string | null, word: string): string[] {
  if (!head || !head.startsWith(word)) return [];
  const m = head.slice(word.length).trim().match(/^\(?(m|f|n|pl)\b\)?((?:\s+(?:or|and)\s+(?:m|f|n)\b)*)/);
  if (!m) return [];
  const out = [m[1], ...(m[2].match(/\b[mfn]\b/g) ?? [])];
  return [...new Set(out)];
}

/** 자동 표(auto.ts)를 시험하는 언어: 핀란드어, 네덜란드어 (터키어는 원본 태그가 어긋나 제외) */
const AUTO_LANGS = new Set(["fi", "nl"]);

/** 표 정의가 있는 언어/품사면 굴절표를 만들고, 표에 들어가지 않은 형태는 leftover로 돌려준다. */
export function inflectionTables(
  langCode: string,
  pos: string | null,
  word: string,
  forms: FormRow[],
  ctx: Ctx,
): { tables: OutTable[]; leftover: FormRow[] } {
  const specs = pos ? SPECS[langCode]?.[pos] : undefined;
  if (!specs) {
    // 설계도가 없는 언어: 시험 중인 언어만 태그에서 표를 자동으로 만든다 (auto.ts)
    if (AUTO_LANGS.has(langCode)) return autoTables(forms, pos === "verb" ? "Conjugation" : pos === "noun" || pos === "adj" ? "Declension" : "Forms");
    return { tables: [], leftover: forms };
  }
  return buildTables(word, forms, specs, ctx);
}
