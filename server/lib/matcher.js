// 과목명 정규화: 괄호 표기((융)/(외)/(복) 등)와 공백/구두점 차이를 흡수해서
// 성적증명서 표기와 교과과정표 표기가 최대한 매칭되도록 한다.
// NFC 정규화가 중요한 이유: PDF/OCR에 따라 한글이 자모 분해형(NFD)으로 나올 때가 있는데,
// 화면에는 똑같아 보여도 문자열은 완전히 달라서 이 처리가 없으면 그 과목증명서에서 온
// 과목명이 전부 매칭에 실패해 "일반교양"으로 몰리는 문제가 생긴다.
// 성적표에서 과목명 앞에 붙는 접두 표기(외:외국어강의, ENG:전공과정영어교과목, 재:재수강,
// 현:현장실습, 군:군이러닝, 교:국내외학점교류, 학:학습경험학점인정, 상:대학원상위과정,
// 연:학부연구생프로그램)는 과목명이 아니라 별도 flag라서 매칭 전에 떼어낸다.
// 공백이 뒤따를 때만 제거해서(예: "교 반도체개론" → "반도체개론") "교육심리학"처럼 실제로
// 해당 글자로 시작하는 과목명을 잘못 자르지 않도록 한다.
const TRANSCRIPT_PREFIX_RE = /^(외|ENG|재|현|군|교|학|상|연)\s+/;

// 매칭용 정규화와 별개로, 화면에 보여줄 과목명에서도 접두 표기만 떼어내고
// 나머지 표기(괄호 등)는 그대로 유지한다.
export function stripTranscriptPrefix(name) {
  return String(name || "").normalize("NFC").trim().replace(TRANSCRIPT_PREFIX_RE, "");
}

export function normalizeName(name) {
  return stripTranscriptPrefix(name)
    .replace(/\([^)]*\)/g, "")
    .replace(/[\s:\-·]/g, "")
    .trim();
}

// curriculum(연도별 JSON)에서 이름으로 빠르게 찾을 수 있는 색인을 만든다.
// 카테고리 코드(01/02/.../10)는 실제 성적증명서에서 학교 행정상 일관되지 않게
// 붙는 경우가 있어(같은 과목이 학기에 따라 다른 코드로 찍히는 사례 확인됨)
// 매칭은 항상 과목명 우선으로 하고, 카테고리 코드는 보조 힌트로만 쓴다.
export function buildCatalog(curriculum) {
  const fixed = new Map(); // normName -> { bucket, course }
  const elective = new Map(); // normName -> { bucket, course }
  const english = new Map(); // normName -> { bucket, course }

  const cats = curriculum.categories;

  for (const course of cats["기초교양"]?.courses ?? []) {
    fixed.set(normalizeName(course.name), { bucket: "기초교양", course });
  }
  for (const course of cats["계열교양"]?.courses ?? []) {
    fixed.set(normalizeName(course.name), { bucket: "계열교양", course });
  }
  for (const course of cats["전공필수"]?.courses ?? []) {
    fixed.set(normalizeName(course.name), { bucket: "전공필수", course });
  }
  for (const course of cats["전공선택"]?.courses ?? []) {
    elective.set(normalizeName(course.name), { bucket: "전공선택", course });
  }
  for (const opt of cats["의사소통영어"]?.options ?? []) {
    english.set(normalizeName(opt.name), { bucket: "의사소통영어", course: opt });
  }

  return { fixed, elective, english };
}

// 성적증명서에서 추출한 과목 1건을 커리큘럼 카탈로그와 대조.
// 반환: { bucket, course } | null
export function matchCourse(name, catalog) {
  const key = normalizeName(name);
  if (!key) return null;
  return catalog.english.get(key) || catalog.fixed.get(key) || catalog.elective.get(key) || null;
}

// 핵심교양(GED) 과목 목록은 학과 교과과정표가 아니라 학교 전체 공통 데이터(coreElectiveAreas.json)에서 온다.
// 학번과 무관하게 동일하고, 같은 과목이 학기마다 학수번호가 바뀌기도 해서 이름으로만 매칭한다.
export function buildCoreElectiveIndex(coreElectiveAreas) {
  const byName = new Map(); // normName -> area ('1'|'2'|'4'|'6')
  for (const [area, def] of Object.entries(coreElectiveAreas.areas)) {
    for (const course of def.courses) {
      byName.set(normalizeName(course.name), area);
    }
  }
  return byName;
}

export function matchCoreElective(name, coreElectiveIndex) {
  const key = normalizeName(name);
  if (!key) return null;
  return coreElectiveIndex.get(key) ?? null;
}

// 융합전공 데이터(data/convergenceMajors/*.json)를 과목명 기준 색인으로 변환.
// 주전공에서 이미 매칭된 과목은 analyze.js에서 애초에 이 색인까지 오지 않으므로
// (남은 과목만 대조) 중복 학점 인정 문제가 자연스럽게 방지된다.
export function buildConvergenceCatalog(convergenceMajor) {
  const fixed = new Map(); // normName -> course (requiredFixed)
  const jobTraining = new Map(); // normName -> course
  const elective = new Map(); // normName -> course

  for (const course of convergenceMajor.requiredFixed ?? []) {
    fixed.set(normalizeName(course.name), course);
  }
  for (const course of convergenceMajor.jobTrainingPool?.courses ?? []) {
    jobTraining.set(normalizeName(course.name), course);
  }
  for (const course of convergenceMajor.elective?.courses ?? []) {
    elective.set(normalizeName(course.name), course);
  }

  return { fixed, jobTraining, elective };
}

// 반환: { bucket: 'fixed'|'jobTraining'|'elective', course } | null
export function matchConvergenceCourse(name, catalog) {
  const key = normalizeName(name);
  if (!key) return null;
  if (catalog.fixed.has(key)) return { bucket: "fixed", course: catalog.fixed.get(key) };
  if (catalog.jobTraining.has(key)) return { bucket: "jobTraining", course: catalog.jobTraining.get(key) };
  if (catalog.elective.has(key)) return { bucket: "elective", course: catalog.elective.get(key) };
  return null;
}
