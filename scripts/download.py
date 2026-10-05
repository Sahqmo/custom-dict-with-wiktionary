"""Wiktionary 데이터 다운로드 (이어받기 지원, 표준 라이브러리만 사용).

사용법:
  python scripts/download.py            # kaikki 전 언어 JSONL (권장, ~3GB)
  python scripts/download.py --dump     # 영어판 공식 XML 덤프 (~1.6GB)
  python scripts/download.py --all      # 둘 다
"""
import argparse
import sys
import time
import urllib.request
from pathlib import Path

SOURCES = {
    "kaikki": (
        "https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz",
        "raw-wiktextract-data.jsonl.gz",
    ),
    "dump": (
        "https://dumps.wikimedia.org/enwiktionary/latest/enwiktionary-latest-pages-articles.xml.bz2",
        "enwiktionary-latest-pages-articles.xml.bz2",
    ),
}
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
UA = "personal-wiktionary-offline/0.1 (sunkenfoxstudio@gmail.com)"


def remote_size(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return int(r.headers["Content-Length"])


def download(url, dest):
    total = remote_size(url)
    part = dest.with_suffix(dest.suffix + ".part")
    if dest.exists() and dest.stat().st_size == total:
        print(f"[skip] {dest.name} 이미 완료 ({total / 1e9:.2f} GB)")
        return
    while True:
        done = part.stat().st_size if part.exists() else 0
        if done >= total:
            break
        headers = {"User-Agent": UA}
        if done:
            headers["Range"] = f"bytes={done}-"
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, headers=headers), timeout=60
            ) as r, open(part, "ab" if done else "wb") as f:
                if done and r.status != 206:  # 서버가 Range 무시 -> 처음부터
                    f.truncate(0)
                    done = 0
                start, t0 = done, time.time()
                while chunk := r.read(1 << 20):
                    f.write(chunk)
                    done += len(chunk)
                    speed = (done - start) / max(time.time() - t0, 1e-6) / 1e6
                    print(
                        f"\r{dest.name}: {done / 1e9:.2f}/{total / 1e9:.2f} GB "
                        f"({done * 100 / total:.1f}%) {speed:.1f} MB/s",
                        end="", flush=True,
                    )
        except OSError as e:
            print(f"\n[retry] {e}; 5초 후 이어받기")
            time.sleep(5)
    part.replace(dest)
    print(f"\n[ok] {dest}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump", action="store_true", help="공식 XML 덤프만")
    ap.add_argument("--all", action="store_true", help="둘 다")
    args = ap.parse_args()
    keys = ["kaikki", "dump"] if args.all else ["dump"] if args.dump else ["kaikki"]
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for k in keys:
        url, name = SOURCES[k]
        download(url, DATA_DIR / name)


if __name__ == "__main__":
    sys.exit(main())
