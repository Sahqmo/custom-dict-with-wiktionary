// 표 정의가 없는 언어를 위한 자동 굴절표.
//
// 원본 데이터는 형태마다 태그 목록만 줄 뿐 행/열 구조를 주지 않는다. 언어별 설계도(specs.ts) 없이 표를 만들려고,
//   1) 태그를 "차원"으로 분류하고 (격, 수, 인칭, 시제 …)
//   2) 서법·태·부정·비정형(분사/부정사) 같은 것은 표를 나누는 기준으로 쓰고 (표 제목이 된다)
//   3) 남은 차원을 행/열에 배치한다. 배치는 가능한 모든 조합을 점수로 비교해 고른다
//      (열이 너무 많으면 감점, 보통 행이 되는 차원(격/인칭)이 열에 가면 감점, 빈 칸이 많으면 감점).
// 언어 지식이 없으므로 어미 강조·관사는 하지 않는다. 설계도가 있는 언어는 그쪽이 우선이다.
import type { Cell, FormRow, OutTable } from "./engine.js";

type Dim = "case" | "number" | "person" | "gender" | "degree" | "definite" | "tense" | "possessor" | "possessed" | "misc";

const list = (s: string) => s.split(/\s+/).filter(Boolean);

const CASES = list(`
  nominative accusative genitive dative ablative locative instrumental vocative ergative absolutive partitive
  inessive elative illative adessive ablative-allative allative abessive translative essive comitative instructive lative
  prepositional oblique sublative superessive delative terminative causal-final temporal distributive sociative equative
  prolative multiplicative essive-formal essive-modal`);
const TENSES = list(`
  present past future perfect pluperfect aorist imperfect preterite progressive continuative inferential
  imperfective perfective prospective non-prospective habitual historic`);
const MOODS = list("indicative subjunctive conditional imperative optative potential jussive necessitative cohortative");
const VOICES = list("active passive middle reflexive");

const ORDER: Record<string, string[]> = {
  case: CASES,
  number: ["singular", "dual", "plural"],
  person: ["first-person", "second-person", "third-person", "fourth-person"],
  gender: ["masculine", "feminine", "neuter", "common"],
  degree: ["positive", "comparative", "superlative"],
  definite: ["indefinite", "definite"],
  tense: TENSES,
  possessor: ["singular-possessive", "plural-possessive"],
  possessed: ["possessed-single", "possessed-many"],
};

const DIM_OF = new Map<string, Dim>();
for (const [d, tags] of Object.entries(ORDER)) for (const t of tags) DIM_OF.set(t, d as Dim);

// 표를 나누는 기준 (제목이 된다)
const SPLIT_ORDER = ["mood", "voice", "nonfinite", "polarity", "clause", "possessive"] as const;
type Split = (typeof SPLIT_ORDER)[number];
const SPLIT_OF = new Map<string, Split>();
for (const t of MOODS) SPLIT_OF.set(t, "mood");
for (const t of VOICES) SPLIT_OF.set(t, "voice");
for (const t of ["negative", "affirmative"]) SPLIT_OF.set(t, "polarity");
for (const t of ["main-clause", "subordinate-clause"]) SPLIT_OF.set(t, "clause");
SPLIT_OF.set("possessive", "possessive");
const isNonFinite = (t: string) => /^(infinitive(-.*)?|participle|gerund|gerundive|supine|converb|noun-from-verb|agent|verbal-noun)$/.test(t);

// 열이 되기 좋은 차원 / 행이 되기 좋은 차원 (나머지는 상관없음). 인칭이 있는 표에서는 수가 인칭과 함께 행이 된다 (1인칭 단수, 2인칭 단수 …).
const colPref = (d: Dim, hasPerson: boolean) => d === "tense" || d === "degree" || d === "definite" || d === "possessed" || (d === "number" && !hasPerson);
const rowPref = (d: Dim, hasPerson: boolean) => d === "case" || d === "person" || d === "gender" || d === "possessor" || d === "misc" || (d === "number" && hasPerson);
// 라벨/정렬에서 차원이 나오는 순서: 수가 인칭보다 앞(1인칭 단수, 2인칭 단수 … 다음에 복수)
const DIM_ORDER: Dim[] = ["misc", "gender", "possessed", "possessor", "number", "person", "case", "tense", "degree", "definite"];
// 라벨에서는 읽기 자연스러운 순서: "Present 1st sg", "Nominative Singular"
const LABEL_ORDER: Dim[] = ["misc", "gender", "possessed", "case", "tense", "degree", "definite", "person", "number", "possessor"];

