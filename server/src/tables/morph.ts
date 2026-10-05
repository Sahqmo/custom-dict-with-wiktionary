// 동사 형태를 "어간 + 굴절하는 부분"으로 쪼갠다.
//   - 형태가 어간(또는 미래/조건법의 부정사)으로 시작하면 나머지가 어미 → m:'e'
//   - 어간의 마지막 글자만 철자가 바뀐 경우(busc-→busqu-, achet-→achèt-)는 어미로 본다 → m:'e'
//   - 그 밖(어간 모음 교체, 전혀 다른 어간)은 불규칙으로 보고 단어 전체를 표시 → m:'i'
// 표시할 부분이 없으면 undefined (복합시제처럼 여러 단어가 조합된 형태는 어미가 아니라 조합이라 건드리지 않는다).
import type { Axis, MorphCtx, Part } from "./engine.js";

type Opts = {
  /** 어간 마지막 글자의 철자 변화를 어미로 인정할지 (스페인어/프랑스어) */
  tolerant?: boolean;
  /** 이 언어의 정규 어미 모음. 어간 뒤에 이 목록에 없는 꼬리가 오면 불규칙(tengo, seid)으로 본다. */
  endings: Set<string>;
  /** 어간의 규칙적인 변이형 (독일어 -eln/-ern 동사의 e 탈락: wander- → wandr-e) */
  alts?: string[];
};

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

function splitBase(form: string, base: string, { tolerant = false, endings, alts = [] }: Opts): Part[] {
  for (const b of alts) {
    if (form.startsWith(b) && endings.has(form.slice(b.length))) return [{ t: b }, { t: form.slice(b.length), m: "e" }];
  }
  if (form.startsWith(base)) {
    const rest = form.slice(base.length);
    if (!rest) return [{ t: form }];
    return endings.has(rest) ? [{ t: base }, { t: rest, m: "e" }] : [{ t: form, m: "i" }];
  }
  let l = 0;
  while (l < base.length && l < form.length && form[l] === base[l]) l++;
  // 철자 변화 허용(스페인어/프랑스어): 어간이 충분히 길고(짧은 어간은 우연히 겹치기 쉽다) 마지막 한 글자만 어긋난 경우.
  // 독일어는 이런 철자 교체가 없고 오히려 ge-/모음 교체와 겹쳐 오판하므로 끈다.
  if (tolerant && base.length >= 4 && l >= base.length - 1) return [{ t: form.slice(0, l) }, { t: form.slice(l), m: "e" }];
  return [{ t: form, m: "i" }];
}

/* ---------- 독일어 ---------- */

// 독일어 정규 어미 (현재/과거/접속법/분사). 어간 뒤에 오는 꼬리가 이 안에 있어야 규칙형.
const DE_ENDINGS = set("e st t en est et te test ten tet ete etest eten etet end nd n");

// -eln/-ern 동사: 어간 끝의 e가 빠진 변이형 (wandern: wandre, sammeln: sammle)
const deAlts = (stem: string) => (/e[lr]$/.test(stem) ? [stem.slice(0, -2) + stem.slice(-1)] : []);
const deOpts = (stem: string): Opts => ({ endings: DE_ENDINGS, alts: deAlts(stem) });

const deStem = (l: string) => (/(eln|ern)$/.test(l) ? l.slice(0, -1) : l.endsWith("en") ? l.slice(0, -2) : l.endsWith("n") ? l.slice(0, -1) : l);

/** 과거분사: [분리 접두사] + ge + 어간 + (e)t/en. ge-가 없는 분사(besucht)는 어간 + 어미로 본다. */
function dePastParticiple(lemma: string, form: string): Part[] {
  for (let k = 0; k <= lemma.length - 3; k++) {
    const pre = lemma.slice(0, k);
    const stem = deStem(lemma.slice(k));
    const head = `${pre}ge${stem}`;
    if (form.startsWith(head)) {
      const rest = form.slice(head.length);
      if (/^(t|et|en|n)?$/.test(rest)) {
        return [
          ...(pre ? [{ t: pre }] : []),
          { t: "ge", m: "e" as const },
          { t: stem },
          ...(rest ? [{ t: rest, m: "e" as const }] : []),
        ];
      }
    }
  }
  return splitBase(form, deStem(lemma), deOpts(deStem(lemma)));
}

