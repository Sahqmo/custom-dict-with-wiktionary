// 즐겨찾기/검색 기록 저장소. 18GB 단어 DB는 읽기 전용이라 건드리지 않고, 쓰기가 필요한 건 별도 파일에 둔다.
// data/ 아래라서 git에는 올라가지 않는다 (개인 데이터).
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const USER_DB_PATH = process.env.USER_DB ?? path.join(root, "data", "user.sqlite");

const HISTORY_MAX = 1000;

const db = new Database(USER_DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites(
    lang_code TEXT NOT NULL,
    word TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY(lang_code, word)
  );
  CREATE TABLE IF NOT EXISTS history(
    lang_code TEXT NOT NULL,
    word TEXT NOT NULL,
    visited_at INTEGER NOT NULL,
    visits INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY(lang_code, word)
  );
  CREATE INDEX IF NOT EXISTS idx_history_time ON history(visited_at DESC);
`);

export type Saved = { lang_code: string; word: string; at: number };

const listFav = db.prepare("SELECT lang_code, word, added_at AS at FROM favorites ORDER BY added_at DESC");
const addFav = db.prepare("INSERT INTO favorites(lang_code, word, added_at) VALUES(?, ?, ?) ON CONFLICT DO NOTHING");
const delFav = db.prepare("DELETE FROM favorites WHERE lang_code = ? AND word = ?");

const listHist = db.prepare("SELECT lang_code, word, visited_at AS at FROM history ORDER BY visited_at DESC LIMIT ?");
const upsertHist = db.prepare(
  `INSERT INTO history(lang_code, word, visited_at, visits) VALUES(?, ?, ?, 1)
   ON CONFLICT(lang_code, word) DO UPDATE SET visited_at = excluded.visited_at, visits = visits + 1`,
);
const trimHist = db.prepare(
  `DELETE FROM history WHERE rowid IN (SELECT rowid FROM history ORDER BY visited_at DESC LIMIT -1 OFFSET ${HISTORY_MAX})`,
);
const delHist = db.prepare("DELETE FROM history WHERE lang_code = ? AND word = ?");
const clearHist = db.prepare("DELETE FROM history");

export const favorites = {
  list: () => listFav.all() as Saved[],
  add: (lang: string, word: string) => void addFav.run(lang, word, Date.now()),
  remove: (lang: string, word: string) => void delFav.run(lang, word),
};

export const history = {
  list: (limit = 200) => listHist.all(limit) as Saved[],
  visit: (lang: string, word: string) => {
    upsertHist.run(lang, word, Date.now());
    trimHist.run();
  },
  remove: (lang: string, word: string) => void delHist.run(lang, word),
  clear: () => void clearHist.run(),
};
