import {
  buildCatalog,
  matchCourse,
  buildCoreElectiveIndex,
  matchCoreElective,
  buildConvergenceCatalog,
  matchConvergenceCourse,
  normalizeName,
  stripTranscriptPrefix,
} from "./matcher.js";
import { gradePoint, defaultRetakeThreshold } from "./gradeScale.js";
import { getCoreElectiveAreas } from "./coreElectives.js";

// courses: [{ name, credits, grade, categoryCode, year, semester }]
// convergenceMajor: 선택사항. { major, membership: 'double'|'minor' } — 반도체융합전공 등 data/convergenceMajors/*.json 항목
// convergenceOverrides: 선택사항. 주전공/융합전공 양쪽에 다 걸리는 과목 중, 기본값(주전공)이 아니라
//   융합전공 쪽으로 계산해달라고 사용자가 지정한 과목명 목록.
export function analyze({ curriculum, courses, retakeThreshold, convergenceMajor, convergenceOverrides }) {
  const catalog = buildCatalog(curriculum);
  const coreElectiveIndex = buildCoreElectiveIndex(getCoreElectiveAreas());
  const convergenceCatalog = convergenceMajor ? buildConvergenceCatalog(convergenceMajor.major) : null;
  const overrideSet = new Set((convergenceOverrides ?? []).map(normalizeName));
  const threshold = retakeThreshold ?? defaultRetakeThreshold;
  const thresholdPoint = gradePoint(threshold);

  const takenByCode = new Map(); // code -> { bucket, course, grade, gp, credits }
  const electiveRecords = [];
  const coreElectiveTaken = new Map(); // area ('1'|'2'|'4'|'6'|'swai'|'changui') -> Map<name, {name, grade, gp, credits}>
  const generalElective = []; // 전공필수/전공선택/계열교양/기초교양/핵심교양/창의/SW·AI/융합전공 어디에도 안 걸리는 "일반교양" 성격 과목
  const convergenceTaken = { fixed: new Map(), jobTraining: new Map(), elective: new Map() }; // bucket -> code -> record
  const dualEligible = []; // 주전공/융합전공 양쪽에 다 걸리는 과목 (기본은 주전공으로 계산, overrides로 옮길 수 있음)
  const retakeMandatory = [];
  const retakeRecommended = [];
  let totalCreditsEarned = 0;

  for (const c of courses) {
    const grade = String(c.grade || "").trim().toUpperCase();
    const credits = Number(c.credits) || 0;
    const displayName = stripTranscriptPrefix(c.name);
    totalCreditsEarned += credits;

    const match = matchCourse(c.name, catalog);
    const convergenceMatch = convergenceCatalog ? matchConvergenceCourse(c.name, convergenceCatalog) : null;
    const gp = gradePoint(grade);
    const failing = grade === "F";

    if (failing) {
      retakeMandatory.push({ name: displayName, year: c.year, semester: c.semester, grade, matchedBucket: match?.bucket ?? null });
    } else if (gp !== null && thresholdPoint !== null && gp <= thresholdPoint) {
      retakeRecommended.push({ name: displayName, year: c.year, semester: c.semester, grade, matchedBucket: match?.bucket ?? null });
    }

    // 학칙상 "주전공의 전공필수 종별변경 불가" — 전공필수/계열교양/기초교양처럼 고정된 항목은
    // 다른 전공으로 옮길 수 없고, 전공선택(택할 수 있는 학점)끼리 겹칠 때만 재배정을 허용한다.
    const movable = !!match && !!convergenceMatch && match.bucket === "전공선택";
    const wantsConvergence = movable && overrideSet.has(normalizeName(c.name));

    if (match && convergenceMatch) {
      dualEligible.push({ name: displayName, credits, grade, countedToward: wantsConvergence ? "convergence" : "primary", movable });
    }

    if (match && !wantsConvergence) {
      if (match.bucket === "전공선택") {
        electiveRecords.push({ code: match.course.code, name: match.course.name, credits, grade, gp });
      } else {
        const code = match.course.code ?? match.course.name;
        const existing = takenByCode.get(code);
        if (!existing || (gp ?? -1) > (existing.gp ?? -1)) {
          takenByCode.set(code, { bucket: match.bucket, course: match.course, grade, gp, credits });
        }
      }
      continue;
    }

    if (convergenceMatch) {
      const code = convergenceMatch.course.code ?? convergenceMatch.course.name;
      const bucketMap = convergenceTaken[convergenceMatch.bucket];
      const existing = bucketMap.get(code);
      if (!existing || (gp ?? -1) > (existing.gp ?? -1)) {
        bucketMap.set(code, { code, name: convergenceMatch.course.name, credits, grade, gp });
      }
      continue;
    }

    const coreArea = matchCoreElective(c.name, coreElectiveIndex);
    if (coreArea) {
      if (!coreElectiveTaken.has(coreArea)) coreElectiveTaken.set(coreArea, new Map());
      const areaMap = coreElectiveTaken.get(coreArea);
      const existing = areaMap.get(displayName);
      if (!existing || (gp ?? -1) > (existing.gp ?? -1)) {
        areaMap.set(displayName, { name: displayName, grade, gp, credits });
      }
      continue;
    }

    generalElective.push({ name: displayName, categoryCode: c.categoryCode, credits, grade });
  }

  function buildFixedReport(courseList) {
    const items = (courseList ?? []).map((course) => {
      const code = course.code ?? course.name;
      const rec = takenByCode.get(code);
      return {
        code: course.code,
        name: course.name,
        credits: course.credits,
        status: rec ? "이수" : "미이수",
        grade: rec?.grade ?? null,
      };
    });
    const missing = items.filter((i) => i.status === "미이수");
    return { items, missingCount: missing.length, missingCredits: missing.reduce((s, i) => s + i.credits, 0) };
  }

  const majorRequired = buildFixedReport(curriculum.categories["전공필수"]?.courses);
  const generalCore = buildFixedReport(curriculum.categories["계열교양"]?.courses);
  const fixedGeneral = buildFixedReport(curriculum.categories["기초교양"]?.courses);

  const englishOptions = curriculum.categories["의사소통영어"]?.options ?? [];
  let englishTaken = null;
  for (const o of englishOptions) {
    const rec = takenByCode.get(o.code ?? o.name);
    if (rec) { englishTaken = rec; break; }
  }
  const english = {
    satisfied: !!englishTaken,
    taken: englishTaken ? { name: englishTaken.course.name, grade: englishTaken.grade } : null,
  };

  const electiveByCode = new Map();
  for (const rec of electiveRecords) {
    const existing = electiveByCode.get(rec.code);
    if (!existing || (rec.gp ?? -1) > (existing.gp ?? -1)) electiveByCode.set(rec.code, rec);
  }
  const electiveCreditsEarned = [...electiveByCode.values()].reduce((s, r) => s + r.credits, 0);
  const electiveCourseCodes = new Set(electiveByCode.keys());
  const suggestedRemainingElectives = (curriculum.categories["전공선택"]?.courses ?? []).filter(
    (c) => !electiveCourseCodes.has(c.code)
  );

  const majorRequiredCreditsEarned = majorRequired.items
    .filter((i) => i.status === "이수")
    .reduce((s, i) => s + i.credits, 0);
  const majorTotalEarned = majorRequiredCreditsEarned + electiveCreditsEarned;

  // 단일전공 기준 전공 최소학점(65)은 복수전공/부전공 시 그대로 적용되지 않는다.
  // 복수전공: 주전공 39학점 + 복수전공 39학점 = 78학점(각 전공은 39학점만 채우면 됨).
  // 부전공: 부전공 21학점 + 주전공(65-21=44)학점.
  const DOUBLE_MAJOR_CREDITS = 39;
  const majorMinCredits = convergenceMajor
    ? convergenceMajor.membership === "minor"
      ? Math.max(0, curriculum.majorMinCredits - convergenceMajor.major.minorTotalCredits)
      : DOUBLE_MAJOR_CREDITS
    : curriculum.majorMinCredits;

  // 택1이라도 과목마다 학점이 다르므로(예: 발명과 특허 2학점) 이수한 과목들의 학점 합계가
  // 요구 학점 이상이어야 충족으로 처리한다.
  function buildElectiveAreaReport(indexKey, label, requiredCredits) {
    const takenMap = coreElectiveTaken.get(indexKey);
    const takenCourses = takenMap ? [...takenMap.values()] : [];
    const creditsEarned = takenCourses.reduce((s, t) => s + t.credits, 0);
    return {
      label,
      requiredCredits,
      creditsEarned,
      satisfied: creditsEarned >= requiredCredits,
      missingCredits: Math.max(0, requiredCredits - creditsEarned),
      takenCourses: takenCourses.map(({ name, grade, credits }) => ({ name, grade, credits })),
    };
  }

  const coreElective = (curriculum.categories["핵심교양"]?.areas ?? []).map((areaDef) => {
    const areaKey = areaDef.name.match(/^(\d+)/)?.[1];
    const report = buildElectiveAreaReport(areaKey, areaDef.name, areaDef.credits);
    return { area: areaKey, ...report };
  });
  const coreElectiveMissingCredits = coreElective.reduce((s, a) => s + a.missingCredits, 0);

  function buildSingleElectiveReport(categoryKey, indexKey, label) {
    const category = curriculum.categories[categoryKey];
    if (!category) return null;
    return buildElectiveAreaReport(indexKey, label, category.credits);
  }

  const swaiElective = buildSingleElectiveReport("SW·AI 일반교양7영역", "swai", "일반교양 7영역 (SW·AI)");
  const creativeElective = buildSingleElectiveReport("창의영역", "changui", "창의영역");

  let convergence = null;
  if (convergenceMajor) {
    const { major, membership } = convergenceMajor;
    const requiredTotalCredits = membership === "minor" ? major.minorTotalCredits : major.doubleMajorTotalCredits;

    const fixedItems = (major.requiredFixed ?? []).map((course) => {
      const rec = convergenceTaken.fixed.get(course.code ?? course.name);
      return { code: course.code, name: course.name, credits: course.credits, status: rec ? "이수" : "미이수", grade: rec?.grade ?? null };
    });
    const fixedCreditsEarned = fixedItems.filter((i) => i.status === "이수").reduce((s, i) => s + i.credits, 0);

    const jobTrainingTaken = [...convergenceTaken.jobTraining.values()];
    const jobTrainingCreditsEarned = jobTrainingTaken.reduce((s, t) => s + t.credits, 0);
    const jobTrainingRequired = major.jobTrainingPool?.minCredits ?? 0;

    const electiveTaken = [...convergenceTaken.elective.values()];
    const electiveCreditsEarned = electiveTaken.reduce((s, t) => s + t.credits, 0);

    const totalCreditsEarned2 = fixedCreditsEarned + jobTrainingCreditsEarned + electiveCreditsEarned;

    convergence = {
      id: major.id,
      name: major.name,
      membership,
      requiredFixed: {
        items: fixedItems,
        missingCount: fixedItems.filter((i) => i.status === "미이수").length,
      },
      jobTraining: {
        requiredCredits: jobTrainingRequired,
        creditsEarned: jobTrainingCreditsEarned,
        satisfied: jobTrainingCreditsEarned >= jobTrainingRequired,
        missingCredits: Math.max(0, jobTrainingRequired - jobTrainingCreditsEarned),
        takenCourses: jobTrainingTaken.map(({ name, credits, grade }) => ({ name, credits, grade })),
      },
      elective: {
        creditsEarned: electiveCreditsEarned,
        takenCourses: electiveTaken.map(({ name, credits, grade }) => ({ name, credits, grade })),
      },
      totalCredits: {
        earned: totalCreditsEarned2,
        required: requiredTotalCredits,
        remaining: Math.max(0, requiredTotalCredits - totalCreditsEarned2),
      },
      dualEligible,
    };
  }

  return {
    cohortYear: curriculum.cohortYear,
    englishCertification: curriculum.englishCertification ?? null,
    totals: {
      totalCreditsEarned,
      graduationCredits: curriculum.graduationCredits,
      remaining: Math.max(0, curriculum.graduationCredits - totalCreditsEarned),
    },
    major: {
      required: majorRequired,
      elective: {
        creditsEarned: electiveCreditsEarned,
        takenCourses: [...electiveByCode.values()].map(({ code, name, credits, grade }) => ({ code, name, credits, grade })),
        suggestedRemaining: suggestedRemainingElectives,
        // 전공필수 잔여 과목은 어차피 이수해야 하고 그 학점도 전공 총 이수학점에 포함되므로,
        // "전공선택에서 추가로 더 들어야 하는 학점"은 총 잔여학점에서 전공필수 잔여학점을 뺀 나머지다.
        stillNeededBeyondRequired: Math.max(
          0,
          Math.max(0, majorMinCredits - majorTotalEarned) - majorRequired.missingCredits
        ),
      },
      totalMajorCredits: {
        earned: majorTotalEarned,
        required: majorMinCredits,
        remaining: Math.max(0, majorMinCredits - majorTotalEarned),
      },
    },
    generalCore,
    fixedGeneral,
    english,
    coreElective: {
      areas: coreElective,
      missingCredits: coreElectiveMissingCredits,
    },
    swaiElective,
    creativeElective,
    retake: {
      threshold,
      mandatory: retakeMandatory,
      recommended: retakeRecommended,
    },
    generalElective,
    convergence,
  };
}