export function deMorph(lemma: string, form: string, row: Axis): Part[] | undefined {
  if (row.label === "Infinitive" || row.label === "Auxiliary" || lemma.includes(" ")) return undefined;
  const tokens = form.split(" ");
  if (tokens.length === 1) return row.label === "Past participle" ? dePastParticiple(lemma, form) : splitBase(form, deStem(lemma), deOpts(deStem(lemma)));
  // 분리동사: "gehe auf" = 변화형 + 불변화사. 불변화사는 표제어의 앞부분과 같아야 한다.
  // ("werde gehen" 같은 복합시제는 두 번째 단어가 표제어 전체라서 여기에 걸리지 않는다.)
  if (tokens.length === 2) {
    const particle = tokens[1];
    if (lemma.length - particle.length >= 3 && lemma.startsWith(particle)) {
      return [...splitBase(tokens[0], deStem(lemma.slice(particle.length)), deOpts(deStem(lemma.slice(particle.length)))), { t: ` ${particle}` }];
    }
  }
  return undefined;
}

/* ---------- 스페인어 ---------- */

const ES_ENDINGS = set(`
  o as a amos áis an aba abas ábamos abais aban é aste ó asteis aron ando ado ada ados adas
  e es emos éis en ara aras áramos arais aran ase ases ásemos aseis asen are ares áremos areis aren ad á ás és
  ía ías íamos íais ían í iste ió imos isteis ieron iendo ido ida idos idas
  iera ieras iéramos ierais ieran iese ieses iésemos ieseis iesen iere ieres iéremos iereis ieren ed id ís
  ré rás rá remos réis rán ría rías ríamos ríais rían án
`);

const esStem = (l: string) => l.replace(/(ar|er|ir|ír)$/, "");

export function esMorph(lemma: string, form: string, row: Axis): Part[] | undefined {
  // 재귀동사(lavarse)는 대명사가 붙은 형태라 단어 경계가 다르다.
  if (row.label === "Infinitive" || /\s/.test(form) || lemma.endsWith("se")) return undefined;
  return splitBase(form, row.base === "inf" ? lemma : esStem(lemma), { tolerant: true, endings: ES_ENDINGS });
}

/* ---------- 프랑스어 ---------- */

const FR_ENDINGS = set(`
  e es ent ons ez ais ait ions iez aient ai as a âmes âtes èrent asse asses ât assions assiez assent ant
  é ée és ées is it issons issez issent issais issait issions issiez issaient îmes îtes irent isse isses ît issant
  i ie ies u ue us ues s d ds ont
`);

const frStem = (l: string) => l.replace(/(er|ir|re|oir)$/, "");
// 미래/조건법은 부정사에 어미가 붙는다. -re 동사는 마지막 e가 빠진다 (vendre → vendr-ai).
const frInf = (l: string) => (l.endsWith("re") ? l.slice(0, -1) : l);

export function frMorph(lemma: string, form: string, row: Axis): Part[] | undefined {
  if (row.label === "Infinitive" || /\s/.test(form)) return undefined;
  return splitBase(form, row.base === "inf" ? frInf(lemma) : frStem(lemma), { tolerant: true, endings: FR_ENDINGS });
}

/* =====================================================================================================
   어간 기반 공통 도구 — 영어 · 라틴어 · 이탈리아어 · 포르투갈어 · 러시아어 · 스웨덴어
   독일어/스페인어/프랑스어는 부정사에서 어간을 구했지만, 이 언어들은 표제어에서 어간이 바로 나오지 않는다
   (라틴어 rēx → rēgis, 러시아어 сло́во → слова́, 이탈리아어 pàrlo / parliàmo).
   그래서 같은 표(또는 같은 행)의 형태들이 공통으로 시작하는 부분을 어간으로 삼는다:
     - 어간 뒤에 남는 부분 → 어미 (m:'e')
     - 어간과 어긋나는 형태(어간 모음 교체, 전혀 다른 형태) → 불규칙, 단어 전체 (m:'i')
   화면에서는 둘 다 같은 방식(포인트 컬러 볼드)으로 보여 준다.
   ===================================================================================================== */

