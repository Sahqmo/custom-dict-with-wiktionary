// 동사 형태를 "어간 + 굴절하는 부분"으로 쪼갠다.
//   - 형태가 어간(또는 미래/조건법의 부정사)으로 시작하면 나머지가 어미 → m:'e'
//   - 어간의 마지막 글자만 철자가 바뀐 경우(busc-→busqu-, achet-→achèt-)는 어미로 본다 → m:'e'
//   - 그 밖(어간 모음 교체, 전혀 다른 어간)은 불규칙으로 보고 단어 전체를 표시 → m:'i'
// 표시할 부분이 없으면 undefined (복합시제처럼 여러 단어가 조합된 형태는 어미가 아니라 조합이라 건드리지 않는다).
import type { Axis, Part } from "./engine.js";

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
