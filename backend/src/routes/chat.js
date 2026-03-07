const express = require("express");
const { chatMessage } = require("../services/gemini");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { report, history, message } = req.body;

    if (!message?.trim()) return res.status(400).json({ error: "Empty message." });
    if (!report)          return res.status(400).json({ error: "No report provided." });

    const userCount = (history || []).filter(m => m.role === "user").length;
    if (userCount >= 10) {
      return res.status(400).json({ error: "Chat limit reached (10 questions)." });
    }

    const reply = await chatMessage(report, history || [], message);
    res.json({ success: true, reply });
  } catch (e) {
    console.error("[CHAT ERROR]", e.message);
    next(e);
  }
});

module.exports = router;