// 표 위치 없이 "비고"로만 표시하는 태그
const NOTE = new Set(
  list(`
  rare obsolete archaic dated poetic colloquial dialectal regional literary nonstandard uncommon proscribed informal formal
  majestic Flanders Netherlands Belgium Southern Northern Tokat Germany Austria Switzerland Brazil Portugal
  alternative misspelling abbreviation pronunciation-spelling common-noun`),
);
// 무시하는 태그 (형태는 남긴다)
const IGNORE = new Set(list("multiword-construction table-tags inflection-template class romanization canonical"));

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PERSON_ABBR: Record<string, string> = { "first-person": "1st", "second-person": "2nd", "third-person": "3rd", "fourth-person": "4th" };
const NUMBER_ABBR: Record<string, string> = { singular: "sg", dual: "du", plural: "pl" };
const prettyTag = (t: string) => cap(t.replace(/-/g, " "));

type Placed = { form: string; note?: string; split: string; dims: Map<Dim, string[]> };

const idx = (dim: Dim, v: string) => {
  const o = ORDER[dim];
  const i = o ? o.indexOf(v) : -1;
  return i < 0 ? 999 : i;
};

/** 차원별 값 목록(정렬된 태그들)을 사람이 읽는 라벨로 */
function labelOf(dims: Dim[], vals: Map<Dim, string>): string {
  const hasPerson = dims.includes("person");
  const parts: string[] = [];
  for (const d of LABEL_ORDER) {
    if (!dims.includes(d)) continue;
    const v = vals.get(d);
    if (!v) continue;
    if (d === "person") parts.push(PERSON_ABBR[v] ?? prettyTag(v));
    // 소유형: 'singular'+'singular-possessive'처럼 같은 말이 겹치면 한 번만 쓴다
    else if (d === "number" && dims.includes("possessor") && vals.get("possessor")?.startsWith(v)) continue;
    else if (d === "number") parts.push(hasPerson ? (NUMBER_ABBR[v] ?? v) : prettyTag(v));
    else if (d === "possessor") parts.push(v === "singular-possessive" ? "sg" : v === "plural-possessive" ? "pl" : prettyTag(v));
    else parts.push(v.split(" ").map(prettyTag).join(" + "));
  }
  return parts.join(" ");
}

type Layout = { rows: Dim[]; cols: Dim[] };

/** 가능한 모든 행/열 배치를 점수로 비교해 가장 읽기 좋은 것을 고른다 */
function chooseLayout(dims: Dim[], items: Placed[]): Layout {
  if (dims.length === 0) return { rows: [], cols: [] };
  let best: Layout | null = null;
  let bestCost = Infinity;
  const key = (it: Placed, ds: Dim[]) => ds.map((d) => it.dims.get(d)?.join(" ") ?? "").join("|");
  for (let mask = 0; mask < 1 << dims.length; mask++) {
    const cols = dims.filter((_, i) => mask & (1 << i));
    const rows = dims.filter((_, i) => !(mask & (1 << i)));
    const rk = new Set<string>();
    const ck = new Set<string>();
    const cells = new Set<string>();
    for (const it of items) {
      const r = key(it, rows);
      const c = key(it, cols);
      rk.add(r);
      ck.add(c);
      cells.add(`${r}\t${c}`);
    }
    const nr = rk.size;
    const nc = ck.size;
    let cost = Math.max(0, nc - 7) * 12 + Math.max(0, nr - 30) * 3;
    const hasPerson = dims.includes("person");
    for (const d of cols) if (rowPref(d, hasPerson)) cost += 2.5;
    for (const d of rows) if (colPref(d, hasPerson)) cost += 2.5;
    cost += (1 - cells.size / (nr * nc)) * 8; // 빈 칸 비율
    if (nc > nr) cost += 1.5;
    if (cost < bestCost) {
      bestCost = cost;
      best = { rows, cols };
    }
  }
  return best!;
}

