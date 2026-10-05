import { ax, P1, P2, P3, PL, SG } from "../common.js";
import type { SpecSet, TableSpec } from "../engine.js";

// 러시아어 데이터는 개혁 전 옛 표기(dated: сло́въ, говори́лъ)가 현대형과 같은 태그로 섞여 있어 표에서는 뺀다.
// 같은 형태가 강세 있는 것/없는 것으로 중복되므로(слов / сло́в) 강세 있는 쪽만 남긴다.
const common: Pick<TableSpec, "exclude" | "dedupeStress"> = { exclude: ["dated"], dedupeStress: true };

const cases = [
  ax("Nominative", "nominative"), ax("Genitive", "genitive"), ax("Dative", "dative"),
  ax("Accusative", "accusative"), ax("Instrumental", "instrumental"), ax("Prepositional", "prepositional"),
];

const persons = [
  ax("я", ...P1, ...SG), ax("ты", ...P2, ...SG), ax("он/она/оно", ...P3, ...SG),
  ax("мы", ...P1, ...PL), ax("вы", ...P2, ...PL), ax("они", ...P3, ...PL),
];

const noun: TableSpec[] = [
  { ...common, title: "Declension", cols: [ax("Singular", "singular"), ax("Plural", "plural")], rows: cases },
];

const verb: TableSpec[] = [
  {
    ...common,
    title: "Non-finite forms",
    cols: [ax("")],
    // 완료상/불완료상 태그는 표 위치와 무관하다
    ignore: ["imperfective", "perfective"],
    rows: [
      ax("Infinitive", "infinitive"),
      ax("Present active participle", "active", "participle", "present"),
      ax("Past active participle", "active", "participle", "past"),
      ax("Present passive participle", "participle", "passive", "present"),
      ax("Past passive participle", "participle", "passive", "past"),
      ax("Present adverbial participle", "adverbial", "participle", "present"),
      ax("Past adverbial participle", "adverbial", "participle", "past"),
    ],
  },
  {
    ...common,
    title: "Present / future",
    cols: persons,
    ignore: ["imperfective", "perfective"],
    // 불완료상은 현재(+ "буду говорить" 형 미래), 완료상은 단순 미래만 가진다 — 빈 행은 자동으로 사라진다.
    rows: [ax("Present", "present"), ax("Future", "future")],
  },
  {
    ...common,
    title: "Past",
    cols: [
      ax("Masculine", "masculine", "singular"), ax("Feminine", "feminine", "singular"),
      ax("Neuter", "neuter", "singular"), ax("Plural", "masculine", "plural"),
    ],
    base: ["past"],
    rows: [ax("")],
  },
  { ...common, title: "Imperative", cols: [ax("ты", ...P2, ...SG), ax("вы", ...P2, ...PL)], base: ["imperative"], rows: [ax("")] },
];

// 속격·여격·조격·전치격 남성/중성은 한 형태에 두 성이 같이 붙어 있다(genitive,masculine,neuter).
// 성 태그를 무시해도 각 칸이 자기 성 태그를 필수로 요구하므로 다른 성이 섞이지 않는다.
// 대격은 유정/무정 형태가 한 칸에 같이 나오고 비고로 구분된다(animate/inanimate).
const adjCols = [ax("Masculine", "masculine"), ax("Neuter", "neuter"), ax("Feminine", "feminine"), ax("Plural", "plural")];

const adj: TableSpec[] = [
  { ...common, title: "Declension", cols: adjCols, rows: cases, ignore: ["masculine", "neuter", "feminine"] },
  {
    ...common,
    title: "Short forms",
    cols: [ax("Masculine", "masculine"), ax("Neuter", "neuter"), ax("Feminine", "feminine"), ax("Plural", "plural")],
    base: ["short-form"],
    ignore: ["masculine", "neuter", "feminine"],
    rows: [ax("")],
  },
  {
    ...common,
    title: "Comparison",
    cols: [ax("")],
    rows: [ax("Comparative", "comparative"), ax("Superlative", "superlative"), ax("Adverb", "adverb")],
  },
];

export const ru: SpecSet = { noun, verb, adj };
