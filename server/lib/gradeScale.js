import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "..", "..", "data", "gradeScale.json");

const scale = JSON.parse(readFileSync(FILE, "utf8"));

export function gradePoint(grade) {
  const key = (grade || "").trim().toUpperCase();
  if (!(key in scale.grades)) return null;
  return scale.grades[key];
}

export const defaultRetakeThreshold = scale.defaultRetakeThreshold;
export const allGrades = Object.keys(scale.grades);
