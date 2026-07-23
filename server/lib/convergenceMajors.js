import { readFileSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data", "convergenceMajors");

let cache = null;

function loadAll() {
  if (cache) return cache;
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const byId = {};
  for (const file of files) {
    const content = JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8"));
    byId[content.id] = content;
  }
  cache = byId;
  return cache;
}

export function listConvergenceMajors() {
  return Object.values(loadAll()).map(({ id, name, type }) => ({ id, name, type }));
}

export function getConvergenceMajor(id) {
  const all = loadAll();
  const major = all[id];
  if (!major) {
    throw new Error(`${id} 융합전공 데이터가 없습니다.`);
  }
  return major;
}
