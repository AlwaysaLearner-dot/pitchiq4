import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, FILLERS } from "../lib/context";
import { analyseSession } from "../lib/api";
import styles from "./Room.module.css";

function Modal({ children }) {
  return (
    <div className={styles.modalBack}>
      <div className={styles.modalBox}>{children}</div>
    </div>
  );
}

function fmt(sec) {
  const s = Math.abs(Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function Room() {
  const nav = useNavigate();
  const { slides, presenterName, sessionSec, setReport } = useApp();

  useEffect(() => { if (!slides.length) nav("/"); }, []);

  const [phase, setPhase]   = useState("consent");
  const [curSlide, setCurSlide] = useState(0);
  const curSlideRef = useRef(0);

  /*
   * TWO-POINTER TIMING
   * slideEntry[i] = elapsed seconds when slide i became visible
   * slideExit[i]  = elapsed seconds when NEXT was clicked on slide i (-1 = not yet)
   */
  const slideEntryRef = useRef(slides.map(() => -1));
  const slideExitRef  = useRef(slides.map(() => -1));
  const transcriptsRef = useRef(slides.map(() => ""));

  /* Count-up timer */
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const timerRef   = useRef(null);

  /* Next lock */
  const [nextLock, setNextLock] = useState(10);
  const lockRef = useRef(null);

  function startNextLock() {
    clearInterval(lockRef.current);
    setNextLock(10);
    let c = 10;
    lockRef.current = setInterval(() => {
      c--;
      setNextLock(c);
      if (c <= 0) clearInterval(lockRef.current);
    }, 1000);
  }

  /* Speech */
  const [micOn,    setMicOn]    = useState(false);
  const [liveText, setLiveText] = useState("");
  const [interim,  setInterim]  = useState("");
  const recRef       = useRef(null);
  const liveTextRef  = useRef("");
  const fillerRef    = useRef(Object.fromEntries(FILLERS.map(f => [f, 0])));
  const wordRef      = useRef(0);

  const [fillerCounts, setFillerCounts] = useState(
    () => Object.fromEntries(FILLERS.map(f => [f, 0]))
  );
  const [wordCount, setWordCount] = useState(0);

  /* Camera */
  const [camOn,  setCamOn]  = useState(false);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  /* UI */
  const [sideTab, setSideTab] = useState("speech");
  const [showPrevConfirm, setShowPrevConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [analyseError,    setAnalyseError]    = useState("");
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  /* ── Timer state for visual changes ───────────────────
   * normal: 0 → sessionSec-30
   * warn:   sessionSec-30 → sessionSec   (bigger, amber)
   * over:   >= sessionSec                (biggest, red pulse)
   */
  function timerState(e) {
    if (e >= sessionSec)        return "over";
    if (e >= sessionSec - 30)   return "warn";
    return "normal";
  }

  /* ══════════════════════════════════════════════════════
     START SESSION
  ══════════════════════════════════════════════════════ */
  function startSession() {
    setPhase("presenting");
    elapsedRef.current = 0;
    // Entry for slide 0 = second 0
    slideEntryRef.current[0] = 0;
    startTimer();
    startSpeech();
    startNextLock();
  }

  function startTimer() {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  }

  /* ══════════════════════════════════════════════════════
     SPEECH
  ══════════════════════════════════════════════════════ */
  function startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast("Use Chrome for speech recognition", "error"); return; }

    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    recRef.current = rec;

    rec.onstart = () => setMicOn(true);
    rec.onerror = e => { if (e.error !== "no-speech") setMicOn(false); };
    rec.onend   = () => { try { rec.start(); } catch (_) {} };

    rec.onresult = e => {
      let fin = "", int = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        e.results[i].isFinal ? (fin += t + " ") : (int += t);
      }
      setInterim(int);
      if (fin) {
        const idx = curSlideRef.current;
        transcriptsRef.current[idx] =
          (transcriptsRef.current[idx] + " " + fin).trim();
        liveTextRef.current = (liveTextRef.current + " " + fin).trim();
        setLiveText(liveTextRef.current);
        wordRef.current += fin.trim().split(/\s+/).filter(Boolean).length;
        setWordCount(wordRef.current);
        const low = fin.toLowerCase();
        const nf  = { ...fillerRef.current };
        FILLERS.forEach(f => {
          const m = low.match(new RegExp(`\\b${f.replace(/\s+/g, "\\s+")}\\b`, "gi"));
          if (m) nf[f] = (nf[f] || 0) + m.length;
        });
        fillerRef.current = nf;
        setFillerCounts({ ...nf });
      }
    };
    rec.start();
  }

  /* ══════════════════════════════════════════════════════
     CAMERA (preview only — no recording, no analysis)
  ══════════════════════════════════════════════════════ */
  async function toggleCam() {
    if (camOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCamOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamOn(true);
      } catch {
        showToast("Camera permission denied", "error");
      }
    }
  }

  /* ══════════════════════════════════════════════════════
     NAVIGATION — two-pointer logic
  ══════════════════════════════════════════════════════ */
  function goNext() {
    const cur  = curSlideRef.current;
    const next = cur + 1;

    // Exit pointer for current slide
    slideExitRef.current[cur] = elapsedRef.current;

    // Entry pointer for next slide (same instant)
    slideEntryRef.current[next] = elapsedRef.current;
    transcriptsRef.current[next] = "";

    const dur = slideExitRef.current[cur] - slideEntryRef.current[cur];
    showToast(`Slide ${cur + 1} — ${fmt(dur)} recorded`, "info");

    curSlideRef.current = next;
    liveTextRef.current = "";
    setLiveText(""); setInterim("");
    setCurSlide(next);
    startNextLock();
  }

  function handlePrev() {
    if (curSlideRef.current === 0) return;
    setShowPrevConfirm(true);
  }

  function confirmPrev() {
    setShowPrevConfirm(false);
    const cur  = curSlideRef.current;
    const prev = cur - 1;

    // Wipe current slide
    slideEntryRef.current[cur] = -1;
    slideExitRef.current[cur]  = -1;
    transcriptsRef.current[cur] = "";

    // Wipe exit of prev slide (it will be re-presented)
    // Re-entry starts NOW
    slideExitRef.current[prev]  = -1;
    slideEntryRef.current[prev] = elapsedRef.current;
    transcriptsRef.current[prev] = "";

    curSlideRef.current = prev;
    liveTextRef.current = "";
    setLiveText(""); setInterim("");
    setCurSlide(prev);
    startNextLock();
    showToast(`Back to Slide ${prev + 1} — recording restarted`, "warn");
  }

  /* ══════════════════════════════════════════════════════
     ANALYSE
  ══════════════════════════════════════════════════════ */
  async function handleAnalyse() {
    const last = curSlideRef.current;
    slideExitRef.current[last] = elapsedRef.current;

    clearInterval(timerRef.current);
    clearInterval(lockRef.current);
    try { recRef.current?.stop(); } catch (_) {}
    streamRef.current?.getTracks().forEach(t => t.stop());

    setPhase("analysing");
    setAnalyseError("");

    const slideDurations = slides.map((_, i) => {
      const en = slideEntryRef.current[i];
      const ex = slideExitRef.current[i];
      if (en === -1) return 0;
      if (ex === -1) return Math.max(0, elapsedRef.current - en);
      return Math.max(0, ex - en);
    });

    const suggestedPerSlide = Math.round(sessionSec / slides.length);

    try {
      const report = await analyseSession({
        
        presenterName,
        sessionDurationSec:  sessionSec,
        totalElapsed:        elapsedRef.current,
        totalWords:          wordRef.current,
        fillerCounts:        fillerRef.current,
        slides,
        slideDurations,
        suggestedPerSlide,
        finalTranscripts:    transcriptsRef.current,
      });
      setReport(report);
      nav("/report");
    } catch (e) {
      setAnalyseError(e.message);
      setPhase("presenting");
      startTimer();
      startSpeech();
    }
  }

  /* ══════════════════════════════════════════════════════
     EXIT
  ══════════════════════════════════════════════════════ */
  function confirmExit() {
    clearInterval(timerRef.current);
    clearInterval(lockRef.current);
    try { recRef.current?.stop(); } catch (_) {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    nav("/");
  }

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(lockRef.current);
    try { recRef.current?.stop(); } catch (_) {}
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  /* ── Derived ─────────────────────────────────────────── */
  function highlight(text) {
    if (!text) return "";
    let r = text;
    FILLERS.forEach(f => {
      r = r.replace(
        new RegExp(`\\b(${f.replace(/\s+/g, "\\s+")})\\b`, "gi"),
        '<mark class="fmark">$1</mark>'
      );
    });
    return r;
  }

  function liveDur(i) {
    const en = slideEntryRef.current[i];
    const ex = slideExitRef.current[i];
    if (en === -1) return null;
    if (i < curSlide) return ex === -1 ? 0 : ex - en;
    if (i === curSlide) return elapsed - en;
    return null;
  }

  const totalFillers = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  const isLastSlide  = curSlide === slides.length - 1;
  const tState       = timerState(elapsed);
  const slide        = slides[curSlide] || {};
  const suggested    = Math.round(sessionSec / slides.length);

  /* ══════════════════════════════════════════════════════
     CONSENT
  ══════════════════════════════════════════════════════ */
  if (phase === "consent") return (
    <div className={styles.consentPage}>
      <div className={`${styles.consentCard} card`}>
        <span style={{ fontSize: 52 }}>🎙️</span>
        <h2 className={styles.consentTitle}>Ready to Present?</h2>
        <p className={styles.consentBody}>
          Clicking <strong>"Start Meeting"</strong> activates your microphone and begins recording.
          Speech is captured slide by slide throughout the entire session.
          Recording runs until you click <strong>"Analyse"</strong> on the last slide.
          Use <strong>"Exit Meeting"</strong> to leave early.
        </p>
        <div className={styles.consentChips}>
          <div className={styles.cchip}><span>👤</span><strong>{presenterName}</strong></div>
          <div className={styles.cchip}><span>📊</span><strong>{slides.length} slides</strong></div>
          <div className={styles.cchip}><span>⏱️</span><strong>Target {fmt(sessionSec)}</strong></div>
        </div>
        <div className={styles.consentActions}>
          <button className="btn btn-cta btn-xl" style={{ width: "100%" }} onClick={startSession}>
            ✅ Start Meeting
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => nav("/")}>← Go back</button>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════
     ANALYSING
  ══════════════════════════════════════════════════════ */
  if (phase === "analysing") return (
    <div className={styles.analysingPage}>
      <div className={styles.analysingRing} />
      <h2 className={styles.analysingTitle}>Gemini is analysing your presentation…</h2>
      <p className={styles.analysingText}>
        {slides.length} slides · {wordRef.current} words · {fmt(elapsedRef.current)} total
      </p>
      {analyseError && (
        <div className={styles.analyseErr}>
          ❌ {analyseError}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}
            onClick={() => { setPhase("presenting"); startTimer(); startSpeech(); }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════════════
     MAIN ROOM
  ══════════════════════════════════════════════════════ */
  return (
    <div className={styles.room}>
      {toast && <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.msg}</div>}

      {showPrevConfirm && (
        <Modal>
          <span style={{ fontSize: 36 }}>⚠️</span>
          <h3 className={styles.mTitle}>Go Back to Slide {curSlide}?</h3>
          <p className={styles.mBody}>
            All speech recorded for <strong>Slide {curSlide}</strong> and{" "}
            <strong>Slide {curSlide + 1}</strong> will be <strong>overwritten</strong>.
            Recording restarts from Slide {curSlide} right now.
          </p>
          <div className={styles.mActions}>
            <button className="btn btn-red btn-md" onClick={confirmPrev}>Yes, go back</button>
            <button className="btn btn-ghost btn-md" onClick={() => setShowPrevConfirm(false)}>Stay here</button>
          </div>
        </Modal>
      )}

      {showExitConfirm && (
        <Modal>
          <span style={{ fontSize: 36 }}>🚪</span>
          <h3 className={styles.mTitle}>Exit Meeting?</h3>
          <p className={styles.mBody}>
            You haven't completed all slides. All recorded data will be lost.
          </p>
          <div className={styles.mActions}>
            <button className="btn btn-red btn-md" onClick={confirmExit}>Yes, exit</button>
            <button className="btn btn-ghost btn-md" onClick={() => setShowExitConfirm(false)}>Stay in meeting</button>
          </div>
        </Modal>
      )}

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.hLeft}>
          <span className={styles.brand}>PitchIQ</span>
          <div className={styles.recBadge}><span className={styles.recDot} />REC</div>
        </div>

        {/* COUNT-UP TIMER */}
        <div className={`${styles.timerBlock} ${styles["ts_" + tState]}`}>
          <span className={styles.timerNum}>{fmt(elapsed)}</span>
          <span className={styles.timerHint}>
            {tState === "over" ? "⚠ Wrap up!" :
             tState === "warn" ? `⚡ ${fmt(sessionSec - elapsed)} left` :
             `/ ${fmt(sessionSec)}`}
          </span>
        </div>

        <div className={styles.hRight}>
          <div className={styles.slidePill}>Slide {curSlide + 1}/{slides.length}</div>
          <button className="btn btn-red btn-sm" onClick={() => setShowExitConfirm(true)}>
            🚪 Exit
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className={styles.body}>

        {/* Stage */}
        <div className={styles.stage}>

          {/* Slide card */}
          <div className={styles.slideCard}>
            {camOn && (
              <div className={styles.camPip}>
                <video ref={videoRef} autoPlay muted playsInline className={styles.camVideo} />
                <span className={styles.camLabel}>👁 Preview only</span>
              </div>
            )}
            {!camOn && <video ref={videoRef} style={{ display: "none" }} />}

            <span className={styles.slideTag}>S{curSlide + 1}</span>

            <div className={styles.slideInner}>
              <h2 className={styles.slideTitle}>{slide.title}</h2>
              {slide.body && <p className={styles.slideBody}>{slide.body}</p>}
            </div>

            <div className={styles.slideTimerBadge}>
              ⏱ {fmt(liveDur(curSlide) || 0)} · suggested {fmt(suggested)}
            </div>
          </div>

          {/* Thumbnails */}
          <div className={styles.thumbStrip}>
            {slides.map((s, i) => {
              const d = liveDur(i);
              return (
                <div key={i} className={[
                  styles.thumb,
                  i === curSlide  ? styles.thumbOn      : "",
                  i < curSlide    ? styles.thumbDone    : "",
                  i > curSlide    ? styles.thumbPending : "",
                ].join(" ")}>
                  <span className={styles.tNum}>S{i + 1}</span>
                  <span className={styles.tTitle}>{s.title.slice(0, 14)}</span>
                  {i < curSlide && d !== null &&
                    <span className={styles.tTime}>{fmt(d)}</span>}
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className={styles.controls}>
            <div className={styles.ctrlL}>
              <button className={styles.navBtn} onClick={handlePrev} disabled={curSlide === 0}>
                ◀ Prev
              </button>
            </div>

            <div className={styles.ctrlC}>
              {/* Mic (display only — auto-on) */}
              <div className={`${styles.iconBtn} ${micOn ? styles.iconOn : styles.iconOff}`}>
                <span style={{ fontSize: 20 }}>{micOn ? "🎙️" : "🎤"}</span>
                {micOn && (
                  <div className={styles.wave}>
                    {[100, 55, 80, 45, 70].map((h, i) => (
                      <div key={i} className={styles.wb}
                        style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Camera toggle */}
              <button className={`${styles.iconBtn} ${camOn ? styles.iconOn : styles.iconOff}`}
                onClick={toggleCam} title="Camera preview">
                <span style={{ fontSize: 20 }}>{camOn ? "📷" : "📵"}</span>
              </button>
            </div>

            <div className={styles.ctrlR}>
              {isLastSlide ? (
                <button className="btn btn-green btn-md"
                  onClick={handleAnalyse} disabled={nextLock > 0}>
                  {nextLock > 0 ? `Wait ${nextLock}s…` : "🤖 Analyse"}
                </button>
              ) : (
                <button className={`${styles.navBtn} ${styles.navNext}`}
                  onClick={goNext} disabled={nextLock > 0}>
                  {nextLock > 0 ? `Next (${nextLock}s)` : "Next ▶"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sideTabs}>
            {[["speech", "Live Speech"], ["fillers", "Fillers"], ["timings", "Timings"]].map(([k, l]) => (
              <button key={k}
                className={`${styles.stab} ${sideTab === k ? styles.stabOn : ""}`}
                onClick={() => setSideTab(k)}>{l}
              </button>
            ))}
          </div>

          <div className={styles.sideBody}>
            {sideTab === "speech" && (
              <div>
                <div className={styles.micRow}>
                  <span>🎙️</span>
                  <span className={styles.micLbl}>Microphone</span>
                  <span className={`${styles.micStat} ${micOn ? styles.micOn : styles.micOff}`}>
                    {micOn ? "ACTIVE" : "OFF"}
                  </span>
                </div>
                <div className={styles.txBox}
                  dangerouslySetInnerHTML={{
                    __html:
                      highlight(liveText) +
                      (interim ? `<span class="int"> ${interim}</span>` : "") ||
                      '<span class="int">Listening — start speaking…</span>',
                  }} />
                <p className={styles.txNote}>{wordCount} words · fillers highlighted red</p>
              </div>
            )}

            {sideTab === "fillers" && (
              <div>
                <p className={styles.sideNote}>Real-time filler detection</p>
                <div className={styles.fillerGrid}>
                  {FILLERS.map(f => (
                    <div key={f} className={`${styles.fi} ${fillerCounts[f] > 0 ? styles.fiHit : ""}`}>
                      <span className={styles.fiW}>"{f}"</span>
                      <span className={`${styles.fiN} ${!fillerCounts[f] ? styles.fiZ : ""}`}>
                        {fillerCounts[f] || 0}
                      </span>
                    </div>
                  ))}
                </div>
                <p className={styles.sideNote} style={{ marginTop: 12 }}>
                  Total: <strong style={{ color: "var(--red)" }}>{totalFillers}</strong>
                </p>
              </div>
            )}

            {sideTab === "timings" && (
              <div>
                <p className={styles.sideNote}>
                  Per slide · Suggested {fmt(suggested)} each
                </p>
                <div className={styles.timingList}>
                  {slides.map((s, i) => {
                    const d    = liveDur(i);
                    const over = d !== null && d > suggested + 10;
                    const less = d !== null && i < curSlide && d < suggested - 10;
                    return (
                      <div key={i} className={`${styles.ti} ${i === curSlide ? styles.tiOn : ""}`}>
                        <span className={styles.tiLbl}>S{i + 1}: {s.title.slice(0, 16)}</span>
                        <div className={styles.tiRight}>
                          <span className={styles.tiVal}
                            style={{ color: over ? "var(--red)" : less ? "var(--amber)" : "var(--amber)" }}>
                            {d !== null ? fmt(d) : "—"}
                          </span>
                          {over && <span className={styles.tiTag} style={{ background: "rgba(255,69,96,.2)", color: "var(--red)" }}>over</span>}
                          {less && <span className={styles.tiTag} style={{ background: "rgba(255,183,0,.15)", color: "var(--amber)" }}>short</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .fmark { background:rgba(255,69,96,.2);color:var(--red);border-radius:3px;padding:0 3px; }
        .int   { color:var(--dim);font-style:italic; }
      `}</style>
    </div>
  );
}
