// 특정 로직을 새로 검증하기보다, 지금까지 여러 세션에 걸쳐 실제로 발견하고 고친 버그들이
// 다시 재발하지 않는지 고정해두는 characterization test다. 실패하면 동작이 바뀐 것이니
// 의도한 변경인지 먼저 확인할 것.
import { getCurriculum } from "../lib/curriculum.js";
import { getConvergenceMajor } from "../lib/convergenceMajors.js";
import { analyze } from "../lib/analyze.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error("FAIL:", msg);
  }
}

const curriculum2022 = getCurriculum(2022);
const semiconductor = getConvergenceMajor("semiconductor");

// 1. 기본 매칭: 전공필수/전공선택/계열교양이 이름 기준으로 정확히 잡히는지
{
  const report = analyze({
    curriculum: curriculum2022,
    courses: [
      { name: "물리화학 1", credits: 3, grade: "A0", categoryCode: "05" },
      { name: "재료과학", credits: 3, grade: "A0", categoryCode: "06" },
      { name: "일반수학 1", credits: 3, grade: "A0", categoryCode: "10" },
    ],
  });
  assert(
    report.major.required.items.find((i) => i.name === "물리화학1")?.status === "이수",
    "전공필수 이름 매칭 (물리화학 1 -> 물리화학1)"
  );
  assert(report.major.elective.creditsEarned === 3, "전공선택 학점 합산 (재료과학)");
  assert(report.generalCore.missingCount === 9, "계열교양 매칭 (일반수학1 이수, 9개 남음)");
}

// 2. 핵심교양 영역별 학점 합산 (택1이라도 과목마다 학점이 다름 — 발명과 특허 2학점 버그)
{
  const onlyInvention = analyze({
    curriculum: curriculum2022,
    courses: [{ name: "발명과 특허", credits: 2, grade: "P", categoryCode: "02" }],
  });
  assert(
    onlyInvention.creativeElective.satisfied === false && onlyInvention.creativeElective.missingCredits === 1,
    "창의영역 2학점짜리 과목 단독으로는 3학점 기준 미충족"
  );

  const inventionPlusOther = analyze({
    curriculum: curriculum2022,
    courses: [
      { name: "발명과 특허", credits: 2, grade: "P", categoryCode: "02" },
      { name: "캠퍼스 CEO", credits: 2, grade: "P", categoryCode: "02" },
    ],
  });
  assert(inventionPlusOther.creativeElective.creditsEarned === 4 && inventionPlusOther.creativeElective.satisfied, "창의영역 학점 합산 후 충족");
}

// 3. NFC/NFD 유니코드 정규화 (일부 PDF/OCR이 한글을 자모분해형으로 내보내는 문제)
{
  const report = analyze({
    curriculum: curriculum2022,
    courses: [{ name: "물리화학 1".normalize("NFD"), credits: 3, grade: "A0", categoryCode: "05" }],
  });
  assert(report.generalElective.length === 0, "NFD로 분해된 한글 과목명도 매칭됨");
}

// 4. 성적표 접두 표기(외/교 등) 제거
{
  const report = analyze({
    curriculum: curriculum2022,
    courses: [{ name: "외 국제관계학개론", credits: 3, grade: "B+", categoryCode: "02" }],
  });
  assert(
    report.coreElective.areas.find((a) => a.area === "4")?.takenCourses.some((t) => t.name === "국제관계학개론"),
    "성적표 접두 표기(외) 제거 후 매칭 및 표시"
  );
}

// 5. 융합전공: 필수/직무훈련/전공선택 매칭, 주전공과 이중 매칭 시 자동 중복 방지
{
  const report = analyze({
    curriculum: curriculum2022,
    courses: [
      { name: "재료과학", credits: 3, grade: "A0", categoryCode: "06" }, // 주전공과 융합전공 양쪽에 다 있는 과목
      { name: "반도체산업전문가세미나", credits: 2, grade: "P", categoryCode: "09" },
      { name: "반도체콜로키움", credits: 2, grade: "P", categoryCode: "09" },
      { name: "반도체소자", credits: 3, grade: "A+", categoryCode: "09" }, // MSE3025 코드쉐어 표기 (번호 없음)
    ],
    convergenceMajor: { major: semiconductor, membership: "double" },
  });
  assert(report.major.elective.creditsEarned === 3, "재료과학은 주전공 전공선택으로만 카운트");
  assert(
    !report.convergence.elective.takenCourses.some((t) => t.name === "재료과학"),
    "재료과학이 융합전공 쪽에는 중복 카운트되지 않음"
  );
  assert(report.convergence.requiredFixed.missingCount === 0, "융합전공 필수과목 2개 모두 매칭");
  assert(
    report.convergence.elective.takenCourses.some((t) => t.name === "반도체소자"),
    "반도체소자(MSE3025, 번호 없는 이름) 매칭"
  );
}

