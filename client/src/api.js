export async function getCohorts() {
  const res = await fetch("/api/analyze/cohorts");
  if (!res.ok) throw new Error("학번 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function ocrTranscript(file) {
  const formData = new FormData();
  formData.append("image", file);

  let res;
  try {
    res = await fetch("/api/ocr", { method: "POST", body: formData });
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    // 서버가 잠들어 있다 깨어나는 중이거나(Render 무료 플랜) 사용자가 몰려서 응답이 정상 JSON이 아닐 때
    throw new Error("서버가 응답하지 않습니다. 사용자가 몰렸거나 서버가 막 깨어나는 중일 수 있으니 잠시 후 다시 시도해주세요.");
  }

  if (!res.ok) throw new Error(data.error || "OCR 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
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
