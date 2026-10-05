#!/usr/bin/env python3
"""kaikki Wiktextract JSONL(.gz) -> SQLite (FTS5) 적재 스크립트. 표준 라이브러리만 사용.

    python scripts/ingest.py                      # 전체 적재
    python scripts/ingest.py --limit 100000       # 앞쪽 N줄만 (테스트)
    python scripts/ingest.py --min-lang-entries 0 # 소규모 언어까지 전부 적재
    python scripts/ingest.py --out data/test.sqlite --limit 100000

gz를 한 줄씩 스트리밍으로 읽고, 쓰지 않는 필드(translations, categories, templates 등)는 버린다.
인덱스와 FTS는 적재가 끝난 뒤에 만든다(훨씬 빠르다).
"""
import argparse
import gzip
import json
import os
import re
import sqlite3
import sys
import time
import unicodedata

DEFAULT_SRC = os.path.join("data", "raw", "raw-wiktextract-data.jsonl.gz")
DEFAULT_OUT = os.path.join("data", "dictionary.sqlite")

SCHEMA = """
CREATE TABLE entries(
  id INTEGER PRIMARY KEY,
  word TEXT NOT NULL,
  norm_word TEXT NOT NULL,
  lang_code TEXT NOT NULL,
  lang TEXT NOT NULL,
  pos TEXT,
  etymology TEXT,
  etymology_number INTEGER,
  head TEXT
);
CREATE TABLE senses(
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL,
  gloss TEXT NOT NULL,      -- 계층 gloss는 줄바꿈으로 연결 (상위 \\n 하위)
  tags TEXT,                -- 쉼표 구분
  examples TEXT             -- JSON: [{"text":..., "ref":...}] 최대 3개
);
CREATE TABLE sounds(
  entry_id INTEGER NOT NULL,
  ipa TEXT,
  tags TEXT,
  audio_ogg TEXT,
  audio_mp3 TEXT
);
CREATE TABLE forms(
  entry_id INTEGER NOT NULL,
  form TEXT NOT NULL,
  norm_form TEXT NOT NULL,
  tags TEXT
);
CREATE TABLE relations(
  entry_id INTEGER NOT NULL,
  type TEXT NOT NULL,       -- synonyms, antonyms, derived, related, form_of, alt_of ...
  target TEXT NOT NULL
);
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
"""

INDEXES = """
CREATE INDEX idx_entries_word ON entries(word);
CREATE INDEX idx_entries_norm ON entries(norm_word, lang_code);
CREATE INDEX idx_senses_entry ON senses(entry_id);
CREATE INDEX idx_sounds_entry ON sounds(entry_id);
CREATE INDEX idx_forms_form ON forms(form);
CREATE INDEX idx_forms_norm ON forms(norm_form);
CREATE INDEX idx_forms_entry ON forms(entry_id);
CREATE INDEX idx_rel_entry ON relations(entry_id);
CREATE INDEX idx_rel_target ON relations(target, type);
"""

FTS = """
CREATE VIRTUAL TABLE senses_fts USING fts5(
  gloss, content='senses', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);
INSERT INTO senses_fts(senses_fts) VALUES('rebuild');
"""

RELATION_KEYS = (
    "synonyms", "antonyms", "hypernyms", "hyponyms", "derived", "related",
    "coordinate_terms", "meronyms", "holonyms", "troponyms",
)
SKIP_FORM_TAGS = {"table-tags", "inflection-template", "class", "romanization"}

# 정규화에서 제거할 결합 기호: 일반 라틴 악센트, 히브리 niqqud, 아랍 harakat.
# (인도계 문자의 모음 부호 등은 의미가 있으므로 건드리지 않는다. 한글은 NFKD로 자모 분해된다.)
_STRIP = re.compile("[̀-ְͯ-ׇً-ٰٟ]")


def normalize(s: str) -> str:
    return _STRIP.sub("", unicodedata.normalize("NFKD", s)).casefold()


def join_tags(tags):
    return ",".join(tags) if tags else None


def convert(d, entry_id, sense_id):
    """항목 하나를 각 테이블 행으로 변환한다."""
    word = d["word"]
    head = None
    ht = d.get("head_templates")
    if ht:
        head = ht[0].get("expansion")
    ety = d.get("etymology_text") or None
    entry = (
        entry_id, word, normalize(word), d["lang_code"], d["lang"], d.get("pos"),
        ety, d.get("etymology_number"), head,
    )

    senses, rels = [], []
    seen_rel = set()

    def add_rel(rtype, target):
        key = (rtype, target)
        if target and key not in seen_rel:
            seen_rel.add(key)
            rels.append((entry_id, rtype, target))

    for s in d.get("senses", ()):
        glosses = s.get("glosses")
        if glosses:
            exs = []
            for ex in s.get("examples", ())[:3]:
                if ex.get("text"):
                    e = {"text": ex["text"]}
                    if ex.get("ref"):
                        e["ref"] = ex["ref"]
                    exs.append(e)
            senses.append((
                sense_id, entry_id, "\n".join(glosses), join_tags(s.get("tags")),
                json.dumps(exs, ensure_ascii=False) if exs else None,
            ))
            sense_id += 1
        for key in ("form_of", "alt_of"):
            for t in s.get(key, ()):
                add_rel(key, t.get("word"))
        for key in RELATION_KEYS:
            for t in s.get(key, ()):
                add_rel(key, t.get("word"))
    for key in RELATION_KEYS:
        for t in d.get(key, ()):
            add_rel(key, t.get("word"))

    sounds = []
    for s in d.get("sounds", ()):
        ipa, ogg, mp3 = s.get("ipa"), s.get("ogg_url"), s.get("mp3_url")
        if ipa or ogg or mp3:
            sounds.append((entry_id, ipa, join_tags(s.get("tags")), ogg, mp3))

    forms = []
    seen_form = set()
    for f in d.get("forms", ()):
        form = f.get("form")
        tags = f.get("tags") or []
        if not form or form == "-" or SKIP_FORM_TAGS.intersection(tags):
            continue
        key = (form, tuple(tags))
        if key in seen_form:
            continue
        seen_form.add(key)
        forms.append((entry_id, form, normalize(form), join_tags(tags)))

    return entry, senses, sounds, forms, rels, sense_id


