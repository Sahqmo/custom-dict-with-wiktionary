import { ax } from "../common.js";
import type { SpecSet, TableSpec } from "../engine.js";

// 영어는 굴절이 적다: 명사 복수, 동사 기본형 4가지, 형용사 비교급/최상급.
const noun: TableSpec[] = [
  { title: "Number", cols: [ax("Singular", "singular"), ax("Plural", "plural")], rows: [ax("")], lemmaCell: [0, 0] },
];

const verb: TableSpec[] = [
  {
    title: "Principal parts",
    cols: [ax("")],
    rows: [
      ax("Base form", "infinitive"),
      ax("3rd-person singular", "present", "singular", "third-person"),
      ax("Present participle", "participle", "present"),
      ax("Simple past", "past"),
      ax("Past participle", "participle", "past"),
    ],
    lemmaCell: [0, 0],
  },
];

const adj: TableSpec[] = [
  {
    title: "Comparison",
    cols: [ax("")],
    rows: [ax("Positive", "positive"), ax("Comparative", "comparative"), ax("Superlative", "superlative")],
    lemmaCell: [0, 0],
  },
];

export const en: SpecSet = { noun, verb, adj };
