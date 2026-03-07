const express = require("express");
const multer  = require("multer");
const { parsePPTX } = require("../services/pptxParser");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(pptx|ppt)$/i)) return cb(null, true);
    cb(new Error("Only .pptx/.ppt files are accepted."));
  },
});

router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    console.log(`[UPLOAD] ${req.file.originalname} (${req.file.size} bytes)`);
    const slides = await parsePPTX(req.file.buffer);
    console.log(`[UPLOAD] Parsed ${slides.length} slides`);
    res.json({ success: true, filename: req.file.originalname, slideCount: slides.length, slides });
  } catch (e) {
    console.error("[UPLOAD ERROR]", e.message);
    next(e);
  }
});

module.exports = router;
