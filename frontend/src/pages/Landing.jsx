import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/context";
import { uploadPPTX } from "../lib/api";
import styles from "./Landing.module.css";

export default function Landing() {
  const nav = useNavigate();
  const { setSlides, setPresenterName, setSessionSec } = useApp();

  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileInfo,  setFileInfo]  = useState(null);   // { name, count }
  const [name,      setName]      = useState("");
  const [minutes,   setMinutes]   = useState(10);
  const [error,     setError]     = useState("");
  const fileRef = useRef();

  const canEnter = fileInfo && name.trim() && Number(minutes) >= 1;

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.match(/\.(pptx|ppt)$/i)) {
      setError("Only .pptx files are supported.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const { slides, filename, slideCount } = await uploadPPTX(file);
      setSlides(slides);
      setFileInfo({ name: filename, count: slideCount });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleEnter() {
    if (!canEnter) return;
    setPresenterName(name.trim());
    setSessionSec(Math.max(1, Number(minutes)) * 60);
    nav("/room");
  }

  const displayMin = Math.max(1, Number(minutes) || 1);

  return (
    <div className={styles.page}>
      <div className={styles.glow1} /><div className={styles.glow2} />

      <div className={styles.inner}>
        <div className={styles.hero}>
          <div className={styles.logo}>PitchIQ</div>
          <p className={styles.tagline}>Upload your deck · Enter the room · Get AI coached</p>
        </div>

        {/* Drop zone */}
        <div
          className={[styles.dz, dragging && styles.dzDrag, uploading && styles.dzBusy,
            fileInfo && styles.dzDone].filter(Boolean).join(" ")}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => !uploading && fileRef.current.click()}
        >
          <input ref={fileRef} type="file" accept=".pptx,.ppt" style={{ display: "none" }}
            onChange={e => handleFile(e.target.files[0])} />

          {uploading ? (
            <><div className={styles.spinner} /><p className={styles.dzTitle}>Extracting slides…</p></>
          ) : fileInfo ? (
            <>
              <span className={styles.dzIcon}>✅</span>
              <p className={styles.dzTitle} style={{ color: "var(--green)" }}>{fileInfo.name}</p>
              <p className={styles.dzSub}>{fileInfo.count} slides ready · click to change file</p>
            </>
          ) : (
            <>
              <span className={styles.dzIcon}>📂</span>
              <p className={styles.dzTitle}>Drop your PPTX here</p>
              <p className={styles.dzSub}>or click to browse · .pptx files only</p>
              <div className={styles.chips}>
                {["Slide extraction", "Live speech", "Filler detection", "AI report"].map(t => (
                  <span key={t} className={styles.chip}>{t}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {error && <div className={styles.err}>❌ {error}</div>}

        {/* Name */}
        <div>
          <label className="label">Your Name</label>
          <input className="input" type="text" placeholder="e.g. Arjun"
            value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* Duration */}
        <div className={styles.timeRow}>
          <div style={{ flex: 1 }}>
            <label className="label">Duration (minutes)</label>
            <input className="input" type="number" min={1} max={180} value={minutes}
              onChange={e => setMinutes(e.target.value)} />
          </div>
          <div className={styles.timeBox}>
            {String(displayMin).padStart(2, "0")}:00
          </div>
        </div>

        <button className="btn btn-cta btn-xl" style={{ width: "100%" }}
          disabled={!canEnter} onClick={handleEnter}>
          🚀 Enter Meeting Room
        </button>

        {/* Feature cards */}
        <div className={styles.feats}>
          {[
            ["🎙️", "Live Speech", "Every word captured and stored per slide"],
            ["⏱️", "Slide Timings", "Entry & exit time tracked for each slide"],
            ["🚨", "Filler Words", "16 fillers detected and highlighted live"],
            ["🤖", "AI Coaching", "Gemini evaluates your delivery vs ideal"],
          ].map(([icon, title, desc]) => (
            <div key={title} className={`${styles.feat} card`}>
              <span>{icon}</span>
              <strong>{title}</strong>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
