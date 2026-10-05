import { deArticle, esArticle, frArticle } from "./articles.js";
import { ax, axInf, P1, P2, P3, PL, SG } from "./common.js";
import type { SpecSet, TableSpec } from "./engine.js";
import { en } from "./langs/en.js";
import { it } from "./langs/it.js";
import { la } from "./langs/la.js";
import { pt } from "./langs/pt.js";
import { ru } from "./langs/ru.js";
import { sv } from "./langs/sv.js";
import { deMorph, esMorph, frMorph } from "./morph.js";

/* ============================== 독일어 ============================== */

const dePersons = [
  ax("ich", ...P1, ...SG), ax("du", ...P2, ...SG), ax("er/sie/es", ...P3, ...SG),
  ax("wir", ...P1, ...PL), ax("ihr", ...P2, ...PL), ax("sie/Sie", ...P3, ...PL),
];
const deCases = [ax("Nominative", "nominative"), ax("Genitive", "genitive"), ax("Dative", "dative"), ax("Accusative", "accusative")];

const deVerb: TableSpec[] = [
  {
    title: "Non-finite forms",
    morph: deMorph,
    cols: [ax("")],
    rows: [
      ax("Infinitive", "infinitive"), ax("Present participle", "participle", "present"),
      ax("Past participle", "participle", "past"), ax("Auxiliary", "auxiliary"),
    ],
  },
  {
    title: "Indicative",
    morph: deMorph,
    cols: dePersons,
    base: ["indicative"],
    ignore: ["multiword-construction"],
    rows: [
      ax("Present", "present"), ax("Preterite", "preterite"), ax("Perfect", "perfect"),
      ax("Pluperfect", "pluperfect"), ax("Future I", "future", "future-i"), ax("Future II", "future", "future-ii"),
    ],
  },
  {
    title: "Subjunctive I",
    morph: deMorph,
    cols: dePersons,
    base: ["subjunctive"],
    ignore: ["multiword-construction"],
    rows: [
      ax("Present", "subjunctive-i"), ax("Perfect", "perfect"),
      ax("Future I", "subjunctive-i", "future", "future-i"), ax("Future II", "subjunctive-i", "future", "future-ii"),
    ],
  },
  {
    title: "Subjunctive II",
    morph: deMorph,
    cols: dePersons,
    base: ["subjunctive"],
    ignore: ["multiword-construction"],
    rows: [
      ax("Preterite", "subjunctive-ii"), ax("Pluperfect", "pluperfect"),
      ax("Conditional I (würde)", "subjunctive-ii", "future", "future-i"),
      ax("Conditional II (würde)", "subjunctive-ii", "future", "future-ii"),
    ],
  },
  {
    title: "Imperative",
    morph: deMorph,
    cols: [ax("du", ...SG), ax("ihr", ...PL)],
    base: ["imperative", "second-person"],
    rows: [ax("")],
  },
];

const deNoun: TableSpec[] = [
  { title: "Declension", article: deArticle, cols: [ax("Singular", ...SG), ax("Plural", ...PL)], rows: deCases, ignore: ["definite"] },
];

const deGenders = [ax("Masculine", "masculine", ...SG), ax("Feminine", "feminine", ...SG), ax("Neuter", "neuter", ...SG), ax("Plural", ...PL)];
// 비교 단계(원급/비교급/최상급)별로 강/약/혼합 변화표를 만든다. 원급 표는 비교급/최상급 태그가 붙은 형태를 받지 않는다.
const deDegreeTables = (group: string, degree: string[]): TableSpec[] => [
  { group, title: "Strong declension", cols: deGenders, rows: deCases, base: [...degree, "strong", "without-article"] },
  { group, title: "Weak declension", cols: deGenders, rows: deCases, base: [...degree, "weak"], ignore: ["definite", "includes-article"] },
  { group, title: "Mixed declension", cols: deGenders, rows: deCases, base: [...degree, "mixed"], ignore: ["indefinite", "includes-article"] },
];

const deAdj: TableSpec[] = [
  {
    title: "Degrees",
    cols: [ax("")],
    rows: [ax("Positive"), ax("Comparative", "comparative"), ax("Superlative", "superlative")],
    lemmaCell: [0, 0],
  },
  {
    title: "Predicative",
    cols: [ax("Masculine", "masculine", ...SG), ax("Feminine", "feminine", ...SG), ax("Neuter", "neuter", ...SG), ax("Plural", ...PL)],
    rows: [ax("Positive", "predicative"), ax("Comparative", "predicative", "comparative")],
  },
  ...deDegreeTables("Positive", []),
  ...deDegreeTables("Comparative", ["comparative"]),
  ...deDegreeTables("Superlative", ["superlative"]),
];

/* ============================== 스페인어 ============================== */

// 2인칭 단수 tú/vos: 시제에 따라 informal 태그가 붙기도 안 붙기도 해서 informal은 무시 태그로 둔다.
const esPersons = [
  ax("yo", ...P1, ...SG), ax("tú", ...P2, ...SG), ax("vos", ...P2, ...SG, "vos-form"),
  ax("él/ella/usted", ...P3, ...SG), ax("nosotros", ...P1, ...PL), ax("vosotros", ...P2, ...PL),
  ax("ellos/ellas/ustedes", ...P3, ...PL),
];

