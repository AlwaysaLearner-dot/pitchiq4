require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");

const uploadRouter  = require("./routes/upload");
const analyseRouter = require("./routes/analyse");
const chatRouter    = require("./routes/chat");

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Validate required env vars on startup ─────────────────
if (!process.env.GEMINI_API_KEY) {
  console.error("❌  GEMINI_API_KEY env variable is missing! Set it in Railway.");
  process.exit(1);
}

// ── Security headers ──────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────
// Since Vercel proxies /api/* → Railway, requests arrive from
// Railway's own domain or localhost. We accept both.
// No browser ever hits Railway directly → no CORS issues.
app.use(cors({
  origin: true, // Railway only receives requests from Vercel proxy or localhost
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
}));

// ── Rate limits ───────────────────────────────────────────
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use("/api/analyse", rateLimit({
  windowMs: 60 * 60 * 1000, max: 30,
  message: { error: "Analysis limit reached (30/hr). Try again later." },
}));
app.use("/api/chat", rateLimit({
  windowMs: 60 * 60 * 1000, max: 200,
  message: { error: "Chat limit reached. Try again later." },
}));

// ── Body parser ───────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));

// ── Health check ──────────────────────────────────────────
app.get("/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString() })
);

// ── API routes ────────────────────────────────────────────
app.use("/api/upload",  uploadRouter);
app.use("/api/analyse", analyseRouter);
app.use("/api/chat",    chatRouter);

// ── 404 ───────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── Global error handler ──────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () =>
  console.log(`✅  PitchIQ backend running on port ${PORT}`)
);
