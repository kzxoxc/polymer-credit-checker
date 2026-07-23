import { Router } from "express";
import multer from "multer";
import { extractTranscript } from "../lib/gemini.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("PDF 파일만 업로드할 수 있습니다."));
    }
    cb(null, true);
  },
});
const router = Router();

// 업로드된 PDF는 메모리에서만 처리하고 어디에도 저장하지 않는다 (개인정보 보호).
router.post("/", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "PDF 파일이 필요합니다." });
  }
  try {
    const result = await extractTranscript(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message || "OCR 처리 중 오류가 발생했습니다." });
  }
});

export default router;
