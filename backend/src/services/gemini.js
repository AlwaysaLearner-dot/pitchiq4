const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// ── Core Gemini call ──────────────────────────────────────
// API key comes ONLY from process.env — never from the request
async function callGemini(prompt, maxTokens = 8192) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set on server.");

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini.");
  return text;
}

// ── Parse JSON response safely ────────────────────────────
function parseJSON(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Gemini returned invalid JSON. Raw: " + cleaned.slice(0, 200));
  }
}

// ── Format seconds as M:SS ────────────────────────────────
function fmt(sec) {
  const s = Math.abs(Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════
// ANALYSE FULL PRESENTATION
// ═══════════════════════════════════════════════════════════
async function analysePresentation(payload) {
  const {
    presenterName,
    sessionDurationSec,
    totalElapsed,
    totalWords,
    fillerCounts,
    slides,
    slideDurations,
    suggestedPerSlide,
    finalTranscripts,
  } = payload;

  const totalFillers = Object.values(fillerCounts).reduce((a, b) => a + b, 0);

  const fillerLines = Object.entries(fillerCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `  "${k}": ${v} times`)
    .join("\n") || "  None detected";

  const slideDetail = slides
    .map((s, i) => `
SLIDE ${s.index}: "${s.title}"
Content: ${s.raw || "(empty slide)"}
Time spent: ${fmt(slideDurations[i] || 0)} | Suggested: ${fmt(suggestedPerSlide)}
Transcript: ${finalTranscripts[i] || "(no speech recorded)"}`)
    .join("\n---\n");

  const prompt = `
You are an elite presentation coach. Give brutally honest, specific, actionable feedback.

SESSION
Presenter: ${presenterName}
Target time: ${fmt(sessionDurationSec)}
Actual time: ${fmt(totalElapsed)}
Words spoken: ${totalWords}
Total fillers: ${totalFillers}
Filler breakdown:
${fillerLines}
Suggested per slide: ${fmt(suggestedPerSlide)}

SLIDES
${slideDetail}

Respond ONLY as valid JSON — no markdown fences, no extra text:
{
  "overallScore": <0-100>,
  "overallFeedback": "<honest 3-4 sentence assessment>",
  "paceRating": "<Too Fast|Good|Too Slow>",
  "clarityRating": "<Poor|Average|Good|Excellent>",
  "engagementRating": "<Low|Medium|High>",
  "strengths": ["<s1>","<s2>","<s3>"],
  "improvements": ["<i1>","<i2>","<i3>"],
  "fillerWordAdvice": "<specific filler advice>",
  "topTip": "<single most impactful tip>",
  "slideAnalysis": [
    {
      "slideNum": <n>,
      "title": "<title>",
      "rating": "<Weak|Average|Good|Excellent>",
      "score": <0-100>,
      "timeSpentSec": <number>,
      "suggestedSec": <number>,
      "timeAssessment": "<specific time feedback>",
      "howTheyPresented": "<2-3 sentences on what they said and how>",
      "howItShouldBe": "<2-3 sentences on ideal delivery for this slide>",
      "fillerNote": "<filler patterns or 'Clean delivery'>",
      "improvement": "<specific, actionable improvement>"
    }
  ]
}`;

  const raw = await callGemini(prompt);
  return parseJSON(raw);
}

// ═══════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════
async function chatMessage(report, history, userMessage) {
  const reportStr  = JSON.stringify(report, null, 2).slice(0, 3500);
  const historyStr = history
    .map(m => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
    .join("\n");

  const prompt = `
You are a warm, expert presentation coach. The user just finished presenting and received this report:

REPORT:
${reportStr}

CONVERSATION:
${historyStr || "(first message)"}

USER: ${userMessage}

Answer as a coach — specific, honest, reference their actual data.
They may ask anything: how to improve a slide, how an interviewer would rate them,
technical questions about their topic, communication advice.
Keep response to 3-5 sentences unless they ask for more.`;

  return callGemini(prompt, 1024);
}

module.exports = { analysePresentation, chatMessage };
