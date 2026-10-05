import { ax } from "../common.js";
import { pairMorph, type EndingCheck } from "../morph.js";
import type { SpecSet, TableSpec } from "../engine.js";

// 영어의 정규 어미: 복수/3인칭 -s -es, 과거 -ed -d, 현재분사 -ing, 비교 -er -est -ier -iest (+ 옛 -eth -th).
// 마지막 자음이 겹치는 형태(run → running, big → bigger)는 겹친 글자 뒤의 어미로 본다.
const REGULAR = new Set(["s", "es", "ies", "ed", "ied", "d", "ing", "er", "est", "r", "st", "ier", "iest", "eth", "th"]);
const okEnding: EndingCheck = (rest, lemma) => REGULAR.has(rest) || (rest.length > 1 && rest[0] === lemma.slice(-1) && REGULAR.has(rest.slice(1)));
const pair = pairMorph(null, okEnding);

// 영어는 굴절이 적다: 명사 복수, 동사 기본형 4가지, 형용사 비교급/최상급.
const noun: TableSpec[] = [
  { title: "Number", morph: pair, cols: [ax("Singular", "singular"), ax("Plural", "plural")], rows: [ax("")], lemmaCell: [0, 0] },
];

const verb: TableSpec[] = [
  {
    title: "Principal parts",
    morph: pair,
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
    morph: pair,
    cols: [ax("")],
    rows: [ax("Positive", "positive"), ax("Comparative", "comparative"), ax("Superlative", "superlative")],
    lemmaCell: [0, 0],
  },
];

export const en: SpecSet = { noun, verb, adj };
