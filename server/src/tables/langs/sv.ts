import { ax } from "../common.js";
import type { SpecSet, TableSpec } from "../engine.js";

// 스웨덴어 명사: 정관사가 어미로 붙는다 (hus / huset / hus / husen) — 별도 관사 없이 형태 자체가 표의 내용이다.
const noun: TableSpec[] = [
  {
    title: "Declension",
    cols: [
      ax("Singular", "nominative", "singular"), ax("Singular genitive", "genitive", "singular"),
      ax("Plural", "nominative", "plural"), ax("Plural genitive", "genitive", "plural"),
    ],
    rows: [ax("Indefinite", "indefinite"), ax("Definite", "definite")],
  },
];

const verb: TableSpec[] = [
  {
    title: "Finite and non-finite forms",
    cols: [ax("Active", "active"), ax("Passive", "passive")],
    rows: [
      ax("Infinitive", "infinitive"),
      ax("Present", "indicative", "present"),
      ax("Preterite", "indicative", "past"),
      ax("Supine", "supine"),
      ax("Imperative", "imperative"),
      // 데이터가 현재분사에 present와 past를 함께 붙여 둔다 (talande: active,participle,past,present)
      ax("Present participle", "participle", "past", "present"),
      ax("Past participle", "participle", "past"),
    ],
  },
];

// 'error-unrecognized-form'은 데이터에 섞인 오류 표시라 무시한다.
const adj: TableSpec[] = [
  {
    title: "Inflection",
    cols: [
      ax("Indefinite", "indefinite"), ax("Neuter", "indefinite", "neuter", "singular"), ax("Plural", "indefinite", "plural"),
      ax("Definite", "definite"), ax("Definite masc.", "definite", "masculine", "singular"),
    ],
    rows: [ax("Positive", "positive"), ax("Comparative", "comparative"), ax("Superlative", "superlative")],
    ignore: ["error-unrecognized-form"],
  },
];

export const sv: SpecSet = { noun, verb, adj };
