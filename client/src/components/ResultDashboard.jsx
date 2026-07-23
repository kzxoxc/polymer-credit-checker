function ProgressBar({ earned, required }) {
  const pct = required > 0 ? Math.min(100, Math.round((earned / required) * 100)) : 0;
  return (
    <div className="progress">
      <div className="progress-bar" style={{ width: `${pct}%` }} />
      <span className="progress-label">
        {earned} / {required}학점 ({pct}%)
      </span>
    </div>
  );
}

function ElectiveAreaLine({ report }) {
  return (
    <li>
      {report.label}: {report.satisfied ? "이수" : "미이수"} ({report.creditsEarned}/{report.requiredCredits}학점)
      {report.takenCourses.length > 0 && (
        <> — {report.takenCourses.map((t) => `${t.name}(${t.credits}, ${t.grade})`).join(", ")}</>
      )}
    </li>
  );
}

function StatusChecklist({ items }) {
  return (
    <ul className="course-list">
      {items.map((c) => (
        <li key={c.code || c.name}>
          {c.status === "이수" ? "✅" : "❌"} {c.name} ({c.credits}학점){c.grade ? ` — ${c.grade}` : ""}
        </li>
      ))}
    </ul>
  );
}

function CourseList({ items, emptyText }) {
  if (!items.length) return <p className="ok">{emptyText}</p>;
  return (
    <ul className="course-list">
      {items.map((c) => (
        <li key={c.code || c.name}>
          {c.name}
          {c.credits ? ` (${c.credits}학점)` : ""}
        </li>
      ))}
    </ul>
  );
}

