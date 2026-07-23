import { GoogleGenAI } from "@google/genai";

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. server/.env 파일을 확인하세요.");
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const EXTRACTION_PROMPT = `다음은 한국 대학교(인하대학교) 성적증명서 PDF 문서입니다. 표에 있는 모든 과목을 빠짐없이 추출해서 아래 JSON 스키마로만 응답하세요. 설명 문장 없이 JSON만 출력합니다.

각 과목 행 맨 앞의 두 자리 숫자가 구분 코드입니다. 범례: 01=교양필수, 02=교양선택, 03=계열필수, 05=전공필수, 06=전공선택, 07=부전공, 08=교직과정, 09=일반선택, 10=전공기초.

과목명 앞에 (복)(연)(국)(기)(외)(ENG)(융) 같은 괄호 표기가 있으면 그대로 포함해서 적으세요.

과목 코드 앞에 별도로 붙는 한 글자 표기(외, ENG, 재, 현, 군, 교, 학, 상, 연 — 외국어강의/재수강/현장실습/
국내외학점교류 등을 뜻함)는 과목명이 아니므로 "name" 필드에 포함하지 마세요.

스키마:
{
  "studentId": "학번 문자열",
  "studentName": "이름",
  "admissionDate": "입학연월일 (YYYY-MM-DD, 모르면 null)",
  "courses": [
    {
      "year": 2022,
      "semester": 1,
      "categoryCode": "01",
      "name": "과목명",
      "credits": 3,
      "grade": "B0"
    }
  ]
}

성적(grade)은 A+, A0, B+, B0, C+, C0, D+, D0, F, P 중 하나로 표준화하세요. credits는 숫자(소수 가능)로 적으세요.`;

// Gemini가 일시적으로 과부하 상태일 때(503/UNAVAILABLE, 429/RESOURCE_EXHAUSTED)만 재시도한다.
// 그 외 오류(잘못된 키, 응답 파싱 실패 등)는 재시도해도 의미가 없으므로 바로 던진다.
function isTransientError(err) {
  const text = `${err?.status ?? ""} ${err?.code ?? ""} ${err?.message ?? ""}`;
  return /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(text);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 사용자(비개발자)가 봐도 뭘 해야 할지 알 수 있도록, 내부 오류를 알려진 몇 가지 한국어
// 안내문으로 매핑한다. 알 수 없는 오류는 원문을 서버 로그에만 남기고 화면엔 일반 안내만 보여준다.
const KNOWN_MESSAGES = new Set(["Gemini 응답이 비어 있습니다.", "Gemini 응답을 JSON으로 해석하지 못했습니다."]);

function friendlyMessage(err) {
  if (isTransientError(err)) {
    return "지금 사용하는 사람이 몰려서 서버가 혼잡합니다. 잠시 기다렸다가 다시 시도해주세요.";
  }
  if (err?.message && KNOWN_MESSAGES.has(err.message)) {
    return "성적표를 인식하지 못했습니다. PDF 화질 문제일 수 있으니 다시 시도하거나, 'OCR 없이 직접 입력하기'를 이용해주세요.";
  }
  console.error("[gemini] 처리되지 않은 오류:", err);
  return "성적표 인식 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

export async function extractTranscript(imageBuffer, mimeType) {
  const ai = getClient();
  const maxAttempts = 3;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACTION_PROMPT },
              { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
            ],
          },
        ],
        config: { responseMimeType: "application/json" },
      });

      const text = response.text;
      if (!text) throw new Error("Gemini 응답이 비어 있습니다.");

      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Gemini 응답을 JSON으로 해석하지 못했습니다.");
      }
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isTransientError(err)) {
        await sleep(1000 * attempt);
        continue;
      }
      break;
    }
  }

  if (lastErr?.message?.includes("GEMINI_API_KEY")) throw lastErr; // 관리자용 설정 오류, 그대로 노출
  throw new Error(friendlyMessage(lastErr));
}
