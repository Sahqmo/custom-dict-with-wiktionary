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
| 데이터 다운로드 | 완료 (`data/raw/raw-wiktextract-data.jsonl.gz`, 약 2.98GB) |
| JSONL 구조 확인 | 완료 |
| ingest 스크립트 / DB | 완료. `scripts/ingest.py` → `data/dictionary.sqlite` (**18.29GB**, 약 15분). entries 10.86M / senses 12.76M / forms 85.65M / relations 16.71M |
| API 서버 (`server/`, Fastify + better-sqlite3) | 완료: 검색, 항목, 정의 역검색(FTS), 언어 목록 |
| React UI (`web/`, Vite) | 최소 버전 완료: 검색, 언어별 그룹, 항목 페이지, 정의 검색 탭, 다크 모드, 출처 표기 |
| 즐겨찾기 / 기록 | 미구현 (메인 DB는 읽기 전용이므로 별도 `user.sqlite`에 저장할 예정) |

### 실행 방법

```
python scripts/ingest.py            # 최초 1회 (data/dictionary.sqlite 생성)
cd web && npm i && npm run build    # UI 빌드
cd ../server && npm i && npm start  # http://127.0.0.1:3000 (빌드된 UI도 같이 서빙)
```

UI 개발 중에는 `server`를 띄운 채 `web`에서 `npm run dev`를 실행한다 (`/api`는 3000으로 프록시).

### 구현 메모

- `norm_word` 정규화 규칙은 `scripts/ingest.py`의 `normalize()`와 `server/src/normalize.ts`가 **같아야** 한다. 바꾸면 DB를 다시 만들어야 한다.
- kaikki의 `etymology_text`에는 "Etymology tree" 계통도 줄이 앞에 붙어 있어 `server/src/queries.ts`에서 걷어낸다.
- **굴절표 엔진** (`server/src/tables/`): `forms`의 태그 조합으로 표를 조립한다. `engine.ts`는 언어를 모르고, 언어/품사별 표 정의(행·열·필수 태그)는 `specs.ts`에 선언한다. 현재 독일어/스페인어/프랑스어의 동사·명사·형용사를 지원한다. 새 언어는 `specs.ts`에 정의를 추가하고 `SPECS`에 등록하면 된다. 표에 들어가지 않은 형태는 `forms`(그 밖의 형태)로 남는다.
  - 셀 매칭: 형태의 태그가 (필수 태그 ⊆ 형태 태그 ⊆ 필수 태그 ∪ ignore) 이면 그 셀에 들어간다. `rare`/`obsolete`/`before-vowel` 등은 위치 태그가 아니라 셀 안의 비고로 표시한다.
  - 발음기호가 활용형처럼 섞인 항목(프랑스어 `paʁl`)은 걸러낸다.
  - **정관사** (`articles.ts`): 명사의 성은 `head` 문자열("Haus n (...)")에서 읽는다(`parseGenders`). 독일어는 성×격×수, 스페인어는 el/la/los/las(강세 a로 시작하는 여성 명사는 IPA 강세로 판별해 `el agua`), 프랑스어는 le/la/l'/les. 프랑스어 `h` 시작 단어는 묵음/유음 h를 IPA로 구분할 수 없어 `le/l'`로 병기한다(ingest에서 "aspirated h" 카테고리를 보존하면 해결 가능).
  - **어미 강조** (`morph.ts`): 어간(부정사에서 어미를 뗀 것)으로 시작하고 나머지가 언어별 정규 어미 목록(`*_ENDINGS`)에 있으면 어미만 `m:'e'`, 아니면 단어 전체를 불규칙 `m:'i'`로 표시한다. 스페인어/프랑스어 미래·조건법은 부정사 기준(행에 `axInf`). 독일어는 분리동사(`gehe auf`), 과거분사(`ge-…-t`), `-eln/-ern`의 e 탈락을 따로 처리한다. `bin gegangen` 같은 복합시제는 조합이라 강조하지 않는다. 설정에서 끌 수 있다(`data-hl`).
  - 한계: "어간으로 시작하는 불규칙"은 어미 목록으로만 거른다(예: `tengo`는 잡지만 어미가 우연히 목록과 같은 불규칙은 규칙형으로 보일 수 있다). 새 언어를 추가할 때 `*_ENDINGS`를 같이 정의해야 한다.
- **디자인 토큰 / 설정 페이지** (`web/src/index.css`, `settings.ts`, `SettingsPage.tsx`, 경로 `#/settings`): 색은 CSS 변수(토큰)로만 쓴다. 포인트 컬러는 라이트/다크를 따로 저장(`localStorage`의 `settings.v1`)하고 `--accent-l`/`--accent-d`로 주입하며, 파생색(`--accent-soft` 등)은 `color-mix()`로 계산한다. 포인트 컬러 위 글자색은 대비를 계산해 흰색/검정 중 자동 선택한다. 설정 미리보기는 `data-scheme` 속성으로 해당 모드 토큰을 강제해 실제 페이지와 같은 스타일로 그린다.
- **홈 헤드라인의 돌아가는 "word"** (`web/src/RotatingWord.tsx`): 36개 언어의 "단어"를 5초마다 슬라이드로 교체한다(`INTERVAL_MS`). 단어 목록은 같은 파일의 `WORDS`에 추가/수정하면 된다(언어 코드·한국어 이름·원어 이름 포함. 마우스를 올리거나 키보드 포커스가 가면 단어 위에 `독일어 · Deutsch` 같은 언어 이름이 페이드로 나타나고, 한국어 이름은 스크린리더용 이름에도 쓰인다). **DB에 실제 항목이 있는 단어만 넣을 것** — 단어를 클릭하면 그 항목 페이지(`#/entry/{코드}/{단어}`)로 이동한다. 글자가 잘리지 않도록 슬라이드 상자(`.rw-clip`)는 글자 폭보다 좌우 `0.12em`, 위아래 `0.14em` 넓게 잡았다(벵골어·데바나가리·베트남어는 글자 폭 밖으로 0.07em까지 삐져나온다). 표기와 표제어가 다르면 `entry`로 지정한다(간체 `单词` → 번체 `單詞`). 마우스를 올리거나 포커스가 있는 동안은 넘어가지 않는다. 조사 `를`은 고정이라 외국어 단어 뒤에서는 발음에 따라 어색할 수 있다. `prefers-reduced-motion`에서는 애니메이션 없이 바뀐다.
- 파일 이름 주의: Windows는 대소문자를 구분하지 않으므로 `settings.ts`와 `Settings.tsx`처럼 대소문자만 다른 파일을 만들면 TS 빌드가 깨진다.
- DB가 예상(3~8GB)보다 큰 주원인은 `forms`(8,500만 행)다. 줄여야 하면 ingest에서 forms/relations를 줄이고 다시 만든다.

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
