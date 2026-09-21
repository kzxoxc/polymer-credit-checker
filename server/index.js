import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ocrRoute from "./routes/ocr.js";
import analyzeRoute from "./routes/analyze.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api/ocr", ocrRoute);
app.use("/api/analyze", analyzeRoute);

// multer fileFilter 등에서 던진 에러도 JSON으로 응답
app.use("/api", (err, req, res, next) => {
  res.status(400).json({ error: err.message || "요청 처리 중 오류가 발생했습니다." });
});

// 기존 프론트엔드 -> 새 프론트엔드(Lovable)로 이동. /api 경로는 그대로 유지
const NEW_FRONTEND_URL = "https://polymer-credit-checker.lovable.app/";
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.redirect(302, NEW_FRONTEND_URL);
  }
  next();
});

// 프로덕션 빌드(client/dist)가 있으면 정적으로 서빙
const clientDist = path.resolve(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
