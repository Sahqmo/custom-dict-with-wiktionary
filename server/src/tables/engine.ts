// 활용형(forms)의 태그 조합으로 굴절표를 만드는 엔진.
// 언어/품사별 표 정의(TableSpec)는 specs 파일에 선언하고, 이 파일은 언어를 모른다.
//
// 셀 매칭 규칙: 셀의 필수 태그 R = base ∪ 행 태그 ∪ 열 태그.
//   형태의 태그 T(변이 태그 제외)가  R ⊆ T  이고  T ⊆ R ∪ ignore  이면 그 셀에 들어간다.
//   → 필수 태그가 모두 있어야 하고, 정의되지 않은 태그(예: 다른 법/시제)가 붙은 형태는 들어가지 않는다.

export type Axis = {
  label: string;
  tags: string[];
  /** 동사 어미 강조에서 어간 대신 부정사를 기준으로 삼는 행 (예: 스페인어/프랑스어 미래·조건법) */
  base?: "inf";
};

/** 형태를 쪼갠 조각. m: 'e' = 굴절하는 부분(어미 등), 'i' = 불규칙이라 단어 전체 */
export type Part = { t: string; m?: "e" | "i" };

/** 어미 강조(morph)가 어간을 찾을 때 참고하는, 같은 표 안의 다른 형태들 (각 칸의 첫 형태) */
export type MorphCtx = {
  /** 같은 행의 형태들 (동사: 한 시제의 인칭별 형태) */
  rowForms: string[];
  /** 표 전체의 형태들 (명사/형용사: 격·수·성별 형태) */
  tableForms: string[];
};

/** 표를 만들 때 필요한 표제어 쪽 정보 */
export type Ctx = {
  /** 명사의 성: m, f, n, pl */
  genders: string[];
  /** 표제어의 발음(IPA). 스페인어 el agua, 프랑스어 l' 판별에 쓴다. */
  ipa: string[];
};

export type TableSpec = {
  title: string;
  /** 같은 group의 표는 UI에서 한 묶음으로 보여준다 (예: 비교급/최상급) */
  group?: string;
  rows: Axis[];
  cols: Axis[];
  /** 모든 셀에 공통으로 필요한 태그 */
  base?: string[];
  /** 있어도 무시하는 태그 (예: multiword-construction, definite) */
  ignore?: string[];
  /** 표제어 자신이 들어가는 셀 [행, 열] */
  lemmaCell?: [number, number];
  /** 한 칸에 한 단어짜리 형태가 있으면 여러 단어 형태(스페인어 재귀형 "me hago")는 뺀다 */
  preferSingle?: boolean;
  /** 이 패턴과 맞는 형태만 이 표에 넣는다 (러시아어: 키릴 문자. 같은 태그로 섞여 들어온 로마자 전사 idjá, íduči 제외) */
  formPattern?: RegExp;
  /** 이 태그가 하나라도 붙은 형태는 이 표에서 뺀다 (예: 러시아어 옛 표기 dated). 빠진 형태는 "그 밖의 형태"에 남는다. */
  exclude?: string[];
  /** 강세 부호(U+0301)만 다른 형태는 한 칸에 하나만 둔다, 강세 있는 쪽을 남긴다 (러시아어 слов / сло́в) */
  dedupeStress?: boolean;
  /** 셀의 정관사 (명사 표). 성/격/수에 따라 결정한다. */
  article?: (ctx: Ctx, word: string, rowLabel: string, colLabel: string) => string | undefined;
  /** 행과 열을 뒤집어 출력한다. 동사 표: 시제를 열로, 인칭을 행으로 둔다. */
  transpose?: boolean;
  /** 형태를 어간/어미로 쪼개 굴절하는 부분을 표시한다 (동사 표) */
  morph?: (lemma: string, form: string, row: Axis, ctx: MorphCtx) => Part[] | undefined;
};

export type SpecSet = Partial<Record<string, TableSpec[]>>; // pos -> tables

export type FormRow = { form: string; tags: string[] };
export type Cell = { form: string; note?: string; article?: string; parts?: Part[] }[];
export type OutTable = { title: string; group?: string; cols: string[]; rows: { label: string; cells: Cell[] }[] };

// 표 위치를 정하지 않고 "비고"로만 표시하는 태그
const VARIANT = new Set([
  "rare", "obsolete", "archaic", "dated", "poetic", "colloquial", "dialectal", "regional", "literary",
  "nonstandard", "uncommon", "proscribed", "before-vowel", "Switzerland", "Austria", "Germany", "Liechtenstein",
  "Brazil", "Portugal", "animate", "inanimate", // 러시아어 대격: 같은 칸에 유정/무정 형태가 함께 나온다
]);

const NOTE_LABEL: Record<string, string> = { "before-vowel": "before vowel" };

const unstress = (s: string) => s.replace(/́/g, "");

// 발음기호가 활용형처럼 섞여 들어오는 경우(예: 프랑스어 "paʁl")를 걸러낸다.
const IPA_CHARS = /[ɐ-ʯ]/;

