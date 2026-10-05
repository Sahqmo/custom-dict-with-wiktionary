// scripts/ingest.py 의 normalize()와 같은 규칙이어야 한다.
// Python의 casefold()와 toLowerCase()가 다른 대표 문자(ß, ς, ſ)만 보정한다.
const STRIP = /[̀-ְͯ-ׇً-ٰٟ]/g;

export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(STRIP, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ς/g, "σ")
    .replace(/ſ/g, "s");
}