const cmpKey = (dims: Dim[]) => (a: Map<Dim, string>, b: Map<Dim, string>) => {
  for (const d of DIM_ORDER) {
    if (!dims.includes(d)) continue;
    const x = idx(d, a.get(d) ?? "");
    const y = idx(d, b.get(d) ?? "");
    if (x !== y) return x - y;
    const s = (a.get(d) ?? "").localeCompare(b.get(d) ?? "");
    if (s) return s;
  }
  return 0;
};

function expandCases(base: Map<Dim, string[]>): Map<Dim, string>[] {
  // 한 형태가 여러 격을 겸하면(핀란드어 대격 = 주격/속격) 각 격에 모두 넣는다
  const cases = base.get("case") ?? [""];
  const out: Map<Dim, string>[] = [];
  for (const c of cases.slice(0, 6)) {
    const m = new Map<Dim, string>();
    for (const [d, v] of base) m.set(d, d === "case" ? c : [...v].sort().join(" "));
    out.push(m);
  }
  return out;
}

export function autoTables(forms: FormRow[], defaultTitle = "Forms"): { tables: OutTable[]; leftover: FormRow[] } {
  const leftover: FormRow[] = [];
  const groups = new Map<string, { split: Map<Split, string[]>; items: { form: string; note?: string; vals: Map<Dim, string> }[]; dimsSeen: Set<Dim> }>();
  let placedTotal = 0;

  for (const f of forms) {
    if (f.tags.some((t) => t.startsWith("error-"))) continue; // 원본 데이터의 오류 표시: 버린다
    const dims = new Map<Dim, string[]>();
    const split = new Map<Split, string[]>();
    const notes: string[] = [];
    for (const t of f.tags) {
      if (!t || IGNORE.has(t)) continue;
      if (NOTE.has(t)) notes.push(t);
      else if (isNonFinite(t)) (split.get("nonfinite") ?? split.set("nonfinite", []).get("nonfinite")!).push(t);
      else if (SPLIT_OF.has(t)) {
        const s = SPLIT_OF.get(t)!;
        (split.get(s) ?? split.set(s, []).get(s)!).push(t);
      } else {
        const d = DIM_OF.get(t) ?? "misc";
        (dims.get(d) ?? dims.set(d, []).get(d)!).push(t);
        // 소유 접미사 태그가 있으면 소유형 표로 보낸다 (핀란드어 1·2인칭 소유형에는 'possessive' 태그가 없다)
        if ((d === "possessor" || d === "possessed") && !split.has("possessive")) split.set("possessive", ["possessive"]);
      }
    }
    for (const [k, v] of split) split.set(k, [...new Set(v)]);
    // 표 위치를 정할 태그가 하나도 없으면(변이형 표기만 있는 경우 등) 목록에 남긴다
    if (dims.size === 0 && split.size === 0) {
      leftover.push(f);
      continue;
    }
    const sig = SPLIT_ORDER.map((s) => (split.get(s) ?? []).sort().join("+")).join("/");
    let g = groups.get(sig);
    if (!g) groups.set(sig, (g = { split, items: [], dimsSeen: new Set() }));
    for (const vals of expandCases(dims)) {
      g.items.push({ form: f.form, note: notes.length ? notes.join(", ") : undefined, vals });
      for (const d of vals.keys()) g.dimsSeen.add(d);
    }
    placedTotal++;
  }

  const tables: OutTable[] = [];
  // 표 순서: 기본 표 → 능동 긍정 서법들(직설법 먼저) → 부정 → 수동 → 소유형 → 비정형(분사/부정사)
  const MOOD_ORDER = list("indicative subjunctive conditional potential optative necessitative jussive cohortative imperative");
  const rank = (split: Map<Split, string[]>) => {
    const has = (s: Split, t?: string) => (t ? (split.get(s) ?? []).includes(t) : !!split.get(s)?.length);
    const mood = MOOD_ORDER.indexOf((split.get("mood") ?? [])[0] ?? "");
    return [has("nonfinite") ? 1 : 0, has("possessive") ? 1 : 0, has("voice", "passive") ? 1 : 0, has("polarity", "negative") ? 1 : 0, has("clause") ? 1 : 0, split.get("mood") ? (mood < 0 ? 50 : mood) : -1];
  };
  const entries = [...groups.entries()].sort(([, a], [, b]) => {
    const x = rank(a.split);
    const y = rank(b.split);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  });

  for (const [, g] of entries) {
    if (g.items.length < 2) {
      for (const it of g.items) leftover.push({ form: it.form, tags: [] });
      continue;
    }
    // 값이 하나뿐인 차원은 축이 아니라 제목에 붙인다
    const distinct = new Map<Dim, Set<string>>();
    for (const it of g.items) for (const d of g.dimsSeen) (distinct.get(d) ?? distinct.set(d, new Set()).get(d)!).add(it.vals.get(d) ?? "");
    const constants: string[] = [];
    const axisDims: Dim[] = [];
    for (const d of DIM_ORDER) {
      const s = distinct.get(d);
      if (!s) continue;
      if (s.size === 1) {
        const v = [...s][0];
        if (v) constants.push(...v.split(" ").map(prettyTag));
      } else axisDims.push(d);
    }
    const placed: Placed[] = g.items.map((it) => ({ form: it.form, note: it.note, split: "", dims: new Map([...it.vals].map(([d, v]) => [d, v ? [v] : []])) }));
    const layout = chooseLayout(axisDims, placed);

    const keyVals = (it: Placed, ds: Dim[]) => new Map<Dim, string>(ds.map((d) => [d, it.dims.get(d)?.[0] ?? ""]));
    const uniq = (ds: Dim[]) => {
      const seen = new Map<string, Map<Dim, string>>();
      for (const it of placed) {
        const v = keyVals(it, ds);
        seen.set(ds.map((d) => v.get(d)).join("|"), v);
      }
      return [...seen.values()].sort(cmpKey(ds));
    };
    const rowKeys = uniq(layout.rows);
    const colKeys = uniq(layout.cols);
    const rid = (v: Map<Dim, string>, ds: Dim[]) => ds.map((d) => v.get(d)).join("|");
    const grid = rowKeys.map(() => colKeys.map(() => [] as Cell));
    const rowIndex = new Map(rowKeys.map((v, i) => [rid(v, layout.rows), i]));
    const colIndex = new Map(colKeys.map((v, i) => [rid(v, layout.cols), i]));
    const cellsFilled = new Set<string>();
    for (const it of placed) {
      const r = rowIndex.get(rid(keyVals(it, layout.rows), layout.rows))!;
      const c = colIndex.get(rid(keyVals(it, layout.cols), layout.cols))!;
      const cell = grid[r][c] as unknown as Cell;
      if (!cell.some((x) => x.form === it.form)) cell.push({ form: it.form, note: it.note });
      cellsFilled.add(`${r}:${c}`);
    }

    const titleParts = [
      ...SPLIT_ORDER.flatMap((s) => (g.split.get(s) ?? []).map(prettyTag)),
      ...constants,
    ];
    tables.push({
      title: titleParts.length ? titleParts.join(" · ") : defaultTitle,
      cols: colKeys.map((v) => labelOf(layout.cols, v)),
      rows: rowKeys.map((v, ri) => ({ label: labelOf(layout.rows, v), cells: grid[ri] as unknown as Cell[] })),
    });
  }

  // 표가 거의 못 만들어졌으면 목록으로 두는 편이 낫다
  if (placedTotal < 3) return { tables: [], leftover: forms.filter((f) => !f.tags.some((t) => t.startsWith("error-"))) };
  return { tables, leftover };
}