def count_langs(src, limit):
    """1단계: 언어별 항목 수를 센다. (적재 대상 언어를 고르기 위한 사전 패스)"""
    counts = {}
    t0 = time.time()
    with gzip.open(src, "rt", encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            if limit and n > limit:
                break
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            code = d.get("lang_code")
            if "word" in d and code:
                counts[code] = counts.get(code, 0) + 1
            if n % 500000 == 0:
                print(f"\r[1/2 언어별 집계] {n:>10,} lines  {time.time() - t0:5.0f}s", end="", file=sys.stderr, flush=True)
    print(file=sys.stderr)
    return counts


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=DEFAULT_SRC)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--limit", type=int, default=0, help="앞쪽 N줄만 처리 (테스트용)")
    ap.add_argument(
        "--min-lang-entries", type=int, default=1000,
        help="항목 수가 이 값을 넘는 언어만 적재 (기본 1000, 0이면 전부 적재)",
    )
    ap.add_argument("--batch", type=int, default=50000, help="커밋 단위(항목 수)")
    args = ap.parse_args()

    if not os.path.exists(args.src):
        sys.exit(f"원본 파일이 없습니다: {args.src}")
    if os.path.exists(args.out):
        sys.exit(f"이미 있습니다: {args.out} (지우고 다시 실행하세요)")
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)

    keep = None
    if args.min_lang_entries > 0:
        counts = count_langs(args.src, args.limit)
        keep = {c for c, k in counts.items() if k > args.min_lang_entries}
        dropped_entries = sum(k for c, k in counts.items() if c not in keep)
        print(
            f"언어 {len(counts):,}개 중 {len(keep):,}개 적재 (항목 {args.min_lang_entries:,}개 이하 "
            f"{len(counts) - len(keep):,}개 언어, {dropped_entries:,}개 항목 제외)"
        )

    db = sqlite3.connect(args.out)
    db.executescript("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-400000;")
    db.executescript(SCHEMA)

    t0 = time.time()
    entry_id = sense_id = 1
    skipped = skipped_lang = bad = 0
    buf = {"e": [], "s": [], "so": [], "f": [], "r": []}

    def flush():
        db.executemany("INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?)", buf["e"])
        db.executemany("INSERT INTO senses VALUES(?,?,?,?,?)", buf["s"])
        db.executemany("INSERT INTO sounds VALUES(?,?,?,?,?)", buf["so"])
        db.executemany("INSERT INTO forms VALUES(?,?,?,?)", buf["f"])
        db.executemany("INSERT INTO relations VALUES(?,?,?)", buf["r"])
        db.commit()
        for v in buf.values():
            v.clear()

    n = 0
    with gzip.open(args.src, "rt", encoding="utf-8") as fh:
        for line in fh:
            if args.limit and n >= args.limit:
                break
            n += 1
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                bad += 1
                continue
            if "word" not in d or "lang_code" not in d or "lang" not in d:
                skipped += 1  # 리다이렉트 등
                continue
            if keep is not None and d["lang_code"] not in keep:
                skipped_lang += 1
                continue
            entry, senses, sounds, forms, rels, sense_id = convert(d, entry_id, sense_id)
            entry_id += 1
            buf["e"].append(entry)
            buf["s"].extend(senses)
            buf["so"].extend(sounds)
            buf["f"].extend(forms)
            buf["r"].extend(rels)
            if len(buf["e"]) >= args.batch:
                flush()
                print(f"\r{n:>10,} lines  {entry_id - 1:>10,} entries  {time.time() - t0:7.0f}s", end="", file=sys.stderr, flush=True)
    flush()
    print(file=sys.stderr)
    print(f"적재 완료: entries={entry_id - 1:,} senses={sense_id - 1:,} (리다이렉트 등 {skipped:,}, 소규모 언어 {skipped_lang:,}, 파싱오류 {bad:,}) {time.time() - t0:.0f}s")

    print("인덱스 생성 중...")
    db.executescript(INDEXES)
    print("FTS 인덱스 생성 중... (오래 걸립니다)")
    db.executescript(FTS)
    db.execute("INSERT INTO meta VALUES('source', ?)", (os.path.basename(args.src),))
    db.execute("INSERT INTO meta VALUES('built_at', datetime('now'))")
    db.commit()
    db.execute("ANALYZE")
    db.close()
    print(f"완료: {args.out} ({os.path.getsize(args.out) / 1e9:.2f} GB), 총 {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
