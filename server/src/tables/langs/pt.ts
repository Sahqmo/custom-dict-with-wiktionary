import { ptArticle } from "../articles.js";
import { ax, P1, P2, P3, PL, SG } from "../common.js";
import type { SpecSet, TableSpec } from "../engine.js";

const persons = [
  ax("eu", ...P1, ...SG), ax("tu", ...P2, ...SG), ax("ele/ela/você", ...P3, ...SG),
  ax("nós", ...P1, ...PL), ax("vós", ...P2, ...PL), ax("eles/elas/vocês", ...P3, ...PL),
];

const verb: TableSpec[] = [
  {
    title: "Non-finite forms",
    cols: [ax("")],
    rows: [ax("Infinitive", "impersonal", "infinitive"), ax("Gerund", "gerund"), ax("Past participle", "participle", "past")],
  },
  {
    // 'falado'는 성/수 태그가 없는 기본형이다. 남성 행은 성 태그를 무시해(falados: masculine,plural) 기본형과 같은 행에 모은다.
    title: "Participle agreement",
    cols: [ax("Singular"), ax("Plural", "plural")],
    rows: [ax("Masculine"), ax("Feminine", "feminine")],
    base: ["participle", "past"],
    ignore: ["singular", "masculine"],
  },
  {
    // 포르투갈어 고유: 인칭에 따라 어미가 붙는 부정사 (falar, falares, falar, falarmos, falardes, falarem)
    title: "Personal infinitive",
    cols: persons,
    base: ["infinitive"],
    rows: [ax("")],
  },
  {
    title: "Indicative",
    cols: persons,
    base: ["indicative"],
    rows: [
      ax("Present", "present"), ax("Preterite", "preterite"), ax("Imperfect", "imperfect"),
      ax("Pluperfect", "pluperfect"), ax("Future", "future"),
    ],
  },
  { title: "Conditional", cols: persons, base: ["conditional"], rows: [ax("Present")] },
  {
    title: "Subjunctive",
    cols: persons,
    base: ["subjunctive"],
    rows: [ax("Present", "present"), ax("Imperfect", "imperfect"), ax("Future", "future")],
  },
  {
    title: "Imperative",
    cols: [ax("tu", ...P2, ...SG), ax("você", ...P3, ...SG), ax("nós", ...P1, ...PL), ax("vós", ...P2, ...PL), ax("vocês", ...P3, ...PL)],
    base: ["imperative"],
    rows: [ax("Affirmative"), ax("Negative", "negative")],
  },
];

const noun: TableSpec[] = [
  {
    title: "Number",
    article: ptArticle,
    cols: [ax("Singular", "singular"), ax("Plural", "plural")],
    rows: [ax("")],
    lemmaCell: [0, 0],
  },
];

const adj: TableSpec[] = [
  {
    title: "Agreement",
    cols: [ax("Masculine", "masculine"), ax("Feminine", "feminine")],
    rows: [ax("Singular"), ax("Plural", "plural")],
    ignore: ["singular"],
    lemmaCell: [0, 0],
  },
  { title: "Comparison", cols: [ax("")], rows: [ax("Comparative", "comparative"), ax("Superlative", "superlative")] },
];

export const pt: SpecSet = { verb, noun, adj };
