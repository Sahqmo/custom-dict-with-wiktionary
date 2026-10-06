"""Swadesh 목록 데이터 만들기 (2단계).

  python scripts/extract_swadesh.py   # 1단계: 원본 덤프에서 영어 항목의 번역표 추출 (한 번만)
  python scripts/build_swadesh.py     # 2단계: 항목 정의(swadesh_items.py)와 합쳐 data/swadesh.json 생성 (몇 초)

항목마다 영어 항목의 번역표에서 "알맞은 뜻 하나"를 고른다:
  - hint 정규식이 있으면 그 뜻 라벨 중 번역이 가장 많은 것, 없으면 번역이 가장 많은 뜻 라벨.
  - 같은 영어 단어의 여러 품사/어원 항목 중 지정한 품사 항목의 번역만 쓴다.
사전 DB에 있는 언어(langs 테이블)만 남기고, 수화 언어는 뺀다. 언어마다 항목당 최대 MAX_WORDS개 (일반적인 표기를 먼저).
"""
import json
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swadesh_items import ITEMS  # noqa: E402

SRC = os.path.join("data", "raw", "swadesh_en.jsonl")
DB = os.path.join("data", "dictionary.sqlite")
OUT = os.path.join("data", "swadesh.json")
MAX_WORDS = 4

# 화면에 보여 줄 번역 태그만 (문법 성/수/상). 나머지(문자 이름, 방언 등)는 버린다.
KEEP_TAGS = {
    "masculine": "m",
    "feminine": "f",
    "neuter": "n",
    "common-gender": "c",
    "plural": "pl",
    "singular": "sg",
    "dual": "du",
    "perfective": "pf",
    "imperfective": "impf",
    "formal": "formal",
    "informal": "informal",
    "polite": "polite",
    "familiar": "familiar",
}
# 문자 이름 태그 (표기 체계를 알려 줄 뿐 방언/변이형이 아니다)
SCRIPTS = {
    "Cyrillic", "Latin", "Arabic", "Hebrew", "Greek", "Devanagari", "Gurmukhi", "Jawi", "Rumi", "Hangul", "Hanja", "Hiragana",
    "Katakana", "Kanji", "Traditional-Chinese", "Simplified-Chinese", "Pinyin", "Han", "Bengali", "Tamil", "Thai", "Georgian",
}


def main():
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    langs = {code: (name, count) for code, name, count in db.execute("SELECT lang_code, lang, count FROM langs")}

    entries = defaultdict(list)
    for line in open(SRC, encoding="utf-8"):
        d = json.loads(line)
        entries[(d["word"], d["pos"])].append(d)

    out_items = []
    by_lang = defaultdict(dict)  # code -> {n: [[word, roman, tags], ...]}
    report = []
    for it in ITEMS:
        es = entries.get((it["en"], it["pos"]), [])
        trs = [t for e in es for t in e["translations"]]
        counts = Counter(t.get("sense", "") for t in trs)
        cands = [(k, v) for k, v in counts.items() if not it["hint"] or re.search(it["hint"], k, re.I)]
        cands.sort(key=lambda kv: -kv[1])
        if not cands:
            report.append(f"{it['n']} {it['label']}: 알맞은 뜻을 못 찾음")
            out_items.append({"n": it["n"], "label": it["label"], "core": it["core"], "sense": ""})
            continue
        sense = cands[0][0]
        out_items.append({"n": it["n"], "label": it["label"], "core": it["core"], "sense": sense})
        per_lang = defaultdict(list)
        for t in trs:
            if t.get("sense", "") != sense or t["code"] not in langs:
                continue
            lang_name = langs[t["code"]][0]
            if "Sign Language" in lang_name:
                continue
            tags = t.get("tags", [])
            per_lang[t["code"]].append(
                (
                    # 방언/옛말/속어 등 표준이 아닌 표기 태그가 있으면 "그 밖"으로 분류한다
                    any(g not in KEEP_TAGS and g not in SCRIPTS for g in tags),
                    t["word"].strip(),
                    (t.get("roman") or "").strip(),
                    ",".join(KEEP_TAGS[g] for g in tags if g in KEEP_TAGS),
                )
            )
        for code, rows in per_lang.items():
            # 표준 표기가 하나라도 있으면 그것만 쓴다. 전부 방언 표기인 언어(아랍어 등)는 그대로 쓴다.
            if any(not r[0] for r in rows):
                rows = [r for r in rows if not r[0]]
            seen, kept = set(), []
            for _other, word, roman, tg in rows:
                if word in seen:
                    continue
                seen.add(word)
                kept.append([word, roman, tg])
                if len(kept) >= MAX_WORDS:
                    break
            by_lang[code][it["n"]] = kept

    out = {
        "items": out_items,
        "langs": {c: {"lang": langs[c][0], "words": {str(n): w for n, w in sorted(m.items())}} for c, m in by_lang.items()},
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    filled = sorted(((len(m), c) for c, m in by_lang.items()), reverse=True)
    print(f"항목 {len(out_items)}개, 언어 {len(by_lang)}개 -> {OUT} ({os.path.getsize(OUT) / 1e6:.1f}MB)")
    print("채워진 항목 수 상위:", ", ".join(f"{c}:{n}" for n, c in filled[:10]))
    print("50개 이상 채워진 언어:", sum(1 for n, _ in filled if n >= 50), "| 100개 이상:", sum(1 for n, _ in filled if n >= 100), "| 150개 이상:", sum(1 for n, _ in filled if n >= 150))
    for r in report:
        print("!", r)


if __name__ == "__main__":
    main()
