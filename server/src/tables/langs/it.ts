import { itArticle } from "../articles.js";
import { ax, P1, P2, P3, PL, SG } from "../common.js";
import { FOLD, pairMorph, stemMorph } from "../morph.js";
import type { SpecSet, TableSpec } from "../engine.js";

// 이탈리아어 강세·개폐 표시(pàrlo / parliàmo)는 무시하고 어간을 찾는다. 부정사·조동사 행은 표제어 자신/다른 동사라 강조하지 않는다.
const byRow = stemMorph("row", { strip: FOLD.it });
const byTable = stemMorph("table", { strip: FOLD.it, skipRows: ["Infinitive", "Auxiliary"] });
const pair = pairMorph(FOLD.it);

const persons = [
  ax("io", ...P1, ...SG), ax("tu", ...P2, ...SG), ax("lui/lei", ...P3, ...SG),
  ax("noi", ...P1, ...PL), ax("voi", ...P2, ...PL), ax("loro", ...P3, ...PL),
];

const verb: TableSpec[] = [
  {
    title: "Non-finite forms",
    morph: byTable,
    cols: [ax("")],
    rows: [
      ax("Infinitive", "infinitive"), ax("Gerund", "gerund"), ax("Present participle", "participle", "present"),
      ax("Past participle", "participle", "past"), ax("Auxiliary", "auxiliary"),
    ],
  },
  {
    title: "Indicative",
    morph: byRow,
    cols: persons, transpose: true,
    base: ["indicative"],
    rows: [ax("Present", "present"), ax("Imperfect", "imperfect"), ax("Past historic", "historic", "past"), ax("Future", "future")],
  },
  { title: "Conditional", morph: byRow, cols: persons, transpose: true, base: ["conditional"], rows: [ax("Present")] },
  {
    title: "Subjunctive",
    morph: byRow,
    cols: persons, transpose: true,
    base: ["subjunctive"],
    rows: [ax("Present", "present"), ax("Imperfect", "imperfect")],
  },
  {
    title: "Imperative", transpose: true,
    morph: byRow,
    cols: [ax("tu", ...P2, ...SG), ax("Lei", ...P3, ...SG), ax("noi", ...P1, ...PL), ax("voi", ...P2, ...PL), ax("Loro", ...P3, ...PL)],
    base: ["imperative"],
    // Lei/Loro(존칭)는 'formal'과 'second-person-semantically'가 붙어 3인칭으로 들어 있다.
    ignore: ["formal", "second-person-semantically"],
    rows: [ax("Affirmative"), ax("Negative", "negative")],
  },
];

// 단수 칸은 표제어 자신이다. 정관사는 성과 첫 글자로 정해진다(il/lo/l'/la, i/gli/le).
const noun: TableSpec[] = [
  {
    title: "Number",
    morph: pair,
    article: itArticle,
    cols: [ax("Singular", "singular"), ax("Plural", "plural")],
    rows: [ax("")],
    lemmaCell: [0, 0],
  },
];

// 데이터에 'error-unrecognized-form' 태그가 섞여 있어 무시한다 (bello, bel, bell', begli …).
const adj: TableSpec[] = [
  {
    title: "Agreement",
    morph: pair,
    cols: [ax("Masculine", "masculine"), ax("Feminine", "feminine")],
    rows: [ax("Singular"), ax("Plural", "plural")],
    ignore: ["singular", "error-unrecognized-form"],
    lemmaCell: [0, 0],
  },
];

export const it: SpecSet = { verb, noun, adj };