export default function ResultDashboard({
  report,
  grades,
  retakeThreshold,
  onThresholdChange,
  onRestart,
  onBackToReview,
  onToggleConvergenceOverride,
}) {
  const missingRequired = report.major.required.items.filter((i) => i.status === "미이수");
  const missingCore = report.generalCore.items.filter((i) => i.status === "미이수");
  const missingFixedGeneral = report.fixedGeneral.items.filter((i) => i.status === "미이수");

  return (
    <section className="step">
      <h2>{report.cohortYear}학번 졸업요건 분석 결과</h2>

      <div className="card">
        <h3>총 취득학점</h3>
        <ProgressBar earned={report.totals.totalCreditsEarned} required={report.totals.graduationCredits} />
        <p className="hint">졸업 필요학점 {report.totals.graduationCredits}학점 이상 (일반+교양+전공 합산, 20~26학번 동일)</p>
      </div>

      {report.englishCertification && (
        <div className="card">
          <h3>영어졸업인증</h3>
          <p>{report.englishCertification.description}</p>
          <p className="hint">
            성적표만으로는 제출 여부를 알 수 없어 자동 판정하지 않습니다. 안내:{" "}
            <a href={report.englishCertification.reference} target="_blank" rel="noreferrer">
              인하대 영어졸업인증 안내 페이지
            </a>
          </p>
        </div>
      )}

      <div className="card">
        <h3>전공필수 (총 {report.major.required.items.length}과목)</h3>
        {missingRequired.length === 0 ? (
          <p className="ok">전공필수 과목을 모두 이수했습니다.</p>
        ) : (
          <>
            <p>
              남은 과목 {missingRequired.length}개 ({missingRequired.reduce((s, i) => s + i.credits, 0)}학점)
            </p>
            <CourseList items={missingRequired} />
          </>
        )}
      </div>

      <div className="card">
        <h3>전공선택 / 전공 총 이수학점</h3>
        <p>전공선택 이수학점: {report.major.elective.creditsEarned}학점</p>
        <p>전공 총 이수학점(필수+선택) 기준 {report.major.totalMajorCredits.required}학점</p>
        <ProgressBar earned={report.major.totalMajorCredits.earned} required={report.major.totalMajorCredits.required} />
        {report.major.totalMajorCredits.remaining > 0 && (
          <p>
            전공 총 이수학점까지 {report.major.totalMajorCredits.remaining}학점 남았습니다. 이 중 전공필수 잔여{" "}
            {report.major.required.missingCredits}학점은 어차피 이수해야 하므로, 전공선택에서 추가로 더 필요한
            학점은 최소 {report.major.elective.stillNeededBeyondRequired}학점입니다.
          </p>
        )}
        <details>
          <summary>아직 안 들은 전공선택 과목 보기 ({report.major.elective.suggestedRemaining.length}개)</summary>
          <CourseList items={report.major.elective.suggestedRemaining} emptyText="모든 전공선택 과목을 이수했습니다." />
        </details>
      </div>

      <div className="card">
        <h3>계열교양</h3>
        <CourseList items={missingCore} emptyText="계열교양 과목을 모두 이수했습니다." />
      </div>

      <div className="card">
        <h3>기초교양</h3>
        <CourseList items={missingFixedGeneral} emptyText="기초교양 과목을 모두 이수했습니다." />
        <p>
          의사소통영어(택1):{" "}
          {report.english.satisfied ? `이수함 (${report.english.taken.name}, ${report.english.taken.grade})` : "미이수"}
        </p>
      </div>

      <div className="card">
        <h3>핵심교양 (1/2/4/6영역 각 3학점)</h3>
        <p className="hint">과목마다 학점이 달라서(예: 2학점짜리 과목) 영역당 학점 합계가 3학점 이상이어야 충족됩니다.</p>
        <ul className="course-list">
          {report.coreElective.areas.map((a) => (
            <ElectiveAreaLine key={a.area} report={a} />
          ))}
        </ul>
        {report.coreElective.missingCredits > 0 && (
          <p>남은 핵심교양 학점: {report.coreElective.missingCredits}학점</p>
        )}
      </div>

      {(report.swaiElective || report.creativeElective) && (
        <div className="card">
          <h3>창의영역 / SW·AI</h3>
          <ul className="course-list">
            {report.creativeElective && <ElectiveAreaLine report={report.creativeElective} />}
            {report.swaiElective && <ElectiveAreaLine report={report.swaiElective} />}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>재수강</h3>
        <label className="field inline">
          <span>재수강 권장 기준</span>
          <select value={retakeThreshold} onChange={(e) => onThresholdChange(e.target.value)}>
            {grades
              .filter((g) => g !== "P")
              .map((g) => (
                <option key={g} value={g}>
                  {g} 이하
                </option>
              ))}
          </select>
        </label>

        <h4>재수강 필수 (F)</h4>
        {report.retake.mandatory.length === 0 ? (
          <p className="ok">F 학점 과목이 없습니다.</p>
        ) : (
          <ul className="course-list">
            {report.retake.mandatory.map((r, i) => (
              <li key={i}>
                {r.name} ({r.year}-{r.semester}, {r.grade})
              </li>
            ))}
          </ul>
        )}

        <h4>재수강 권장 ({retakeThreshold} 이하)</h4>
        {report.retake.recommended.length === 0 ? (
          <p className="ok">해당 없음.</p>
        ) : (
          <ul className="course-list">
            {report.retake.recommended.map((r, i) => (
              <li key={i}>
                {r.name} ({r.year}-{r.semester}, {r.grade})
              </li>
            ))}
          </ul>
        )}
      </div>

      {report.convergence && (
        <div className="card">
          <h3>
            {report.convergence.name} ({report.convergence.membership === "minor" ? "부전공" : "복수전공"})
          </h3>
          <ProgressBar earned={report.convergence.totalCredits.earned} required={report.convergence.totalCredits.required} />

          <h4>필수 과목</h4>
          <StatusChecklist items={report.convergence.requiredFixed.items} />

          <h4>직무훈련 (최소 {report.convergence.jobTraining.requiredCredits}학점)</h4>
          <p>
            {report.convergence.jobTraining.satisfied ? "이수" : "미이수"} ({report.convergence.jobTraining.creditsEarned}/
            {report.convergence.jobTraining.requiredCredits}학점)
            {report.convergence.jobTraining.takenCourses.length > 0 &&
              ` — ${report.convergence.jobTraining.takenCourses.map((t) => `${t.name}(${t.credits}, ${t.grade})`).join(", ")}`}
          </p>

          <h4>전공선택 이수학점</h4>
          <p>{report.convergence.elective.creditsEarned}학점</p>
          {report.convergence.elective.takenCourses.length > 0 && (
            <details>
              <summary>이수한 과목 보기 ({report.convergence.elective.takenCourses.length}개)</summary>
              <CourseList items={report.convergence.elective.takenCourses} />
            </details>
          )}

          <p className="hint">전공필수 학점 부족분은 학칙상 전공선택으로 대체 가능해 총 이수학점 기준으로만 판정합니다.</p>

          {report.convergence.dualEligible.length > 0 && (
            <>
              <h4>주전공/융합전공 양쪽에 해당하는 과목</h4>
              <p className="hint">
                같은 과목이 주전공 전공선택과 융합전공 양쪽 목록에 다 있어도 학점은 한쪽에서만 인정됩니다. 기본값은
                주전공 쪽이며, 필요하면 융합전공 쪽으로 옮길 수 있습니다.
              </p>
              <ul className="course-list">
                {report.convergence.dualEligible.map((d) => (
                  <li key={d.name}>
                    {d.name} ({d.credits}학점, {d.grade}) — 현재{" "}
                    <b>{d.countedToward === "convergence" ? report.convergence.name : "주전공 전공선택"}</b>으로 계산됨{" "}
                    {d.movable ? (
                      <button className="secondary" onClick={() => onToggleConvergenceOverride(d.name)}>
                        {d.countedToward === "convergence" ? "주전공으로 옮기기" : "융합전공으로 옮기기"}
                      </button>
                    ) : (
                      <span className="hint">(주전공 필수/고정 과목이라 옮길 수 없음)</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {report.generalElective.length > 0 && (
        <div className="card">
          <h3>일반교양 ({report.generalElective.length}개)</h3>
          <p className="hint">
            전공필수/전공선택/계열교양/기초교양/핵심교양/창의/SW·AI/(선택한) 융합전공 어디에도 안 걸리는 과목입니다.
            다른 학과의 복수전공·부전공 과목이거나 순수 일반교양일 수 있습니다.
          </p>
          <ul className="course-list">
            {report.generalElective.map((u, i) => (
              <li key={i}>
                {u.name} ({u.credits}학점, {u.grade})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions">
        <button className="secondary" onClick={onBackToReview}>
          이전으로 (성적 수정하기)
        </button>
        <button className="secondary" onClick={onRestart}>
          처음부터 다시하기
        </button>
      </div>
    </section>
  );
}
