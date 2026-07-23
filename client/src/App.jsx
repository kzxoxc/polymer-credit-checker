import { useEffect, useState } from "react";
import { getCohorts, getConvergenceMajors, analyze } from "./api.js";
import UploadStep from "./components/UploadStep.jsx";
import ReviewStep from "./components/ReviewStep.jsx";
import ResultDashboard from "./components/ResultDashboard.jsx";

export default function App() {
  const [meta, setMeta] = useState(null); // { years, grades, defaultRetakeThreshold }
  const [convergenceMajors, setConvergenceMajors] = useState([]); // [{id, name, type}]
  const [step, setStep] = useState("upload"); // upload -> review -> result
  const [cohortYear, setCohortYear] = useState(null);
  const [convergenceMajorId, setConvergenceMajorId] = useState("");
  const [convergenceMembership, setConvergenceMembership] = useState("double"); // 'double' | 'minor'
  const [reviewCourses, setReviewCourses] = useState([]);
  const [confirmedCourses, setConfirmedCourses] = useState([]);
  const [convergenceOverrides, setConvergenceOverrides] = useState([]); // 융합전공으로 옮기기로 한 과목명 목록
  const [retakeThreshold, setRetakeThreshold] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    getCohorts()
      .then((m) => {
        setMeta(m);
        setRetakeThreshold(m.defaultRetakeThreshold);
      })
      .catch((err) => setError(err.message));
    getConvergenceMajors()
      .then((m) => setConvergenceMajors(m.majors || []))
      .catch(() => {}); // 융합전공 목록 로드 실패해도 기본 기능은 사용 가능해야 함
  }, []);

  function handleOcrDone({ cohortYear, ocrResult }) {
    setCohortYear(cohortYear);
    setReviewCourses(ocrResult.courses || []);
    setStep("review");
  }

  function handleManualEntry({ cohortYear }) {
    setCohortYear(cohortYear);
    setReviewCourses([]);
    setStep("review");
  }

  async function handleReviewConfirm(courses) {
    setConfirmedCourses(courses);
    setConvergenceOverrides([]);
    setAnalyzing(true);
    setError(null);
    try {
      const r = await analyze({
        cohortYear,
        courses,
        retakeThreshold,
        convergenceMajorId: convergenceMajorId || undefined,
        convergenceMembership,
        convergenceOverrides: [],
      });
      setReport(r);
      setStep("result");
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleThresholdChange(newThreshold) {
    setRetakeThreshold(newThreshold);
    try {
      const r = await analyze({
        cohortYear,
        courses: confirmedCourses,
        retakeThreshold: newThreshold,
        convergenceMajorId: convergenceMajorId || undefined,
        convergenceMembership,
        convergenceOverrides,
      });
      setReport(r);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleConvergenceOverride(name) {
    const next = convergenceOverrides.includes(name)
      ? convergenceOverrides.filter((n) => n !== name)
      : [...convergenceOverrides, name];
    setConvergenceOverrides(next);
    try {
      const r = await analyze({
        cohortYear,
        courses: confirmedCourses,
        retakeThreshold,
        convergenceMajorId: convergenceMajorId || undefined,
        convergenceMembership,
        convergenceOverrides: next,
      });
      setReport(r);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleRestart() {
    setStep("upload");
    setReviewCourses([]);
    setConfirmedCourses([]);
    setConvergenceOverrides([]);
    setReport(null);
    setError(null);
  }

  if (!meta) {
    return (
      <div className="app">
        <header>
          <h1>고분자공학과 학점 계산기</h1>
        </header>
        {error ? <p className="error">{error}</p> : <p>불러오는 중...</p>}
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>고분자공학과 학점 계산기</h1>
        <p className="hint">
          인하대학교 고분자공학과 학번별 교과과정표를 기준으로 전공필수/전공선택/재수강/교양 요건을 확인합니다.
          업로드된 이미지와 성적 데이터는 서버에 저장되지 않습니다.
        </p>
      </header>

      {error && <p className="error">{error}</p>}

      {step === "upload" && (
        <UploadStep
          years={meta.years}
          convergenceMajors={convergenceMajors}
          convergenceMajorId={convergenceMajorId}
          onConvergenceMajorIdChange={setConvergenceMajorId}
          convergenceMembership={convergenceMembership}
          onConvergenceMembershipChange={setConvergenceMembership}
          onOcrDone={handleOcrDone}
          onManualEntry={handleManualEntry}
        />
      )}

      {step === "review" && (
        <ReviewStep
          cohortYear={cohortYear}
          initialCourses={confirmedCourses.length ? confirmedCourses : reviewCourses}
          grades={meta.grades}
          onConfirm={handleReviewConfirm}
          onBack={() => setStep("upload")}
          onViewResult={report ? () => setStep("result") : null}
        />
      )}

      {analyzing && <p>분석 중...</p>}

      {step === "result" && report && (
        <ResultDashboard
          report={report}
          grades={meta.grades}
          retakeThreshold={retakeThreshold}
          onThresholdChange={handleThresholdChange}
          onRestart={handleRestart}
          onBackToReview={() => setStep("review")}
          onToggleConvergenceOverride={handleToggleConvergenceOverride}
        />
      )}
    </div>
  );
}
