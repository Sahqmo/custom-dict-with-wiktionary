import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DB_PATH = process.env.DICT_DB ?? path.join(root, "data", "dictionary.sqlite");

export const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
db.pragma("cache_size = -200000");
db.pragma("mmap_size = 1073741824");