// 6. 융합전공 재배정(dualEligible override): 주전공 <-> 융합전공 학점 이동
{
  const courses = [{ name: "재료과학", credits: 3, grade: "A0", categoryCode: "06" }];
  const withoutOverride = analyze({
    curriculum: curriculum2022,
    courses,
    convergenceMajor: { major: semiconductor, membership: "double" },
  });
  const withOverride = analyze({
    curriculum: curriculum2022,
    courses,
    convergenceMajor: { major: semiconductor, membership: "double" },
    convergenceOverrides: ["재료과학"],
  });
  assert(withoutOverride.major.elective.creditsEarned === 3 && withoutOverride.convergence.elective.creditsEarned === 0, "재배정 전: 주전공에 귀속");
  assert(withOverride.major.elective.creditsEarned === 0 && withOverride.convergence.elective.creditsEarned === 3, "재배정 후: 융합전공으로 이동");
}

// 7. 복수전공/부전공에 따른 주전공 최소학점 전환 (39 / 44 / 65)
{
  const noConv = analyze({ curriculum: curriculum2022, courses: [] });
  const double = analyze({ curriculum: curriculum2022, courses: [], convergenceMajor: { major: semiconductor, membership: "double" } });
  const minor = analyze({ curriculum: curriculum2022, courses: [], convergenceMajor: { major: semiconductor, membership: "minor" } });
  assert(noConv.major.totalMajorCredits.required === 65, "단일전공 65학점");
  assert(double.major.totalMajorCredits.required === 39, "복수전공 39학점");
  assert(minor.major.totalMajorCredits.required === 44, "부전공 44학점(65-21)");
}

// 8. 전공선택에서 "추가로" 필요한 학점 (전공필수 잔여분은 이미 카운트되므로 중복으로 요구하면 안 됨)
{
  const requiredCourses = curriculum2022.categories["전공필수"].courses;
  let earned = 0;
  const courses = [];
  for (const c of requiredCourses) {
    if (earned + c.credits > 18) continue;
    courses.push({ name: c.name, credits: c.credits, grade: "A0", categoryCode: "05" });
    earned += c.credits;
  }
  courses.push({ name: "재료과학", credits: 3, grade: "A0", categoryCode: "06" });
  courses.push({ name: "생명과 고분자", credits: 3, grade: "A0", categoryCode: "06" });
  courses.push({ name: "생활속의 고분자", credits: 3, grade: "A0", categoryCode: "06" });

  const report = analyze({ curriculum: curriculum2022, courses, convergenceMajor: { major: semiconductor, membership: "double" } });
  assert(report.major.totalMajorCredits.remaining === 12, "총 잔여학점 12 (39 - 27)");
  assert(report.major.required.missingCredits === 9, "전공필수 잔여 9학점");
  assert(report.major.elective.stillNeededBeyondRequired === 3, "전공선택에서 추가로 필요한 학점은 3 (12 - 9)");
}

// 9. 재수강 판정: F=필수, 임계값 이하=권장
{
  const report = analyze({
    curriculum: curriculum2022,
    courses: [
      { name: "물리화학 1", credits: 3, grade: "F", categoryCode: "05" },
      { name: "물리화학 2", credits: 3, grade: "C0", categoryCode: "05" },
    ],
    retakeThreshold: "C+",
  });
  assert(report.retake.mandatory.length === 1 && report.retake.mandatory[0].name === "물리화학 1", "F 학점 -> 재수강 필수");
  assert(report.retake.recommended.length === 1 && report.retake.recommended[0].name === "물리화학 2", "임계값 이하 -> 재수강 권장");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
