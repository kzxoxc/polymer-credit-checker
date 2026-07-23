import { readFileSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data", "curricula");

let cache = null;

function loadAll() {
  if (cache) return cache;
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const byYear = {};
  for (const file of files) {
    const content = JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8"));
    byYear[content.cohortYear] = content;
  }
  cache = byYear;
  return cache;
}

export function listCohortYears() {
  return Object.keys(loadAll())
    .map(Number)
    .sort((a, b) => a - b);
}

export function getCurriculum(cohortYear) {
  const all = loadAll();
  const curriculum = all[cohortYear];
  if (!curriculum) {
    throw new Error(`${cohortYear}학번 교과과정표 데이터가 없습니다.`);
  }
  return curriculum;
}
