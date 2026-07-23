export async function getCohorts() {
  const res = await fetch("/api/analyze/cohorts");
  if (!res.ok) throw new Error("학번 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function ocrTranscript(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/ocr", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "OCR 처리에 실패했습니다.");
  return data;
}

export async function getConvergenceMajors() {
  const res = await fetch("/api/analyze/convergence-majors");
  if (!res.ok) throw new Error("융합전공 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function analyze({
  cohortYear,
  courses,
  retakeThreshold,
  convergenceMajorId,
  convergenceMembership,
  convergenceOverrides,
}) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cohortYear,
      courses,
      retakeThreshold,
      convergenceMajorId,
      convergenceMembership,
      convergenceOverrides,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "분석에 실패했습니다.");
  return data;
}
