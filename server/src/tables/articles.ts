// 명사 굴절표에 붙일 정관사. 성(ctx.genders)과 격/수로 결정한다.
import type { Ctx } from "./engine.js";

const uniqJoin = (xs: (string | undefined)[]) => {
  const u = [...new Set(xs.filter((x): x is string => !!x))];
  return u.length ? u.join("/") : undefined;
};

/* ---------- 독일어: 성 × 격 × 수 ---------- */

const DE: Record<string, Record<string, string>> = {
  m: { Nominative: "der", Genitive: "des", Dative: "dem", Accusative: "den" },
  f: { Nominative: "die", Genitive: "der", Dative: "der", Accusative: "die" },
  n: { Nominative: "das", Genitive: "des", Dative: "dem", Accusative: "das" },
};
const DE_PL: Record<string, string> = { Nominative: "die", Genitive: "der", Dative: "den", Accusative: "die" };

export function deArticle(ctx: Ctx, _word: string, row: string, col: string) {
  if (!ctx.genders.length) return undefined;
  if (col === "Plural") return DE_PL[row];
  // 복수 전용 명사('pl')는 단수 칸이 비므로 정관사도 없다. 'm or n'은 같은 관사끼리 합쳐 "des"처럼 보인다.
  return uniqJoin(ctx.genders.map((g) => DE[g]?.[row]));
}

/* ---------- 스페인어: el/la, los/las (강세 a로 시작하는 여성 명사는 el) ---------- */

// IPA가 강세 기호 바로 뒤에서 a로 시작하면 (el agua, el hacha, el alma, el aula)
const STRESSED_INITIAL_A = /^[/[]ˈ[aɑ]/;

export function esArticle(ctx: Ctx, _word: string, _row: string, col: string) {
  const g = ctx.genders;
  if (col === "Plural") return uniqJoin(g.map((x) => (x === "m" ? "los" : x === "f" ? "las" : undefined)));
  const stressedA = ctx.ipa.some((p) => STRESSED_INITIAL_A.test(p));
  return uniqJoin(g.map((x) => (x === "m" ? "el" : x === "f" ? (stressedA ? "el" : "la") : undefined)));
}

/* ---------- 프랑스어: le/la/l', les ---------- */

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function frArticle(ctx: Ctx, word: string, _row: string, col: string) {
  const g = ctx.genders;
  if (!g.length) return undefined;
  if (col === "Plural") return "les";

  const first = plain(word)[0] ?? "";
  // h는 묵음(l'homme)과 유음 h(le héros)를 IPA로 구분할 수 없다 → 확실하지 않으니 둘 다 보여준다.
  const elide: "yes" | "no" | "maybe" = first === "h" ? "maybe" : "aeiou".includes(first) ? "yes" : "no";
  const one = (x: string) => {
    const full = x === "m" ? "le" : x === "f" ? "la" : undefined;
    if (!full) return undefined;
    if (elide === "yes") return "l'";
    if (elide === "maybe") return `${full}/l'`;
    return full;
  };
  return uniqJoin(g.map(one));
}
