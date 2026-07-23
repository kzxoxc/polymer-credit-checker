import { useState } from "react";
import { ocrTranscript } from "../api.js";

export default function UploadStep({
  years,
  convergenceMajors,
  convergenceMajorId,
  onConvergenceMajorIdChange,
  convergenceMembership,
  onConvergenceMembershipChange,
  onOcrDone,
  onManualEntry,
}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cohortYear, setCohortYear] = useState(years[years.length - 1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("PDF 파일만 업로드할 수 있습니다. 사진 인식은 정확도가 낮아 지원하지 않습니다.");
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
  }

  async function handleOcr() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ocrTranscript(file);
      onOcrDone({ cohortYear, ocrResult: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="step">
      <h2>1. 참고용 성적표 업로드</h2>
      <p className="hint">
        참고용 성적표 PDF 파일을 올리면 표 내용을 자동으로 읽어 다음 단계에서 검수할 수 있게 해줍니다. (사진 업로드는
        인식 정확도가 낮아 지원하지 않습니다.) 인식이 완벽하지 않을 수 있으니 다음 단계에서 꼭 확인/수정하세요.
      </p>
      <p className="hint">
        PDF 발급 경로: 인하포털 학사행정시스템 → <b>학사행정 → 성적 → 성적 및 석차확인</b> → 조회 후 PDF로 저장
      </p>

      <label className="field">
        <span>본인 학번(입학년도)</span>
        <select value={cohortYear} onChange={(e) => setCohortYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}학번
            </option>
          ))}
        </select>
      </label>

      {convergenceMajors?.length > 0 && (
        <>
          <label className="field">
            <span>융합전공(복수전공/부전공) — 없으면 선택 안 함</span>
            <select value={convergenceMajorId} onChange={(e) => onConvergenceMajorIdChange(e.target.value)}>
              <option value="">선택 안 함</option>
              {convergenceMajors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          {convergenceMajorId && (
            <label className="field">
              <span>이수 형태</span>
              <select value={convergenceMembership} onChange={(e) => onConvergenceMembershipChange(e.target.value)}>
                <option value="double">복수전공 (39학점)</option>
                <option value="minor">부전공 (21학점)</option>
              </select>
            </label>
          )}
        </>
      )}

      <label className="field">
        <span>참고용 성적표 PDF</span>
        <input type="file" accept="application/pdf" onChange={handleFile} />
      </label>

      {previewUrl && <embed src={previewUrl} type="application/pdf" className="preview" />}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button disabled={!file || loading} onClick={handleOcr}>
          {loading ? "인식 중... (수십 초 걸릴 수 있어요)" : "PDF에서 과목 자동 추출"}
        </button>
        <button className="secondary" onClick={() => onManualEntry({ cohortYear })}>
          OCR 없이 직접 입력하기
        </button>
      </div>
    </section>
  );
}
