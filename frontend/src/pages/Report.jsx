import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/context";
import { sendChat } from "../lib/api";
import styles from "./Report.module.css";

const MAX_Q = 10;

function fmt(sec) {
  const s = Math.abs(Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

const RC = {
  Weak:      "var(--red)",
  Average:   "var(--amber)",
  Good:      "var(--cyan)",
  Excellent: "var(--green)",
};

export default function Report() {
  const nav = useNavigate();
  const { report, presenterName, setReport, setSlides } = useApp();

  const [history,   setHistory]   = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [chatErr,   setChatErr]   = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { if (!report) nav("/"); else window.scrollTo(0, 0); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  if (!report) return null;

  const r         = report;
  const score     = r.overallScore || 0;
  const deg       = Math.round((score / 100) * 360);
  const userQs    = history.filter(m => m.role === "user").length;
  const remaining = MAX_Q - userQs;

  async function send() {
    const msg = input.trim();
    if (!msg || loading || userQs >= MAX_Q) return;
    const next = [...history, { role: "user", content: msg }];
    setHistory(next);
    setInput("");
    setLoading(true);
    setChatErr("");
    try {
      const reply = await sendChat({ report: r, history: next, message: msg });
      setHistory(h => [...h, { role: "coach", content: reply }]);
    } catch (e) {
      setChatErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  function restart() { setReport(null); setSlides([]); nav("/"); }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>

        {/* Header */}
        <div className={styles.hdr}>
          <div className={styles.brand}>PITCHIQ · AI REPORT</div>
          <h1 className={styles.title}>YOUR REPORT</h1>
          <p className={styles.sub}>
            {presenterName} · {new Date().toLocaleDateString("en-US", {
              weekday: "long", year: "numeric", month: "long", day: "numeric"
            })}
          </p>
        </div>

        {/* Score + ratings */}
        <div className={styles.scoreSection}>
          <div className={styles.ring}
            style={{ background: `conic-gradient(var(--cyan) ${deg}deg, var(--wire) ${deg}deg)` }}>
            <div className={styles.ringHole}>
              <span className={styles.ringN}>{score}</span>
              <span className={styles.ringL}>/ 100</span>
            </div>
          </div>
          <div className={styles.ratings}>
            {[["Pace", r.paceRating], ["Clarity", r.clarityRating], ["Engagement", r.engagementRating]]
              .map(([l, v]) => (
                <div key={l} className={`${styles.rcard} card`}>
                  <span className={styles.rcL}>{l}</span>
                  <span className={styles.rcV}>{v || "—"}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Overall */}
        <section className={styles.sec}>
          <h2 className={styles.secTitle}>OVERALL FEEDBACK</h2>
          <div className={`${styles.fbCard} card`}>
            <p className={styles.fbText}>{r.overallFeedback}</p>
            {r.topTip && (
              <div className={styles.topTip}>
                <span className={styles.tipL}>⭐ TOP TIP</span>
                <p>{r.topTip}</p>
              </div>
            )}
            <div className={styles.twoCol}>
              {r.strengths?.length > 0 && (
                <div className={`${styles.colBox} card`}>
                  <div className={styles.colT} style={{ color: "var(--green)" }}>✅ Strengths</div>
                  <ul className={styles.colList}>
                    {r.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {r.improvements?.length > 0 && (
                <div className={`${styles.colBox} card`}>
                  <div className={styles.colT} style={{ color: "var(--red)" }}>🎯 Improve</div>
                  <ul className={styles.colList}>
                    {r.improvements.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Slide breakdown */}
        <section className={styles.sec}>
          <h2 className={styles.secTitle}>SLIDE-BY-SLIDE BREAKDOWN</h2>
          <div className={styles.slideCards}>
            {(r.slideAnalysis || []).map((s, i) => {
              const spent    = s.timeSpentSec || 0;
              const sugg     = s.suggestedSec || 60;
              const diffSec  = spent - sugg;
              const timeOk   = Math.abs(diffSec) <= 10;
              const timeLong = diffSec > 10;
              return (
                <div key={i} className={`${styles.sc} card`}>
                  <div className={styles.scHdr}>
                    <div className={styles.scL}>
                      <span className={styles.scNum}>S{s.slideNum}</span>
                      <span className={styles.scTitle2}>{s.title}</span>
                    </div>
                    <div className={styles.scR}>
                      <span className={styles.scRating} style={{ color: RC[s.rating] || "var(--mid)" }}>
                        {s.rating}
                      </span>
                      {s.score != null && <span className={styles.scScore}>{s.score}/100</span>}
                    </div>
                  </div>

                  {/* Time bar */}
                  <div className={styles.timeRow}>
                    <div className={styles.timeLabel}>
                      <span>⏱ Time spent</span>
                      <span className={styles.timeTaken}>{fmt(spent)}</span>
                    </div>
                    <div className={styles.timeBarWrap}>
                      <div className={styles.timeBarTrack}>
                        <div className={styles.timeBarFill}
                          style={{
                            width: `${Math.min(100, (spent / (sugg * 2)) * 100)}%`,
                            background: timeOk ? "var(--green)" : timeLong ? "var(--red)" : "var(--amber)",
                          }} />
                        {/* Suggested marker */}
                        <div className={styles.suggMarker}
                          style={{ left: `${Math.min(100, (sugg / (sugg * 2)) * 100)}%` }} />
                      </div>
                    </div>
                    <div className={styles.timeLabel} style={{ justifyContent: "flex-end" }}>
                      <span style={{ color: "var(--dim)" }}>Suggested</span>
                      <span className={styles.timeSugg}>{fmt(sugg)}</span>
                    </div>
                  </div>

                  <p className={styles.timeAssess}
                    style={{ color: timeOk ? "var(--green)" : timeLong ? "var(--red)" : "var(--amber)" }}>
                    {s.timeAssessment}
                  </p>

                  {/* How they presented */}
                  <div className={styles.scBlock}>
                    <div className={styles.scBL}>📢 How You Presented</div>
                    <p className={styles.scBT}>{s.howTheyPresented || "No speech detected."}</p>
                  </div>

                  {/* How it should be */}
                  <div className={`${styles.scBlock} ${styles.scIdeal}`}>
                    <div className={styles.scBL}>💡 How It Should Be</div>
                    <p className={styles.scBT}>{s.howItShouldBe}</p>
                  </div>

                  {/* Filler note */}
                  {s.fillerNote && (
                    <p className={styles.fillerNote}
                      style={{ color: s.fillerNote === "Clean delivery" ? "var(--green)" : "var(--red)" }}>
                      {s.fillerNote === "Clean delivery" ? "✅" : "🔴"} {s.fillerNote}
                    </p>
                  )}

                  {/* Improvement */}
                  <div className={styles.improvement}>
                    <span className={styles.impL}>🚀 IMPROVEMENT</span>
                    <p>{s.improvement}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Filler section */}
        {r.fillerWordAdvice && (
          <section className={styles.sec}>
            <h2 className={styles.secTitle}>FILLER WORD ADVICE</h2>
            <div className={`${styles.fbCard} card`}>
              <p className={styles.fbText}>{r.fillerWordAdvice}</p>
            </div>
          </section>
        )}

        {/* Chat */}
        <section className={styles.sec}>
          <h2 className={styles.secTitle}>CHAT WITH YOUR COACH</h2>
          <div className={`${styles.chatCard} card`}>
            <div className={styles.chatHeader}>
              <p className={styles.chatIntro}>
                Ask anything — how to improve a slide, how an interviewer would rate you,
                technical questions about your topic, communication tips…
              </p>
              <div className={`${styles.chatQuota} ${remaining <= 2 ? styles.quotaLow : ""}`}>
                {remaining}/{MAX_Q} questions left
              </div>
            </div>

            <div className={styles.chatMessages}>
              {history.length === 0 && (
                <div className={styles.chatEmpty}>
                  <p>💬 Try asking:</p>
                  <div className={styles.chatSuggestions}>
                    {[
                      "How would an interviewer rate my slide 1?",
                      "How can I improve my filler words?",
                      "Which slide was my weakest and why?",
                      "How should slide 2 ideally be presented?",
                    ].map(q => (
                      <button key={q} className={styles.chatSugg}
                        onClick={() => { setInput(q); }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {history.map((m, i) => (
                <div key={i} className={`${styles.msg} ${m.role === "user" ? styles.msgUser : styles.msgCoach}`}>
                  <div className={styles.msgRole}>{m.role === "user" ? "You" : "Coach"}</div>
                  <div className={styles.msgText}>{m.content}</div>
                </div>
              ))}
              {loading && (
                <div className={`${styles.msg} ${styles.msgCoach}`}>
                  <div className={styles.msgRole}>Coach</div>
                  <div className={styles.typing}><span /><span /><span /></div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {chatErr && <div className={styles.chatErr}>❌ {chatErr}</div>}

            <div className={styles.chatInputRow}>
              <input className="input" type="text"
                placeholder={userQs >= MAX_Q ? "Chat limit reached" : "Ask your coach anything…"}
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                disabled={loading || userQs >= MAX_Q} />
              <button className="btn btn-cta btn-md"
                onClick={send} disabled={loading || !input.trim() || userQs >= MAX_Q}>
                {loading ? "…" : "Send"}
              </button>
            </div>
          </div>
        </section>

        <button className={styles.restart} onClick={restart}>↩ Start New Session</button>
      </div>
    </div>
  );
}
