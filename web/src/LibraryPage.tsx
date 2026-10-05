import { useState } from 'react'
import type { Saved } from './api'
import { relativeTime, t } from './i18n'
import { clearHistory, loadLibrary, removeFavorite, removeHistory, useLibrary } from './library'
import { hrefEntry } from './routes'

function Row({ item, onRemove, removeLabel }: { item: Saved; onRemove: () => void; removeLabel: string }) {
  return (
    <li className="lib-row">
      <a className="row" href={hrefEntry(item.lang_code, item.word)}>
        <span className="w">{item.word}</span>
        <span className="meta">
          <span className="pill">{item.lang}</span>
          <span className="when">{relativeTime(item.at)}</span>
        </span>
      </a>
      <button className="icon-btn small" onClick={onRemove} title={removeLabel} aria-label={removeLabel}>
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
      <h1>{t('lib.title')}</h1>
      <p className="muted lead">{t('lib.lead')}</p>

      <div className="lib-head">
        <div className="segmented" role="tablist" aria-label={t('lib.tabs')}>
          <button role="tab" aria-selected={tab === 'fav'} className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}>
            {t('lib.favorites')} <span className="count-pill">{lib.favorites.length}</span>
          </button>
          <button role="tab" aria-selected={tab === 'hist'} className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>
            {t('lib.history')} <span className="count-pill">{lib.history.length}</span>
          </button>
        </div>
        {tab === 'hist' && lib.history.length > 0 && (
          <button
            className="btn"
            onClick={() => {
              if (confirm(t('lib.clearConfirm'))) clearHistory()
            }}
          >
            {t('lib.clearAll')}
          </button>
        )}
      </div>

      {lib.failed ? (
        <p className="error status">
          {t('lib.failed')} <button className="btn" onClick={() => loadLibrary(true)}>{t('lib.retry')}</button>
        </p>
      ) : !lib.loaded ? (
        <p className="muted status">{t('status.loading')}</p>
      ) : list.length === 0 ? (
        <p className="muted status">
          {tab === 'fav' ? (
            <>
              {t('lib.emptyFavBefore')}
              <span aria-hidden="true">☆</span>
              {t('lib.emptyFavAfter')}
            </>
          ) : (
            t('lib.emptyHist')
          )}
        </p>
      ) : (
        <section className="card">
          <ul>
            {list.map((it) => (
              <Row
                key={`${it.lang_code}\t${it.word}`}
                item={it}
                removeLabel={t(tab === 'fav' ? 'lib.removeFav' : 'lib.removeHist', { word: it.word })}
                onRemove={() => (tab === 'fav' ? removeFavorite(it.lang_code, it.word) : removeHistory(it.lang_code, it.word))}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