export function buildTables(word: string, forms: FormRow[], specs: TableSpec[], ctx: Ctx) {
  // 'canonical'은 표제어 자신의 표기(라틴어 amō, 러시아어 сло́во)라 표에도 "그 밖의 형태"에도 의미가 없다.
  const clean = forms.filter((f) => !IPA_CHARS.test(f.form) && !f.tags.includes("canonical"));
  const parsed = clean.map((f) => {
    const core: string[] = [];
    const notes: string[] = [];
    for (const t of f.tags) (VARIANT.has(t) ? notes : core).push(t);
    return {
      form: f.form,
      core: new Set(core),
      raw: new Set(f.tags),
      note: notes.map((n) => NOTE_LABEL[n] ?? n).join(", ") || undefined,
    };
  });

  const tables: OutTable[] = [];
  const shown = new Set<string>(); // 표에 나온 형태 문자열: 같은 형태가 "기타"에 중복되지 않게
  const used = new Set<number>();

  for (const spec of specs) {
    const ignore = new Set(spec.ignore ?? []);
    const grid: Cell[][] = spec.rows.map((r, ri) =>
      spec.cols.map((c, ci) => {
        const need = new Set([...(spec.base ?? []), ...r.tags, ...c.tags]);
        const cell: Cell = [];
        if (spec.lemmaCell && spec.lemmaCell[0] === ri && spec.lemmaCell[1] === ci) cell.push({ form: word });
        parsed.forEach((p, i) => {
          if (spec.exclude?.some((t) => p.raw.has(t))) return;
          if (spec.formPattern && !spec.formPattern.test(p.form)) return;
          for (const t of need) if (!p.core.has(t)) return;
          for (const t of p.core) if (!need.has(t) && !ignore.has(t)) return;
          used.add(i);
          if (cell.some((x) => x.form === p.form)) return;
          if (spec.dedupeStress) {
            const same = cell.findIndex((x) => unstress(x.form) === unstress(p.form));
            if (same >= 0) {
              // 강세 표시가 있는 쪽을 남긴다
              if (unstress(cell[same].form) === cell[same].form && unstress(p.form) !== p.form) cell[same] = { form: p.form, note: p.note };
              return;
            }
          }
          cell.push({ form: p.form, note: p.note });
        });

        if (spec.preferSingle && cell.some((x) => !x.form.includes(" "))) {
          for (let k = cell.length - 1; k >= 0; k--) if (cell[k].form.includes(" ")) cell.splice(k, 1);
        }

        return cell;
      }),
    );

    // 2패스: 정관사와 어미 강조는 모든 칸의 내용이 정해진 뒤에 덧붙인다.
    // 어간은 같은 행/표의 다른 형태들과 견주어야 알 수 있기 때문이다 (라틴어 rēx → rēgis, 러시아어 сло́во → слова́).
    if (spec.article || spec.morph) {
      const first = (cell: Cell) => cell[0]?.form;
      const tableForms = grid.flat().map(first).filter((f): f is string => !!f);
      grid.forEach((cells, ri) => {
        const rowForms = cells.map(first).filter((f): f is string => !!f);
        cells.forEach((cell, ci) => {
          const article = spec.article?.(ctx, word, spec.rows[ri].label, spec.cols[ci].label);
          for (const item of cell) {
            if (article) item.article = article;
            const parts = spec.morph?.(word, item.form, spec.rows[ri], { rowForms, tableForms });
            if (parts?.some((p) => p.m)) item.parts = parts;
          }
        });
      });
    }

    // 완전히 빈 행/열은 버린다 (예: 스페인어 vos 열이 없는 동사).
    const keepRows = spec.rows.map((_, ri) => grid[ri].some((c) => c.length));
    const keepCols = spec.cols.map((_, ci) => grid.some((r) => r[ci].length));
    const rows = spec.rows
      .map((r, ri) => ({ label: r.label, cells: grid[ri].filter((_, ci) => keepCols[ci]) }))
      .filter((_, ri) => keepRows[ri]);
    const cols = spec.cols.filter((_, ci) => keepCols[ci]).map((c) => c.label);

    // 표제어 칸 외에 채워진 칸이 없으면 표를 만들 가치가 없다.
    const filledCells = rows.reduce((n, r) => n + r.cells.filter((c) => c.length).length, 0);
    if (!rows.length || !cols.length || (spec.lemmaCell && filledCells < 2)) continue;

    for (const r of rows) for (const c of r.cells) for (const x of c) shown.add(x.form);
    if (spec.transpose) {
      tables.push({
        title: spec.title,
        group: spec.group,
        cols: rows.map((r) => r.label),
        rows: cols.map((label, ci) => ({ label, cells: rows.map((r) => r.cells[ci]) })),
      });
    } else tables.push({ title: spec.title, group: spec.group, cols, rows });
  }

  const leftover = clean.filter((f, i) => !used.has(i) && !shown.has(f.form));
  return { tables, leftover };
}