/** 비교할 때 무시할 결합 기호. 원문 표기는 그대로 두고, 어간을 찾을 때만 접는다. */
type Strip = RegExp | null;
/** 어간 뒤에 남은 부분(rest)이 이 언어의 정규 어미인지. lemma는 접은 표제어(겹자음 판별용). */
export type EndingCheck = (rest: string, lemma: string) => boolean;
export const FOLD = {
  none: null,
  ru: /́/g, // 러시아어 강세 부호 (слово / сло́во / слова́)
  it: /[̀́]/g, // 이탈리아어 강세·개폐 표시 (pàrlo / parliàmo)
  la: /[̄̆]/g, // 라틴어 장음/단음 표시 (amāre / amare)
} as const satisfies Record<string, Strip>;

const hasSpace = (s: string) => /\s/.test(s);
const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/**
 * 비교용으로 접은 문자열과, "접은 글자 수 → 원문 위치" 대응표.
 * ends[k] = 접은 글자 k개까지 읽었을 때의 원문 위치. 글자 바로 뒤의 결합 기호는 그 글자에 붙는다.
 */
function foldMap(s: string, strip: Strip): { folded: string; ends: number[] } {
  if (!strip) return { folded: s, ends: Array.from({ length: s.length + 1 }, (_, i) => i) };
  let folded = "";
  const ends = [0];
  let pos = 0;
  for (const ch of s) {
    pos += ch.length;
    const kept = ch.normalize("NFD").replace(strip, "").normalize("NFC");
    if (kept === "") ends[ends.length - 1] = pos; // 결합 기호만 있는 글자: 앞 글자에 붙인다
    else for (const _unit of kept) (folded += _unit), ends.push(pos);
  }
  return { folded, ends };
}

const MIN_STEM = 2; // 한 글자짜리 어간(이탈리아어 sono/sei/siamo → s)은 의미가 없다 — 공유하는 어간이 없는 것으로 본다

/** 접힌 형태들이 전부 공유하는 가장 긴 앞부분 (최장 공통 접두사). */
function commonStem(folded: string[]): string {
  if (!folded.length) return "";
  return folded.reduce((a, f) => a.slice(0, commonPrefix(a, f)));
}

/** 접힌 형태들 중 minShare 이상이 공유하는 가장 긴 앞부분. 없으면 ''. */
function majorityStem(folded: string[], minShare: number): string {
  if (!folded.length) return "";
  const need = Math.max(1, Math.ceil(folded.length * minShare));
  for (let L = Math.max(...folded.map((f) => f.length)); L >= 1; L--) {
    const counts = new Map<string, number>();
    for (const f of folded) if (f.length >= L) counts.set(f.slice(0, L), (counts.get(f.slice(0, L)) ?? 0) + 1);
    let best = "";
    let bestCount = 0;
    for (const [p, c] of counts) if (c > bestCount) (best = p), (bestCount = c);
    if (bestCount >= need) return best.length >= MIN_STEM ? best : "";
  }
  return "";
}

/**
 * form을 어간 + 어미로 쪼갠다.
 *  - 어간으로 시작하면 나머지가 어미. 나머지가 없으면(어간 자체) 강조할 것이 없다.
 *  - 어간의 끝 두 글자 안에서 어긋나면(수축형 amāstī ↔ amāv-, 철자 변화) 어긋난 지점부터를 어미로 본다.
 *  - 그 밖(어간이 아예 다름, 공유하는 어간이 없음)은 불규칙 → 단어 전체.
 */
function splitAtStem(form: string, stem: string, strip: Strip, loose = false): Part[] {
  const { folded, ends } = foldMap(form, strip);
  if (!stem) return [{ t: form, m: "i" }];
  const l = commonPrefix(folded, stem);
  const regular = l === stem.length;
  // loose(같은 칸의 대체형): 수축형 amāram(← amāveram)처럼 어간 일부만 공유해도 어긋난 지점부터를 어미로 본다
  const nearly = !regular && (loose ? l >= MIN_STEM : stem.length >= 3 && l >= Math.max(3, stem.length - 2));
  if (!regular && !nearly) return [{ t: form, m: "i" }];
  const cut = ends[l];
  return cut >= form.length ? [{ t: form }] : [{ t: form.slice(0, cut) }, { t: form.slice(cut), m: "e" }];
}

