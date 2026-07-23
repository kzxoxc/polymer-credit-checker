import { useState } from "react";

const CATEGORY_LEGEND = {
  "01": "교양필수",
  "02": "교양선택",
  "03": "계열필수",
  "05": "전공필수",
  "06": "전공선택",
  "07": "부전공",
  "08": "교직과정",
  "09": "일반선택",
  "10": "전공기초",
};

let rowId = 0;
function newRow(overrides = {}) {
  rowId += 1;
  return {
    id: rowId,
    year: "",
    semester: 1,
    categoryCode: "02",
    name: "",
    credits: 3,
    grade: "A0",
    ...overrides,
  };
}

export default function ReviewStep({ cohortYear, initialCourses, grades, onConfirm, onBack, onViewResult }) {
  const [rows, setRows] = useState(() =>
    initialCourses.length ? initialCourses.map((c) => newRow(c)) : [newRow()]
  );

  function updateRow(id, field, value) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function removeRow(id) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function addRow() {
    setRows((rs) => [...rs, newRow()]);
  }

  function handleConfirm() {
    const courses = rows
      .filter((r) => r.name.trim())
      .map(({ year, semester, categoryCode, name, credits, grade }) => ({
        year: Number(year) || null,
        semester: Number(semester) || null,
        categoryCode,
        name: name.trim(),
        credits: Number(credits) || 0,
        grade,
      }));
    onConfirm(courses);
  }

  return (
    <section className="step">
      <h2>2. 인식 결과 확인 및 수정</h2>
      <p className="hint">
        OCR이 잘못 읽었을 수 있는 부분을 직접 고쳐주세요. 구분 코드는 성적증명서 하단 범례를 참고합니다
        (01교양필수 02교양선택 03계열필수 05전공필수 06전공선택 07부전공 08교직과정 09일반선택 10전공기초).
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>연도</th>
              <th>학기</th>
              <th>구분</th>
              <th>과목명</th>
              <th>학점</th>
              <th>성적</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="number"
                    value={r.year ?? ""}
                    onChange={(e) => updateRow(r.id, "year", e.target.value)}
                    style={{ width: "5.5em" }}
                  />
                </td>
                <td>
                  <select value={r.semester} onChange={(e) => updateRow(r.id, "semester", e.target.value)}>
                    <option value={1}>1학기</option>
                    <option value={2}>2학기</option>
                  </select>
                </td>
                <td>
                  <select value={r.categoryCode} onChange={(e) => updateRow(r.id, "categoryCode", e.target.value)}>
                    {Object.entries(CATEGORY_LEGEND).map(([code, label]) => (
                      <option key={code} value={code}>
                        {code} {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => updateRow(r.id, "name", e.target.value)}
                    style={{ width: "16em" }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.5"
                    value={r.credits}
                    onChange={(e) => updateRow(r.id, "credits", e.target.value)}
                    style={{ width: "4.5em" }}
                  />
                </td>
                <td>
                  <select value={r.grade} onChange={(e) => updateRow(r.id, "grade", e.target.value)}>
                    {grades.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="icon" onClick={() => removeRow(r.id)} title="삭제">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="secondary" onClick={addRow}>
        + 과목 추가
      </button>

      <div className="actions">
        <button className="secondary" onClick={onBack}>
          이전으로
        </button>
        {onViewResult && (
          <button className="secondary" onClick={onViewResult}>
            수정 취소하고 결과로 돌아가기
          </button>
        )}
        <button onClick={handleConfirm}>{cohortYear}학번 기준으로 분석하기</button>
      </div>
    </section>
  );
}
