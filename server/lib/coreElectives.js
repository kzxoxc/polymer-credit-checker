import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "..", "..", "data", "coreElectiveAreas.json");

let cache = null;
export function getCoreElectiveAreas() {
  if (!cache) cache = JSON.parse(readFileSync(FILE, "utf8"));
  return cache;
}
