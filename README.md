# Personal Wiktionary — 프로젝트 인수인계 문서

다른 환경(Claude Code 세션 포함)에서 이어서 작업할 수 있도록 정리한 문서입니다. 이 파일과 `scripts/download.py`만 옮기면 됩니다.

## 1. 목표

Glosbe처럼 **거의 모든 언어의 단어를 검색**할 수 있는 **개인용 오프라인 사전**을 만든다.

- 설명 언어는 **영어로 고정** (English Wiktionary 기반).
- **"번역 쌍" 구조는 피한다.** A언어 단어 → B언어 대응어 목록이 아니라, 단어 자체의 **영어 정의(gloss)·어원·발음·활용형·관련어**를 보여주는 사전으로 만든다. Wiktionary의 translation 표는 기본 화면에서 빼고, 필요하면 접어서 보는 옵션으로만 둔다.
- 개인용이므로 **로컬 서버로 돌려도 되고**, React 같은 구조로 정돈해도 된다.
- 라이선스: Wiktionary 내용은 CC BY-SA. 개인용이어도 화면 하단에 출처 표기를 넣는다.

## 2. 결정된 사항

- 데이터 출처: **kaikki.org의 Wiktextract JSONL** (영어판 Wiktionary를 이미 구조화한 파일).
  - 영어판 공식 XML 덤프(`enwiktionary-latest-pages-articles.xml.bz2`, 약 1.6GB)는 위키텍스트 템플릿을 직접 파싱해야 하므로 **쓰지 않는다.** (kaikki 데이터에 빠진 부분을 확인할 때만 선택적으로 받는다.)
  - 참고로 사용자가 처음 가리킨 `de.wiktionary.org/wiki/Wiktionary:Download`는 **독일어판**이라 정의가 독일어다. 영어 설명 조건에 맞지 않아 영어판/kaikki 주소를 쓴다.
- 저장소: **SQLite (FTS5)**. 전 언어를 담으면 데이터가 수 GB라서 브라우저에 통째로 올릴 수 없다.
- 구조: `kaikki JSONL → ingest 스크립트 → dictionary.sqlite → API 서버 → React UI`
- 기본 스택(아직 확정은 아님, 선호가 없으면 이대로 진행): **Node(Fastify) + React + Vite + TypeScript**. ingest만 Python으로 하고, 전부 Node로 통일할 수도 있다.

## 3. 현재 상태

| 단계 | 상태 |
|---|---|
| 설계 | 완료 |
| `scripts/download.py` (다운로드 스크립트) | 작성 완료 |
| 데이터 다운로드 | **미완료.** 이 PC는 속도가 느려 유선랜 환경에서 받는 중 |
| JSONL 구조 확인 | 대기 (다운로드 후) |
| ingest 스크립트 / DB | 대기 |
| API 서버 / React UI | 대기 |

## 4. 다른 환경에서 해야 할 일

### 4.1 다운로드

환경: Python 3.12 (표준 라이브러리만 사용), 디스크 여유 20GB 이상 권장.

```
python scripts/download.py
```

- `data/raw/raw-wiktextract-data.jsonl.gz` (약 3GB)가 생긴다. URL은 `https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz` (HTTP 200 확인됨).
- 끊기면 `.part` 파일에서 이어받는다. 이미 완료된 파일은 건너뛴다.
- `--dump`(영어판 XML 덤프)와 `--all`은 **지금은 필요 없다.**

### 4.2 이 PC로 가져오기

다운로드한 `raw-wiktextract-data.jsonl.gz`를 이 프로젝트의 `data/raw/` 아래에 복사한다. (또는 다른 환경에서 ingest까지 끝내고 `dictionary.sqlite`만 가져와도 된다.)

## 5. 다음 단계 (다운로드 완료 후)

원본 파일 전체를 대화나 콘솔에 출력하지 말고, 스크립트로 스트리밍 처리한다. 구조 확인은 앞쪽 몇 줄만 본다.

1. **데이터 확인**: JSONL 앞부분 몇 줄과 필드 구조를 확인한다. 항목 하나는 한 줄의 JSON이며, `word`, `lang`, `lang_code`, `pos`, `senses`, `forms`, `sounds`, `etymology_text` 등을 가진다. (필드 이름은 raw 데이터라 실제 파일로 확인할 것)
2. **ingest 스크립트** (`scripts/ingest.py` 예정): gz를 스트리밍으로 읽어 SQLite에 적재한다. 쓰지 않는 필드는 버려 크기를 줄인다.
3. **API + 최소 UI**: 검색과 항목 페이지부터 만든다.
4. **부가 기능**: 역방향(정의로 찾기) 검색, 즐겨찾기, 오디오 등.

## 6. DB 스키마 초안

- `entries(id, word, norm_word, lang_code, lang, pos, etymology, ...)`
- `senses(entry_id, gloss, tags, examples)`
- `sounds(entry_id, ipa, audio_ref)`
- `forms(entry_id, form, norm_form, tags)`: 활용형에서 원형으로 연결
- `relations(entry_id, type, target)`: 동의어, 파생어, 하위어 등
- `norm_word` / `norm_form`: 검색용 정규화 키 (소문자화, 발음 구별 기호 제거, 한글 자모 분해 등)
- **FTS5** 가상 테이블: 영어 정의 텍스트 역방향 검색용

## 7. 검색/UI 동작 설계

- 검색 순서: 표제어 정확 일치 → 정규화 일치 → 접두사 일치. 활용형에 맞으면 원형 항목으로 안내한다.
- 같은 철자가 여러 언어에 있으면 **언어별로 묶어서** 보여준다. 언어 필터와 품사 필터를 둔다.
- 항목 페이지: 품사별 정의, 어원, IPA와 오디오, 활용형 표, 관련어 링크.
- 정의 텍스트로 찾는 역방향 검색(FTS)은 별도 탭.
- 기록, 즐겨찾기(서버 쪽 SQLite 테이블에 저장), 다크 모드.

## 8. 예상 규모와 주의점

- 최종 SQLite는 필드를 줄이면 대략 3~8GB로 예상한다. (실측 전 추정치)
- ingest는 한 번 돌리는 데 수십 분에서 1시간 정도를 예상한다. 스트리밍 처리라 메모리는 크게 필요 없다.
- 데이터 갱신은 새 덤프를 받아 DB를 다시 만드는 방식으로 한다.

## 9. 작업 환경 메모

- 원래 작업 PC: Windows 11, Python 3.12, Node 24. 프로젝트 경로는 `Documents\Sahqmo Projects\Wiktionary`.
- 다른 환경에서 이어갈 Claude Code 세션은 **이 문서를 먼저 읽고** 4.1부터 진행하면 된다.
