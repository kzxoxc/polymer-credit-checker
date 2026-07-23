import { Router } from "express";
import { getCurriculum, listCohortYears } from "../lib/curriculum.js";
import { listConvergenceMajors, getConvergenceMajor } from "../lib/convergenceMajors.js";
import { analyze } from "../lib/analyze.js";
import { allGrades, defaultRetakeThreshold } from "../lib/gradeScale.js";

const router = Router();

router.get("/cohorts", (req, res) => {
  res.json({ years: listCohortYears(), grades: allGrades, defaultRetakeThreshold });
});

router.get("/cohorts/:year", (req, res) => {
  try {
    res.json(getCurriculum(Number(req.params.year)));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get("/convergence-majors", (req, res) => {
  res.json({ majors: listConvergenceMajors() });
});

router.post("/", (req, res) => {
  const { cohortYear, courses, retakeThreshold, convergenceMajorId, convergenceMembership, convergenceOverrides } = req.body || {};
  if (!cohortYear || !Array.isArray(courses)) {
    return res.status(400).json({ error: "cohortYear와 courses 배열이 필요합니다." });
  }
  try {
    const curriculum = getCurriculum(Number(cohortYear));
    let convergenceMajor = null;
    if (convergenceMajorId) {
      convergenceMajor = {
        major: getConvergenceMajor(convergenceMajorId),
        membership: convergenceMembership === "minor" ? "minor" : "double",
      };
    }
    const report = analyze({ curriculum, courses, retakeThreshold, convergenceMajor, convergenceOverrides });
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
