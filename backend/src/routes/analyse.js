const express = require("express");
const { analysePresentation } = require("../services/gemini");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const {
      presenterName, sessionDurationSec, totalElapsed, totalWords,
      fillerCounts, slides, slideDurations, suggestedPerSlide, finalTranscripts,
    } = req.body;

    if (!slides?.length)           return res.status(400).json({ error: "No slides provided." });
    if (!slideDurations?.length)   return res.status(400).json({ error: "No timing data." });
    if (!finalTranscripts?.length) return res.status(400).json({ error: "No transcript data." });

    console.log(`[ANALYSE] ${presenterName} | ${slides.length} slides | ${totalWords} words`);

    const report = await analysePresentation({
      presenterName:     presenterName || "Presenter",
      sessionDurationSec: sessionDurationSec || 600,
      totalElapsed:      totalElapsed || 0,
      totalWords:        totalWords || 0,
      fillerCounts:      fillerCounts || {},
      slides,
      slideDurations,
      suggestedPerSlide: suggestedPerSlide || 60,
      finalTranscripts,
    });

    console.log(`[ANALYSE] Done. Score: ${report.overallScore}`);
    res.json({ success: true, report });
  } catch (e) {
    console.error("[ANALYSE ERROR]", e.message);
    next(e);
  }
});

module.exports = router;
