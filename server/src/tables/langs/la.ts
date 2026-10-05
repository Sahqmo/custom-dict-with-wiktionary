import { ax, P1, P2, P3, PL, SG } from "../common.js";
import { FOLD, stemMorph } from "../morph.js";
import type { SpecSet, TableSpec } from "../engine.js";

// 라틴어는 장음 표시(ā ē ī ō ū)를 무시하고 어간을 찾는다. 동사는 시제(행)마다, 명사·형용사는 표 전체에서 어간을 구한다.
const byRow = stemMorph("row", { strip: FOLD.la });
const byTable = stemMorph("table", { strip: FOLD.la });

const persons = [
  ax("1st sg", ...P1, ...SG), ax("2nd sg", ...P2, ...SG), ax("3rd sg", ...P3, ...SG),
  ax("1st pl", ...P1, ...PL), ax("2nd pl", ...P2, ...PL), ax("3rd pl", ...P3, ...PL),
];

const cases = [
  ax("Nominative", "nominative"), ax("Genitive", "genitive"), ax("Dative", "dative"),
  ax("Accusative", "accusative"), ax("Ablative", "ablative"), ax("Vocative", "vocative"),
];

const verb: TableSpec[] = [
  {
    title: "Non-finite forms",
    morph: byTable,
    cols: [ax("")],
    rows: [
      ax("Present infinitive", "active", "infinitive", "present"),
      ax("Perfect infinitive", "active", "infinitive", "perfect"),
      ax("Future infinitive", "active", "future", "infinitive"),
      ax("Present infinitive (passive)", "infinitive", "passive", "present"),
      ax("Perfect infinitive (passive)", "infinitive", "passive", "perfect"),
      ax("Future infinitive (passive)", "future", "infinitive", "passive"),
      ax("Present participle", "active", "participle", "present"),
      ax("Future participle", "active", "future", "participle"),
      ax("Perfect participle (passive)", "participle", "passive", "perfect"),
      ax("Gerundive", "future", "participle", "passive"),
    ],
  },
  {
    title: "Gerund and supine",
    morph: byTable,
    cols: [ax("Genitive", "genitive"), ax("Dative", "dative"), ax("Accusative", "accusative"), ax("Ablative", "ablative")],
    rows: [ax("Gerund", "gerund", "noun-from-verb"), ax("Supine", "supine", "noun-from-verb")],
  },
  {
    group: "Active",
    title: "Indicative",
    morph: byRow,
    cols: persons, transpose: true,
    base: ["active", "indicative"],
    rows: [
      ax("Present", "present"), ax("Imperfect", "imperfect"), ax("Future", "future"),
      ax("Perfect", "perfect"), ax("Pluperfect", "pluperfect"), ax("Future perfect", "future", "perfect"),
    ],
  },
  {
    group: "Active",
    title: "Subjunctive",
    morph: byRow,
    cols: persons, transpose: true,
    base: ["active", "subjunctive"],
    rows: [ax("Present", "present"), ax("Imperfect", "imperfect"), ax("Perfect", "perfect"), ax("Pluperfect", "pluperfect")],
  },
  {
    group: "Passive",
    title: "Indicative",
    morph: byRow,
    cols: persons, transpose: true,
    base: ["passive", "indicative"],
    rows: [ax("Present", "present"), ax("Imperfect", "imperfect"), ax("Future", "future")],
  },
  {
    group: "Passive",
    title: "Subjunctive",
    morph: byRow,
    cols: persons, transpose: true,
    base: ["passive", "subjunctive"],
    rows: [ax("Present", "present"), ax("Imperfect", "imperfect")],
  },
  {
    title: "Imperative", transpose: true,
    morph: byRow,
    cols: [ax("2nd sg", ...P2, ...SG), ax("3rd sg", ...P3, ...SG), ax("2nd pl", ...P2, ...PL), ax("3rd pl", ...P3, ...PL)],
    base: ["imperative"],
    rows: [
      ax("Present (active)", "active", "present"), ax("Future (active)", "active", "future"),
      ax("Present (passive)", "passive", "present"), ax("Future (passive)", "passive", "future"),
    ],
  },
];

const noun: TableSpec[] = [{ title: "Declension", morph: byTable, cols: [ax("Singular", "singular"), ax("Plural", "plural")], rows: cases }];

// 여격·탈격 복수는 한 형태에 세 성이 모두 붙어 있다(bonīs: feminine,masculine,neuter,plural).
// 성 태그를 무시해도 각 칸이 자기 성 태그를 필수로 요구하므로 다른 성의 형태가 섞이지 않는다.
const adjCols = [
  ax("Masc. sg", "masculine", "singular"), ax("Fem. sg", "feminine", "singular"), ax("Neut. sg", "neuter", "singular"),
  ax("Masc. pl", "masculine", "plural"), ax("Fem. pl", "feminine", "plural"), ax("Neut. pl", "neuter", "plural"),
];

const adj: TableSpec[] = [
  {
    title: "Degrees",
    cols: [ax("")],
    rows: [ax("Positive", "positive"), ax("Comparative", "comparative"), ax("Superlative", "superlative"), ax("Adverb", "adverb")],
    lemmaCell: [0, 0],
  },
  { title: "Declension", morph: byTable, cols: adjCols, rows: cases, ignore: ["masculine", "feminine", "neuter"] },
];

export const la: SpecSet = { verb, noun, adj };