const esVerb: TableSpec[] = [
  {
    title: "Non-finite forms",
    morph: esMorph,
    preferSingle: true,
    cols: [ax("")],
    rows: [ax("Infinitive", "infinitive"), ax("Gerund", "gerund"), ax("Past participle", "participle", "past")],
  },
  {
    title: "Participle agreement",
    morph: esMorph,
    preferSingle: true,
    cols: [ax("Singular", ...SG), ax("Plural", ...PL)],
    base: ["participle", "past"],
    rows: [ax("Masculine", "masculine"), ax("Feminine", "feminine")],
  },
  {
    title: "Indicative",
    morph: esMorph,
    preferSingle: true,
    cols: esPersons,
    base: ["indicative"],
    ignore: ["informal"],
    rows: [
      ax("Present", "present"), ax("Imperfect", "imperfect"), ax("Preterite", "preterite"),
      axInf("Future", "future"), axInf("Conditional", "conditional"),
    ],
  },
  {
    title: "Subjunctive",
    morph: esMorph,
    preferSingle: true,
    cols: esPersons,
    base: ["subjunctive"],
    ignore: ["informal"],
    rows: [
      ax("Present", "present"), ax("Imperfect (-ra)", "imperfect"),
      ax("Imperfect (-se)", "imperfect", "imperfect-se"), ax("Future", "future"),
    ],
  },
  {
    title: "Imperative",
    morph: esMorph,
    preferSingle: true,
    cols: [
      ax("tú", ...P2, ...SG), ax("vos", ...P2, ...SG, "vos-form"), ax("usted", ...P3, ...SG),
      ax("nosotros", ...P1, ...PL), ax("vosotros", ...P2, ...PL), ax("ustedes", ...P3, ...PL),
    ],
    base: ["imperative"],
    ignore: ["informal", "formal", "second-person-semantically"],
    rows: [ax("Affirmative"), ax("Negative", "negative")],
  },
];

// 단수 칸은 표제어 자신이다. 'singular' 태그를 요구해서 태그 없는 형태가 우연히 들어오지 않게 한다.
const esNoun: TableSpec[] = [
  { title: "Number", article: esArticle, cols: [ax("Singular", ...SG), ax("Plural", ...PL)], rows: [ax("")], lemmaCell: [0, 0] },
];

// 여성 단수는 'feminine' 단독, 복수는 'masculine,plural' / 'feminine,plural' 로 들어 있다.
const nounAdjAgreement: TableSpec = {
  title: "Agreement",
  cols: [ax("Masculine", "masculine"), ax("Feminine", "feminine")],
  rows: [ax("Singular"), ax("Plural", ...PL)],
  ignore: ["singular"],
  lemmaCell: [0, 0],
};
const esAdj: TableSpec[] = [nounAdjAgreement];

/* ============================== 프랑스어 ============================== */

const frPersons = [
  ax("je", ...P1, ...SG), ax("tu", ...P2, ...SG), ax("il/elle", ...P3, ...SG),
  ax("nous", ...P1, ...PL), ax("vous", ...P2, ...PL), ax("ils/elles", ...P3, ...PL),
];

const frVerb: TableSpec[] = [
  {
    title: "Non-finite forms",
    morph: frMorph,
    cols: [ax("")],
    rows: [ax("Infinitive", "infinitive"), ax("Present participle", "participle", "present"), ax("Past participle", "participle", "past")],
    ignore: ["gerund"],
  },
  {
    title: "Indicative",
    morph: frMorph,
    cols: frPersons,
    base: ["indicative"],
    rows: [
      ax("Present", "present"), ax("Imperfect", "imperfect"), ax("Past historic", "historic", "past"), axInf("Future", "future"),
    ],
  },
  { title: "Conditional", morph: frMorph, cols: frPersons, base: ["conditional"], rows: [axInf("Present")] },
  {
    title: "Subjunctive",
    morph: frMorph,
    cols: frPersons,
    base: ["subjunctive"],
    rows: [ax("Present", "present"), ax("Imperfect", "imperfect")],
  },
  {
    title: "Imperative",
    morph: frMorph,
    cols: [ax("tu", ...P2, ...SG), ax("nous", ...P1, ...PL), ax("vous", ...P2, ...PL)],
    base: ["imperative"],
    rows: [ax("")],
  },
];

const frNoun: TableSpec[] = esNoun.map((t) => ({ ...t, article: frArticle }));

const frAdj: TableSpec[] = [nounAdjAgreement];

// 단어 수 상위 10개 언어 중 굴절이 있는 언어: 영어 · 라틴어 · 스페인어 · 이탈리아어 · 포르투갈어 · 러시아어 · 프랑스어 · 독일어 · 스웨덴어
// (중국어는 굴절이 없어 대상이 아니다.) 새 언어는 langs/ 아래에 같은 형태의 파일을 만들고 여기에 등록한다.
export const SPECS: Record<string, SpecSet> = {
  de: { verb: deVerb, noun: deNoun, adj: deAdj },
  es: { verb: esVerb, noun: esNoun, adj: esAdj },
  fr: { verb: frVerb, noun: frNoun, adj: frAdj },
  en,
  la,
  it,
  pt,
  ru,
  sv,
};
