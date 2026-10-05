import { useState } from 'react'
import type { Saved } from './api'
import { clearHistory, loadLibrary, removeFavorite, removeHistory, useLibrary } from './library'
import { hrefEntry } from './routes'

const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' })

/** "3분 전", "어제" 같은 상대 시간 */
function ago(at: number): string {
  const sec = Math.round((at - Date.now()) / 1000)
  const abs = Math.abs(sec)
  if (abs < 60) return '방금'
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), 'day')
  return new Date(at).toLocaleDateString('ko')
}

function Row({ item, onRemove, label }: { item: Saved; onRemove: () => void; label: string }) {
  return (
    <li className="lib-row">
      <a className="row" href={hrefEntry(item.lang_code, item.word)}>
        <span className="w">{item.word}</span>
        <span className="meta">
          <span className="pill">{item.lang}</span>
          <span className="when">{ago(item.at)}</span>
        </span>
      </a>
      <button className="icon-btn small" onClick={onRemove} title={`${label}에서 지우기`} aria-label={`${item.word} ${label}에서 지우기`}>
        ✕
      </button>
    </li>
  )
}

/** 내 단어: 즐겨찾기와 최근 본 단어. 서버의 data/user.sqlite에 저장되어 브라우저를 바꿔도 유지된다. */
export default function LibraryPage() {
  const lib = useLibrary()
  const [tab, setTab] = useState<'fav' | 'hist'>('fav')
  const list = tab === 'fav' ? lib.favorites : lib.history

  return (
    <div className="library">
      <h1>내 단어</h1>
      <p className="muted lead">즐겨찾기와 최근 본 단어는 이 PC의 사전 서버에 저장됩니다.</p>

      <div className="lib-head">
        <div className="segmented" role="tablist" aria-label="내 단어 보기">
          <button role="tab" aria-selected={tab === 'fav'} className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}>
            즐겨찾기 <span className="count-pill">{lib.favorites.length}</span>
          </button>
          <button role="tab" aria-selected={tab === 'hist'} className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>
            최근 본 단어 <span className="count-pill">{lib.history.length}</span>
          </button>
        </div>
        {tab === 'hist' && lib.history.length > 0 && (
          <button
            className="btn"
            onClick={() => {
              if (confirm('최근 본 단어를 모두 지울까요?')) clearHistory()
            }}
          >
            기록 모두 지우기
          </button>
        )}
      </div>

      {lib.failed ? (
        <p className="error status">
          저장소에 연결하지 못했습니다. <button className="btn" onClick={() => loadLibrary(true)}>다시 시도</button>
        </p>
      ) : !lib.loaded ? (
        <p className="muted status">불러오는 중…</p>
      ) : list.length === 0 ? (
        <p className="muted status">
          {tab === 'fav' ? (
            <>
              아직 즐겨찾기가 없어요. 항목 페이지의 <span aria-hidden="true">☆</span> 버튼으로 담아 보세요.
            </>
          ) : (
            '아직 본 단어가 없어요.'
          )}
        </p>
      ) : (
        <section className="card">
          <ul>
            {list.map((it) => (
              <Row
                key={`${it.lang_code}\t${it.word}`}
                item={it}
                label={tab === 'fav' ? '즐겨찾기' : '기록'}
                onRemove={() => (tab === 'fav' ? removeFavorite(it.lang_code, it.word) : removeHistory(it.lang_code, it.word))}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