/** 표제어와 한 형태를 직접 견준다 (영어 dog/dogs, 이탈리아어 rosso/rossa, 포르투갈어 bonito/bonitas) */
function pairParts(lemma: string, form: string, strip: Strip, okEnding?: EndingCheck): Part[] | undefined {
  const lf = foldMap(lemma, strip).folded;
  const { folded, ends } = foldMap(form, strip);
  if (folded === lf) return undefined; // 표제어 자신
  const l = commonPrefix(folded, lf);
  // 표제어의 끝에서 갈라지는 정도만 규칙적으로 본다 (happy → happier, uomo → uomini).
  // 짧은 단어(5글자 이하)는 마지막 한 글자까지만 허용한다 — 그래야 make → made 같은 불규칙이 어미로 잡히지 않는다.
  const room = lf.length <= 5 ? 1 : 2;
  if (l < Math.max(2, lf.length - room)) return [{ t: form, m: "i" }];
  const cut = ends[l];
  if (cut >= form.length) return undefined;
  const rest = folded.slice(l);
  if (okEnding && !okEnding(rest, lf)) return [{ t: form, m: "i" }]; // 어미가 이 언어의 정규 어미가 아니면 불규칙 (go → gone)
  return [{ t: form.slice(0, cut) }, { t: form.slice(cut), m: "e" }];
}

/** 표제어와 직접 견주는 방식 (복수 하나뿐인 명사 표, 성·수 일치 표, 영어 동사 기본형 표) */
export function pairMorph(strip: Strip = null, okEnding?: EndingCheck) {
  return (lemma: string, form: string, _row: Axis): Part[] | undefined =>
    hasSpace(form) ? undefined : pairParts(lemma, form, strip, okEnding);
}

type StemOpts = { strip?: Strip; skipRows?: string[] };

/**
 * 어간 방식 어미 강조.
 *   scope 'table': 표 전체의 형태들에서 어간을 찾는다 (명사·형용사의 격 변화표 — 격마다 어미만 다르다)
 *   scope 'row'  : 같은 행(= 한 시제의 인칭별 형태들)에서 어간을 찾는다. 행에 서로 다른 형태가 3개 미만이면 표 전체로 대신한다.
 * 여러 단어로 된 형태(복합시제, "бу́ду говори́ть")와 skipRows(부정사 행 등 표제어 자신)는 건드리지 않는다.
 */
export function stemMorph(scope: "row" | "table", { strip = null, skipRows = [] }: StemOpts = {}) {
  const stems = new WeakMap<string[], string>(); // 같은 행/표(같은 배열)는 어간을 한 번만 계산한다
  const stemOf = (forms: string[], kind: "row" | "table") => {
    let stem = stems.get(forms);
    if (stem === undefined) {
      const folded = forms.filter((f) => !hasSpace(f)).map((f) => foldMap(f, strip).folded);
      if (kind === "row") {
        // 한 시제의 인칭별 형태: 전부가 공유하는 앞부분이 어간이다 (amō amās amat… → am). 없으면(불규칙 동사) 다수결.
        const all = commonStem(folded);
        stem = all.length >= MIN_STEM ? all : majorityStem(folded, 0.6);
      } else {
        // 격 변화표: 3군 명사의 주격(rēx)처럼 일부가 어간이 다른 경우가 있어 다수(70%)가 공유하는 앞부분을 어간으로 삼는다.
        stem = majorityStem(folded, 0.7);
      }
      stems.set(forms, stem);
    }
    return stem;
  };
  return (_lemma: string, form: string, row: Axis, ctx: MorphCtx): Part[] | undefined => {
    if (hasSpace(form) || skipRows.includes(row.label)) return undefined;
    // 칸의 첫 형태가 아닌 것은 대체형(수축형, 이형태)이다
    const loose = !ctx.tableForms.includes(form);
    if (scope === "table") return splitAtStem(form, stemOf(ctx.tableForms, "table"), strip, loose);
    const distinct = new Set(ctx.rowForms.filter((f) => !hasSpace(f)).map((f) => foldMap(f, strip).folded));
    return distinct.size >= 3
      ? splitAtStem(form, stemOf(ctx.rowForms, "row"), strip, loose)
      : splitAtStem(form, stemOf(ctx.tableForms, "table"), strip, loose);
  };
}
