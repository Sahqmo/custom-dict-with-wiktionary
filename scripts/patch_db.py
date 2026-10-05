#!/usr/bin/env python3
"""이미 만들어 둔 dictionary.sqlite에 검색 개선용 데이터를 덧붙인다. (전체 재적재 없이 몇 분이면 끝난다.)

    python scripts/patch_db.py                 # 전부
    python scripts/patch_db.py --skip-redirects  # 원본(raw)을 다시 읽는 느린 단계 생략

하는 일 (이미 된 단계는 건너뛰므로 여러 번 실행해도 안전하다):
  1. entries.weight  : 항목의 뜻 개수(활용형/대체 표기 뜻 제외). 접두사 검색/자동완성에서 흔한 단어를 위로 올리는 데 쓴다.
  2. 인덱스          : (lang_code, norm_word) — 언어를 고른 접두사 검색을 빠르게 한다.
  3. langs 테이블    : 언어별 항목 수. 서버가 시작할 때 1,000만 행을 집계하지 않아도 된다.
  4. 리다이렉트 목적지: 원본의 soft-redirect 항목에 있는 redirects 를 relations(type='redirect')로 넣는다.

서버가 DB를 열고 있으면 먼저 끄고 실행할 것. 속도를 위해 저널을 끈다 — 도중에 전원이 나가면 DB가 깨질 수 있지만
DB는 ingest.py 로 언제든 다시 만들 수 있다.
"""
import argparse
import gzip
import json
import os
import sqlite3
import sys
import time

DEFAULT_DB = os.path.join("data", "dictionary.sqlite")
DEFAULT_SRC = os.path.join("data", "raw", "raw-wiktextract-data.jsonl.gz")


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def has_column(db, table, col):
    return any(r[1] == col for r in db.execute(f"PRAGMA table_info({table})"))


def has_table(db, name):
    return db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None


def has_index(db, name):
    return db.execute("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?", (name,)).fetchone() is not None


WEIGHT_VERSION = "2"


def step_weight(db):
    # v1: 뜻 줄 개수. 독일어 형용사 활용형 항목은 "…의 강변화 주격" 같은 줄이 10개씩이라 활용형이 원형(Haus)보다 위로 올라왔다.
    # v2: 활용형/대체 표기 뜻(tags에 form-of / alt-of)은 세지 않는다 → 활용형만 있는 항목은 0.
    done = db.execute("SELECT value FROM meta WHERE key='weight_v'").fetchone() if has_table(db, "meta") else None
    if done and done[0] == WEIGHT_VERSION and has_column(db, "entries", "weight"):
        log("weight: 최신 버전 — 건너뜀")
        return
    log("weight: 열 준비 + 활용형을 뺀 뜻 개수 계산 중... (몇 분 걸립니다)")
    if not has_column(db, "entries", "weight"):
        db.execute("ALTER TABLE entries ADD COLUMN weight INTEGER NOT NULL DEFAULT 0")
    db.execute(
        """UPDATE entries SET weight = t.c
             FROM (SELECT entry_id,
                          SUM(CASE WHEN (',' || COALESCE(tags, '') || ',') LIKE '%,form-of,%'
                                     OR (',' || COALESCE(tags, '') || ',') LIKE '%,alt-of,%' THEN 0 ELSE 1 END) AS c
                     FROM senses GROUP BY entry_id) AS t
            WHERE entries.id = t.entry_id"""
    )
    db.execute("INSERT OR REPLACE INTO meta VALUES('weight_v', ?)", (WEIGHT_VERSION,))
    db.commit()
    log("weight: 완료")


def step_index(db):
    if has_index(db, "idx_entries_lang_norm"):
        log("인덱스: 이미 있음 — 건너뜀")
        return
    log("인덱스: (lang_code, norm_word) 생성 중...")
    db.execute("CREATE INDEX idx_entries_lang_norm ON entries(lang_code, norm_word)")
    db.commit()
    log("인덱스: 완료")


def step_langs(db):
    if has_table(db, "langs"):
        log("langs: 이미 있음 — 건너뜀")
        return
    log("langs: 언어별 항목 수 집계 중...")
    db.execute("CREATE TABLE langs(lang_code TEXT PRIMARY KEY, lang TEXT NOT NULL, count INTEGER NOT NULL)")
    # 같은 코드에 이름이 여러 개 붙은 경우가 있어 코드 기준으로 묶는다.
    db.execute("INSERT INTO langs SELECT lang_code, MIN(lang), COUNT(*) FROM entries GROUP BY lang_code")
    db.commit()
    log(f"langs: 완료 ({db.execute('SELECT COUNT(*) FROM langs').fetchone()[0]}개 언어)")


def step_redirects(db, src):
    already = db.execute("SELECT COUNT(*) FROM relations WHERE type='redirect'").fetchone()[0]
    if already:
        log(f"리다이렉트: 이미 {already:,}개 있음 — 건너뜀")
        return
    if not os.path.exists(src):
        log(f"리다이렉트: 원본이 없어 건너뜀 ({src})")
        return
    log("리다이렉트: soft-redirect 항목 목록 읽는 중...")
    ids = {(w, lc): i for i, w, lc in db.execute("SELECT id, word, lang_code FROM entries WHERE pos='soft-redirect'")}
    log(f"리다이렉트: 대상 항목 {len(ids):,}개. 원본을 훑는 중... (몇 분 걸립니다)")
    rows = []
    seen = 0
    t0 = time.time()
    with gzip.open(src, "rb") as fh:
        for n, line in enumerate(fh, 1):
            if b'"soft-redirect"' not in line:
                continue
            d = json.loads(line)
            if d.get("pos") != "soft-redirect":
                continue
            eid = ids.get((d.get("word"), d.get("lang_code")))
            if eid is None:
                continue
            seen += 1
            for t in d.get("redirects", ()):
                if isinstance(t, str) and t:
                    rows.append((eid, "redirect", t))
            if n % 2_000_000 == 0:
                log(f"  {n:>10,} lines, 찾은 항목 {seen:,}, {time.time() - t0:.0f}s")
    db.executemany("INSERT INTO relations VALUES(?,?,?)", rows)
    db.commit()
    log(f"리다이렉트: 완료 (항목 {seen:,}개, 목적지 {len(rows):,}개)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--src", default=DEFAULT_SRC)
    ap.add_argument("--skip-redirects", action="store_true", help="원본을 다시 읽는 단계를 건너뜀")
    args = ap.parse_args()

    if not os.path.exists(args.db):
        sys.exit(f"DB가 없습니다: {args.db}")
    db = sqlite3.connect(args.db)
    db.executescript("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-800000; PRAGMA temp_store=MEMORY;")
    t0 = time.time()
    step_weight(db)
    step_index(db)
    step_langs(db)
    if not args.skip_redirects:
        step_redirects(db, args.src)
    log("ANALYZE...")
    db.execute("ANALYZE")
    db.commit()
    db.close()
    log(f"끝. 총 {time.time() - t0:.0f}s, DB {os.path.getsize(args.db) / 1e9:.2f} GB")


if __name__ == "__main__":
    main()
