"""Swadesh 목록용 번역 데이터 추출 (1단계).

영어 항목(water, fire, to drink …)에는 Wiktionary 편집자가 정리한 번역표(`translations`)가 있다.
ingest.py는 이 필드를 버리므로, 원본 덤프를 한 번 더 훑어 Swadesh 207 단어의 영어 항목만 뽑아 둔다.

  python scripts/extract_swadesh.py            # data/raw/swadesh_en.jsonl 생성 (수 분~수십 분, 한 번만)
  python scripts/build_swadesh.py              # 2단계: 항목 정의와 합쳐 data/swadesh.json 생성

gz를 스트리밍으로 읽고, Swadesh 영어 항목으로 보이는 줄만 JSON을 파싱한다.
"""
import gzip
import json
import os
import sys
import time

SRC = os.path.join("data", "raw", "raw-wiktextract-data.jsonl.gz")
OUT = os.path.join("data", "raw", "swadesh_en.jsonl")

# build_swadesh.py 의 ITEMS 에서 쓰는 영어 표제어 전부
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swadesh_items import ITEMS  # noqa: E402

WORDS = {it["en"] for it in ITEMS}
# 최상위 항목은 `"word": "water", "lang": "English", "lang_code": "en"` 순서로 붙어 있다 (키 순서가 줄마다 달라 줄 시작으로는 못 거른다).
# 이 표지는 다른 언어 항목의 중첩 필드(어원 등)에도 나오므로, 나온 자리마다 바로 앞의 "word"를 읽어 보고 Swadesh 단어일 때만 JSON을 파싱해 확인한다.
MARK = '"lang": "English", "lang_code": "en"'


def candidate(line):
    i = line.find(MARK)
    while i >= 0:
        w = line.rfind('"word": "', 0, i)
        if w >= 0:
            end = line.find('"', w + 9)
            if end > 0 and line[w + 9:end] in WORDS:
                return True
        i = line.find(MARK, i + 1)
    return False


def main():
    t0 = time.time()
    n_lines = n_hit = 0
    with gzip.open(SRC, "rt", encoding="utf-8") as fin, open(OUT, "w", encoding="utf-8") as fout:
        for line in fin:
            n_lines += 1
            if n_lines % 2_000_000 == 0:
                print(f"{n_lines:,}줄  {time.time() - t0:.0f}s  (찾은 항목 {n_hit})", flush=True)
            if not candidate(line):
                continue
            d = json.loads(line)
            if d.get("lang_code") != "en" or d.get("word") not in WORDS:
                continue
            n_hit += 1
            senses = []
            for s in d.get("senses", ()):
                g = s.get("glosses")
                if g:
                    senses.append(g[0])
            tr = [
                {k: t[k] for k in ("code", "lang", "word", "sense", "roman", "tags") if t.get(k)}
                for t in d.get("translations", ())
                if t.get("word") and t.get("code")
            ]
            fout.write(json.dumps({"word": d["word"], "pos": d.get("pos"), "senses": senses, "translations": tr}, ensure_ascii=False) + "\n")
    print(f"완료: {n_lines:,}줄, 영어 항목 {n_hit}개, {time.time() - t0:.0f}s -> {OUT}")


if __name__ == "__main__":
    main()
