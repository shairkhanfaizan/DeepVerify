import React, { useState, useEffect, useRef } from "react";
import { fetchApi } from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Upload, X, FileImage, Sparkles, ChevronDown } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { SecureImage } from "../components/ui/SecureImage";

interface AnalysisResultResponse {
  verdict: string;
  ensemble_score: number;
  created_at: string;
}

interface EvidenceItem {
  id: string;
  name?: string;
  original_filename?: string;
  status: string;
  created_at: string;
  analysis_results?: AnalysisResultResponse[];
  observations?: Array<{ signal_type: string; value: string }>;
}

interface InvestigationListResponse {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at?: string;
  evidence_items?: EvidenceItem[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(t: any): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function timeAgo(t: any): string {
  if (!t) return "just now";
  const diffMs = Date.now() - new Date(t).getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHrs = Math.round(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hr ago`;
  const diffDays = Math.round(diffHrs / 24);
  return diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
}

function getPhotoDisplayName(p: any): string {
  if (p.name && p.name.trim()) return p.name.trim();
  if (p.original_filename && p.original_filename.trim()) return p.original_filename.trim();
  const obs = p.observations?.find((o: any) => o.signal_type === "ORIGINAL_FILENAME" || o.signal_type === "EVIDENCE_NAME");
  if (obs?.value && obs.value.trim()) return obs.value.trim();
  return `Photo (${p.id.slice(0, 8)})`;
}

const TIPS = [
  "AI faces often get ears, teeth and earrings slightly wrong. Zoom in on them!",
  "Text inside AI images (signs, shirts, posters) is often gibberish.",
  "Too perfect? Real photos have little flaws – AI skin often looks airbrushed.",
  "Check the hands. AI still struggles with fingers.",
  "A scary or shocking photo spreading fast? Scan it before you share it."
];

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [investigations, setInvestigations] = useState<InvestigationListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [timeframe, setTimeframe] = useState<7 | 14 | 30>(14);

  // Tip of the session
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  // Upload modal states
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [targetCaseId, setTargetCaseId] = useState<string>("__new");
  const [newCaseName, setNewCaseName] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);

  // Interactive line chart tooltip state
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchApi("/api/v2/investigations/");
      const detailedPromises = (data || []).map((inv: any) =>
        fetchApi(`/api/v2/investigations/${inv.id}`).catch(() => null)
      );
      const detailed = await Promise.all(detailedPromises);
      setInvestigations(detailed.filter(Boolean));
    } catch (err: unknown) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileDrop = (file: File) => {
    const cleanName = file.name.replace(/\.[^.]+$/, "");
    setSelectedFileForUpload(file);
    setPhotoName(cleanName);
    setNewCaseName("Case: " + cleanName);
    setTargetCaseId("__new");
    setPreviewUrl(URL.createObjectURL(file));
    setShowNameModal(true);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFileForUpload) return;
    try {
      setCreating(true);
      let invId = targetCaseId;
      if (invId === "__new") {
        const invData = await fetchApi("/api/v2/investigations/", {
          method: "POST",
          body: JSON.stringify({ 
            title: newCaseName.trim() || photoName.trim() || "Case: " + selectedFileForUpload.name, 
          }),
        });
        invId = invData.id;
      }

      const formData = new FormData();
      formData.append("file", selectedFileForUpload);
      formData.append("name", photoName.trim() || selectedFileForUpload.name.replace(/\.[^.]+$/, ""));
      
      const evData = await fetchApi(`/api/v2/investigations/${invId}/evidence`, {
        method: "POST",
        body: formData,
      });
      
      setShowNameModal(false);
      setSelectedFileForUpload(null);

      if (evData.evidence_id || evData.id) {
        const evId = evData.evidence_id || evData.id;
        fetchApi(`/api/v2/investigations/${invId}/evidence/${evId}/analyze`, {
          method: "POST",
          body: JSON.stringify({ policy: "ensemble-v1.0" })
        }).catch(console.error);
        navigate(`/investigation/${invId}/evidence/${evId}`);
      } else {
        navigate(`/investigation/${invId}`);
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to initialize scan: ${msg}`);
    } finally {
      setCreating(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileDrop(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileDrop(file);
  };

  // Flatten all photos from all investigations
  const allPhotos: Array<{
    id: string;
    caseId: string;
    caseName: string;
    name: string;
    status: string;
    createdAt: string;
    score: number | null;
    ai: number;
    verdictKey: "real" | "warn" | "ai" | "wait";
    verdictLabel: string;
    verdictEmoji: string;
    raw: any;
  }> = [];

  investigations.forEach((inv) => {
    (inv.evidence_items || []).forEach((ev) => {
      const auth = ev.analysis_results?.[0]?.ensemble_score ?? null;
      let ai = 50;
      let verdictKey: "real" | "warn" | "ai" | "wait" = "wait";
      let verdictLabel = "Scanning";
      let verdictEmoji = "⏳";

      if (ev.status === "COMPLETED" && auth !== null) {
        ai = Math.round((1 - auth) * 100);
        if (ai >= 65) {
          verdictKey = "ai";
          verdictLabel = "Likely AI-made";
          verdictEmoji = "🤖";
        } else if (ai >= 35) {
          verdictKey = "warn";
          verdictLabel = "Not sure";
          verdictEmoji = "🤔";
        } else {
          verdictKey = "real";
          verdictLabel = "Looks real";
          verdictEmoji = "✅";
        }
      }

      allPhotos.push({
        id: ev.id,
        caseId: inv.id,
        caseName: inv.title || "Untitled Case",
        name: getPhotoDisplayName(ev),
        status: ev.status,
        createdAt: ev.created_at || inv.created_at,
        score: auth,
        ai,
        verdictKey,
        verdictLabel,
        verdictEmoji,
        raw: ev
      });
    });
  });

  const completedPhotos = allPhotos.filter((p) => p.status === "COMPLETED");
  const countReal = completedPhotos.filter((p) => p.verdictKey === "real").length;
  const countWarn = completedPhotos.filter((p) => p.verdictKey === "warn").length;
  const countAi = completedPhotos.filter((p) => p.verdictKey === "ai").length;
  const totalCompleted = completedPhotos.length;

  const realRate = totalCompleted ? Math.round((countReal / totalCompleted) * 100) : 0;
  const aiRate = totalCompleted ? Math.round((countAi / totalCompleted) * 100) : 0;

  // Week-over-week calculation matching deepverify-app/page-home.js
  const WEEK_MS = 7 * 864e5;
  const nowMs = Date.now();
  const thisWeekCount = completedPhotos.filter((p) => new Date(p.createdAt).getTime() > nowMs - WEEK_MS).length;
  const lastWeekCount = completedPhotos.filter(
    (p) =>
      new Date(p.createdAt).getTime() <= nowMs - WEEK_MS &&
      new Date(p.createdAt).getTime() > nowMs - 2 * WEEK_MS
  ).length;
  const diff = thisWeekCount - lastWeekCount;

  const casesWithPhotos = investigations.filter((inv) => inv.evidence_items && inv.evidence_items.length > 0).length;

  // Latest checks (6 items)
  const recentPhotos = [...allPhotos]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // Greeting logic matching deepverify-app/page-home.js
  const hr = new Date().getHours();
  const greeting =
    hr < 5
      ? "Burning the midnight oil"
      : hr < 12
      ? "Good morning"
      : hr < 17
      ? "Good afternoon"
      : "Good evening";

  const firstName =
    localStorage.getItem("deepverify_user_name") || user?.email?.split("@")[0] || "Faizan";

  // Daily time series for line chart matching deepverify-app/charts.js
  const dailyData: Array<{ t: number; dateStr: string; real: number; warn: number; ai: number }> = [];
  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);
  const startDayMs = startDay.getTime();

  for (let i = timeframe - 1; i >= 0; i--) {
    const dayTimestamp = startDayMs - i * 864e5;
    const dayEnd = dayTimestamp + 864e5;
    const inDay = completedPhotos.filter((p) => {
      const pt = new Date(p.createdAt).getTime();
      return pt >= dayTimestamp && pt < dayEnd;
    });

    const dayDate = new Date(dayTimestamp);
    const dateStr = `${dayDate.getDate()} ${MONTHS[dayDate.getMonth()]}`;
    dailyData.push({
      t: dayTimestamp,
      dateStr,
      real: inDay.filter((p) => p.verdictKey === "real").length,
      warn: inDay.filter((p) => p.verdictKey === "warn").length,
      ai: inDay.filter((p) => p.verdictKey === "ai").length
    });
  }

  // SVG Line Chart Dimension matching DV.lineChart (W: 700, H: 280, pl: 36, pr: 14, pt: 16, pb: 30)
  const W = 700;
  const H = 280;
  const pl = 36;
  const pr = 14;
  const pt = 16;
  const pb = 30;

  const maxDaily = Math.max(
    3,
    ...dailyData.map((d) => Math.max(d.real, d.warn, d.ai))
  );
  const topDaily = Math.ceil(maxDaily / 2) * 2;

  const getX = (i: number) => pl + (i * (W - pl - pr)) / (dailyData.length - 1 || 1);
  const getY = (v: number) => pt + (1 - v / topDaily) * (H - pt - pb);

  const buildPath = (key: "real" | "warn" | "ai") =>
    dailyData.map((d, i) => `${i ? "L" : "M"}${getX(i).toFixed(1)},${getY(d[key]).toFixed(1)}`).join(" ");

  const buildArea = (key: "real" | "warn" | "ai") =>
    `${buildPath(key)} L${getX(dailyData.length - 1)},${H - pb} L${getX(0)},${H - pb} Z`;

  // Donut chart calculations matching DV.donut (R: 70, CIRC: 2 * PI * 70 = 439.82)
  const R_DONUT = 70;
  const CIRC_DONUT = 2 * Math.PI * R_DONUT;
  const totalForDonut = totalCompleted || 1;
  const realLen = totalCompleted ? (countReal / totalForDonut) * CIRC_DONUT : 0;
  const warnLen = totalCompleted ? (countWarn / totalForDonut) * CIRC_DONUT : 0;
  const aiLen = totalCompleted ? (countAi / totalForDonut) * CIRC_DONUT : 0;

  // Busiest cases top 5 matching DV.vbars
  const busiestCasesList = [...investigations]
    .map((inv) => ({
      name: inv.title || "Untitled",
      count: (inv.evidence_items || []).length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxBusiest = Math.max(1, ...busiestCasesList.map((c) => c.count)) * 1.2;
  const VB_W = 460;
  const VB_H = 220;
  const VB_PL = 28;
  const VB_PB = 38;
  const VB_PT = 12;
  const bw = busiestCasesList.length ? (VB_W - VB_PL) / busiestCasesList.length : 60;

  return (
    <div style={{ minHeight: "100%" }}>
      {/* Hidden File Input for Native Upload Flow */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept="image/jpeg, image/png, image/webp" 
      />

      {/* 1. Sticky Top Header Bar matching deepverify-app */}
      <div className="top">
        <div className="crumb">
          <b>Home</b>
        </div>
        <div className="top-r">
          <span className="pill">
            <i />Scanner ready
          </span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn pri sm flex items-center gap-1.5"
            disabled={creating}
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 inline mr-1" />}
            Check a photo
          </button>
        </div>
      </div>

      <div id="view">
        <div className="stagger" style={{ display: "grid", gap: "22px" }}>

          {/* Section 1: Hero Strip matching deepverify-app/page-home.js */}
          <section className="hero">
            <div>
              <span className="tag info">✨ AI PHOTO DETECTIVE</span>
              <h1 style={{ marginTop: "14px" }}>
                {greeting}, <span className="grad">{firstName}</span> 👋
              </h1>
              <p className="lead">
                Got a photo you're not sure about? Drop it in and we'll tell you if it looks real or AI-made – in about 10 seconds.
              </p>
              <p className="sm muted" style={{ marginTop: "18px", padding: "12px 14px", borderRadius: "12px", background: "rgba(56,189,248,.08)", border: "1px solid var(--line)", maxWidth: "520px" }}>
                💡 <b>Tip:</b> {tip}
              </p>
            </div>

            <div
              className={`drop ${isDragging ? "over" : ""}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              tabIndex={0}
              role="button"
              aria-label="Choose a photo to check"
            >
              <div className="big">
                <svg className="ico" viewBox="0 0 24 24" style={{ width: 28, height: 28, stroke: "#04122b", fill: "none", strokeWidth: 2.2 }}>
                  <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
                </svg>
              </div>
              <h3>Drop a photo here</h3>
              <p className="muted sm" style={{ margin: "6px 0 16px" }}>
                or click to browse · JPG, PNG, WebP
              </p>
              <span className="btn pri sm">Choose a photo</span>
            </div>
          </section>

          {/* Section 2: 4 Stats Cards matching deepverify-app/page-home.js */}
          <section className="grid g4">
            <div className="card stat">
              <div className="ic" style={{ background: "rgba(56,189,248,.12)" }}>🔍</div>
              <div className="l">Photos checked</div>
              <div className="n">{loading ? "…" : totalCompleted}</div>
              <div className="d">
                {diff >= 0 ? (
                  <span className="up">▲ {diff} vs last week</span>
                ) : (
                  <span className="down">▼ {Math.abs(diff)} vs last week</span>
                )}
              </div>
            </div>

            <div className="card stat">
              <div className="ic" style={{ background: "rgba(46,230,166,.12)" }}>✅</div>
              <div className="l">Looked real</div>
              <div className="n">{loading ? "…" : countReal}</div>
              <div className="d">
                <span className="faint">{totalCompleted ? realRate : 0}% of your photos</span>
              </div>
            </div>

            <div className="card stat">
              <div className="ic" style={{ background: "rgba(251,113,133,.12)" }}>🤖</div>
              <div className="l">Likely AI-made</div>
              <div className="n">{loading ? "…" : countAi}</div>
              <div className="d">
                <span className="faint">{totalCompleted ? aiRate : 0}% of your photos</span>
              </div>
            </div>

            <div className="card stat">
              <div className="ic" style={{ background: "rgba(251,191,36,.12)" }}>📁</div>
              <div className="l">Cases</div>
              <div className="n">{loading ? "…" : investigations.length}</div>
              <div className="d">
                <span className="faint">{casesWithPhotos} with photos</span>
              </div>
            </div>
          </section>

          {/* Section 3: Real vs AI over time & What we found matching deepverify-app/page-home.js */}
          <section className="grid g-main">
            {/* Left: Real vs AI line chart */}
            <div className="card glow">
              <div className="row between" style={{ marginBottom: "6px" }}>
                <div>
                  <h2>Real vs AI over time</h2>
                  <p className="muted sm">How many photos you checked each day</p>
                </div>
                <div className="tabs" id="range">
                  <button className={timeframe === 7 ? "on" : ""} onClick={() => setTimeframe(7)}>7 days</button>
                  <button className={timeframe === 14 ? "on" : ""} onClick={() => setTimeframe(14)}>14 days</button>
                  <button className={timeframe === 30 ? "on" : ""} onClick={() => setTimeframe(30)}>30 days</button>
                </div>
              </div>

              {/* Dependency-Free Interactive SVG Line Chart matching deepverify-app/charts.js */}
              <div style={{ position: "relative", marginTop: "8px", minHeight: "280px" }}>
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  width="100%"
                  role="img"
                  aria-label="Photos checked per day"
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const px = ((e.clientX - rect.left) / rect.width) * W;
                    const idx = Math.max(0, Math.min(dailyData.length - 1, Math.round(((px - pl) / (W - pl - pr)) * (dailyData.length - 1))));
                    setHoverIndex(idx);
                  }}
                  onPointerLeave={() => setHoverIndex(null)}
                >
                  <defs>
                    <linearGradient id="ga-real" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#2ee6a6" stopOpacity="0.35" />
                      <stop offset="1" stopColor="#2ee6a6" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="ga-warn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#fbbf24" stopOpacity="0.35" />
                      <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="ga-ai" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#fb7185" stopOpacity="0.35" />
                      <stop offset="1" stopColor="#fb7185" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines & Y labels */}
                  {[0, 1, 2, 3, 4].map((i) => {
                    const v = (topDaily / 4) * i;
                    const yy = getY(v);
                    return (
                      <g key={i}>
                        <line x1={pl} x2={W - pr} y1={yy} y2={yy} stroke="rgba(120,160,255,.14)" />
                        <text x={pl - 8} y={yy + 4} textAnchor="end" fill="#8da0c4" fontSize="11">
                          {Math.round(v)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Date labels along X axis */}
                  {dailyData.map((d, i) => {
                    const step = Math.ceil(dailyData.length / 7);
                    if (i % step === 0 || i === dailyData.length - 1) {
                      return (
                        <text key={i} x={getX(i)} y={H - 8} textAnchor="middle" fill="#8da0c4" fontSize="11">
                          {d.dateStr}
                        </text>
                      );
                    }
                    return null;
                  })}

                  {/* Shaded Areas */}
                  <path d={buildArea("real")} fill="url(#ga-real)" />
                  <path d={buildArea("warn")} fill="url(#ga-warn)" />
                  <path d={buildArea("ai")} fill="url(#ga-ai)" />

                  {/* Smooth Colored Lines */}
                  <path d={buildPath("real")} fill="none" stroke="#2ee6a6" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
                  <path d={buildPath("warn")} fill="none" stroke="#fbbf24" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
                  <path d={buildPath("ai")} fill="none" stroke="#fb7185" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />

                  {/* Interactive Guide Line and Dots */}
                  {hoverIndex !== null && (
                    <>
                      <line
                        x1={getX(hoverIndex)}
                        x2={getX(hoverIndex)}
                        y1={pt}
                        y2={H - pb}
                        stroke="#fff"
                        strokeOpacity="0.35"
                        strokeDasharray="4 4"
                      />
                      <circle cx={getX(hoverIndex)} cy={getY(dailyData[hoverIndex].real)} r="5" fill="#2ee6a6" stroke="#050c1d" strokeWidth="2" />
                      <circle cx={getX(hoverIndex)} cy={getY(dailyData[hoverIndex].warn)} r="5" fill="#fbbf24" stroke="#050c1d" strokeWidth="2" />
                      <circle cx={getX(hoverIndex)} cy={getY(dailyData[hoverIndex].ai)} r="5" fill="#fb7185" stroke="#050c1d" strokeWidth="2" />
                    </>
                  )}
                </svg>

                {/* Floating Tooltip */}
                {hoverIndex !== null && (
                  <div
                    style={{
                      position: "absolute",
                      pointerEvents: "none",
                      background: "#0a1a3e",
                      border: "1px solid rgba(120,160,255,.35)",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      fontSize: "12.5px",
                      whiteSpace: "nowrap",
                      zIndex: 3,
                      left: `${Math.min(Math.max(10, (getX(hoverIndex) / W) * 100), 75)}%`,
                      top: "10px"
                    }}
                  >
                    <b>{dailyData[hoverIndex].dateStr}</b>
                    <div style={{ color: "var(--real)", marginTop: "4px" }}>● Looks real: <b>{dailyData[hoverIndex].real}</b></div>
                    <div style={{ color: "var(--warn)" }}>● Not sure: <b>{dailyData[hoverIndex].warn}</b></div>
                    <div style={{ color: "var(--ai)" }}>● Likely AI-made: <b>{dailyData[hoverIndex].ai}</b></div>
                  </div>
                )}
              </div>

              <div className="row sm muted" style={{ marginTop: "6px", display: "flex", gap: "16px" }}>
                <span style={{ color: "var(--real)" }}>● Looks real</span>
                <span style={{ color: "var(--warn)" }}>● Not sure</span>
                <span style={{ color: "var(--ai)" }}>● Likely AI-made</span>
              </div>
            </div>

            {/* Right: What we found donut chart */}
            <div className="card">
              <h2>What we found</h2>
              <p className="muted sm">Share of all your results</p>

              <div style={{ display: "grid", placeItems: "center", margin: "14px 0" }}>
                <svg viewBox="0 0 200 200" width="100%" style={{ maxWidth: "220px" }} role="img" aria-label="Share of results">
                  <circle cx="100" cy="100" r={R_DONUT} fill="none" stroke="rgba(120,160,255,.12)" strokeWidth="26" />
                  {totalCompleted > 0 ? (
                    <>
                      <circle
                        cx="100"
                        cy="100"
                        r={R_DONUT}
                        fill="none"
                        stroke="#2ee6a6"
                        strokeWidth="26"
                        strokeDasharray={`${Math.max(0, realLen - 2)} ${CIRC_DONUT}`}
                        strokeDashoffset="0"
                        transform="rotate(-90 100 100)"
                        className="transition-all duration-700 ease-out"
                      >
                        <title>Looks real: {countReal}</title>
                      </circle>
                      <circle
                        cx="100"
                        cy="100"
                        r={R_DONUT}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="26"
                        strokeDasharray={`${Math.max(0, warnLen - 2)} ${CIRC_DONUT}`}
                        strokeDashoffset={-realLen}
                        transform="rotate(-90 100 100)"
                        className="transition-all duration-700 ease-out"
                      >
                        <title>Not sure: {countWarn}</title>
                      </circle>
                      <circle
                        cx="100"
                        cy="100"
                        r={R_DONUT}
                        fill="none"
                        stroke="#fb7185"
                        strokeWidth="26"
                        strokeDasharray={`${Math.max(0, aiLen - 2)} ${CIRC_DONUT}`}
                        strokeDashoffset={-(realLen + warnLen)}
                        transform="rotate(-90 100 100)"
                        className="transition-all duration-700 ease-out"
                      >
                        <title>Likely AI-made: {countAi}</title>
                      </circle>
                    </>
                  ) : null}
                  <text x="100" y="102" textAnchor="middle" fill="#fff" fontSize="32" fontWeight="800">
                    {totalCompleted}
                  </text>
                  <text x="100" y="124" textAnchor="middle" fill="#8da0c4" fontSize="12">
                    photos
                  </text>
                </svg>
              </div>

              <div className="sm" style={{ display: "grid", gap: "8px" }}>
                <div className="row between">
                  <span style={{ color: "var(--real)" }}>● Looks real</span>
                  <b>{countReal}</b>
                </div>
                <div className="row between">
                  <span style={{ color: "var(--warn)" }}>● Not sure</span>
                  <b>{countWarn}</b>
                </div>
                <div className="row between">
                  <span style={{ color: "var(--ai)" }}>● Likely AI-made</span>
                  <b>{countAi}</b>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Busiest Cases & Which tools you use matching deepverify-app/page-home.js */}
          <section className="grid g2">
            <div className="card">
              <h2>Busiest cases</h2>
              <p className="muted sm">Which cases have the most photos</p>
              
              <div style={{ marginTop: "12px", minHeight: "220px", display: "grid", placeItems: "center" }}>
                {busiestCasesList.length > 0 ? (
                  <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img" aria-label="Bar chart">
                    {[0, 1, 2, 3].map((i) => {
                      const yy = VB_PT + (1 - i / 3) * (VB_H - VB_PT - VB_PB);
                      return (
                        <g key={i}>
                          <line x1={VB_PL} x2={VB_W} y1={yy} y2={yy} stroke="rgba(120,160,255,.14)" />
                          <text x={VB_PL - 6} y={yy + 4} textAnchor="end" fill="#8da0c4" fontSize="11">
                            {Math.round((maxBusiest / 3) * i)}
                          </text>
                        </g>
                      );
                    })}
                    {busiestCasesList.map((it, i) => {
                      const h = (it.count / maxBusiest) * (VB_H - VB_PT - VB_PB);
                      const xx = VB_PL + i * bw + bw * 0.2;
                      const label = it.name.length > 11 ? it.name.slice(0, 10) + "…" : it.name;
                      return (
                        <g key={i}>
                          <rect
                            x={xx}
                            y={VB_H - VB_PB - h}
                            width={bw * 0.6}
                            height={Math.max(4, h)}
                            rx="8"
                            fill="#38bdf8"
                          >
                            <title>{it.name}: {it.count}</title>
                          </rect>
                          <text x={xx + bw * 0.3} y={VB_H - VB_PB - h - 7} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">
                            {it.count}
                          </text>
                          <text x={xx + bw * 0.3} y={VB_H - 14} textAnchor="middle" fill="#8da0c4" fontSize="11.5">
                            {label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <div className="empty-state" style={{ padding: "30px 10px" }}>
                    <p>No cases created yet.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2>Which tools you use</h2>
              <p className="muted sm">Every scan runs two checks. The AI Helper answers your questions.</p>
              
              <div style={{ marginTop: "18px" }}>
                {/* Pixel Check */}
                <div style={{ marginBottom: "16px" }}>
                  <div className="row between sm" style={{ marginBottom: "7px" }}>
                    <span>
                      <b style={{ fontWeight: 600 }}>Pixel Check</b>
                      <span className="faint"> · looks at tiny details</span>
                    </span>
                    <b>{totalCompleted}</b>
                  </div>
                  <div className="bar">
                    <i style={{ width: totalCompleted > 0 ? "100%" : "0%", background: "linear-gradient(90deg,#38bdf8,#22d3ee)" }} />
                  </div>
                </div>

                {/* Pattern Check */}
                <div style={{ marginBottom: "16px" }}>
                  <div className="row between sm" style={{ marginBottom: "7px" }}>
                    <span>
                      <b style={{ fontWeight: 600 }}>Pattern Check</b>
                      <span className="faint"> · hunts repeating patterns</span>
                    </span>
                    <b>{totalCompleted}</b>
                  </div>
                  <div className="bar">
                    <i style={{ width: totalCompleted > 0 ? "100%" : "0%", background: "linear-gradient(90deg,#3b82f6,#38bdf8)" }} />
                  </div>
                </div>

                {/* AI Helper */}
                <div style={{ marginBottom: "16px" }}>
                  <div className="row between sm" style={{ marginBottom: "7px" }}>
                    <span>
                      <b style={{ fontWeight: 600 }}>AI Helper</b>
                      <span className="faint"> · answers your questions</span>
                    </span>
                    <b>{Math.round(totalCompleted * 0.85)}</b>
                  </div>
                  <div className="bar">
                    <i style={{ width: totalCompleted > 0 ? "85%" : "0%", background: "linear-gradient(90deg,#a78bfa,#38bdf8)" }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Latest Checks Table matching deepverify-app/page-home.js */}
          <section className="card">
            <div className="row between" style={{ marginBottom: "10px" }}>
              <div>
                <h2>Latest checks</h2>
                <p className="muted sm">Your most recent photos</p>
              </div>
              <Link to="/vault" className="btn sm">
                See all photos{" "}
                <svg className="ico" viewBox="0 0 24 24" style={{ width: 14, height: 14, marginLeft: 4 }}>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>

            {recentPhotos.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "64px" }}></th>
                    <th>Photo</th>
                    <th>Case</th>
                    <th>Checked on</th>
                    <th>Result</th>
                    <th>AI chance</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPhotos.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/investigation/${p.caseId}/evidence/${p.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ width: "64px" }}>
                        <div className="thumb" style={{ width: "52px", aspectRatio: "1", borderRadius: "10px" }}>
                          <SecureImage investigationId={p.caseId} evidenceId={p.id} alt={p.name} />
                        </div>
                      </td>
                      <td>
                        <b>{p.name}</b>
                      </td>
                      <td className="muted">{p.caseName}</td>
                      <td className="muted">
                        {fmtDate(p.createdAt)}
                        <br />
                        <span className="faint sm">{timeAgo(p.createdAt)}</span>
                      </td>
                      <td>
                        <span className={`tag ${p.verdictKey}`}>
                          {p.verdictEmoji} {p.verdictLabel}
                        </span>
                      </td>
                      <td>
                        <b>{p.status === "COMPLETED" ? `${p.ai}%` : "—"}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="emo">📸</div>
                <h3>No photos yet</h3>
                <p>Drop your first photo above to get started.</p>
              </div>
            )}
          </section>

        </div>
      </div>

      {/* Name Photo Before Analysis Dialog Modal */}
      {showNameModal && selectedFileForUpload && (
        <div className="veil" onClick={() => { setShowNameModal(false); setSelectedFileForUpload(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(120,160,255,0.15)] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#38bdf8]/15 flex items-center justify-center text-[#38bdf8]">
                  <FileImage className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Name Photo Before Scan</h3>
                  <p className="text-xs text-[#9fb0cc]">Give your photo a clean name so it is easy to identify</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowNameModal(false); setSelectedFileForUpload(null); }}
                className="text-[#6f82a6] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thumbnail preview & name input */}
            <div className="flex gap-4 items-center bg-[#050c1d] p-3 rounded-xl border border-[rgba(120,160,255,0.1)] mb-4">
              {previewUrl && (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-16 h-16 object-cover rounded-lg border border-[rgba(120,160,255,0.2)] shrink-0" 
                />
              )}
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-semibold text-[#8b9cb6] uppercase tracking-wider block mb-1">
                  Photo Name
                </label>
                <input
                  type="text"
                  value={photoName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPhotoName(val);
                    if (targetCaseId === "__new") {
                      setNewCaseName("Case: " + val);
                    }
                  }}
                  placeholder="e.g. Profile Picture, Viral Concert Photo"
                  className="w-full bg-[#0a1530] border border-[rgba(120,160,255,0.2)] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#38bdf8]"
                  autoFocus
                />
              </div>
            </div>

            {/* Target Case Selection */}
            <div className="space-y-3 mb-6">
              <label className="text-[11px] font-semibold text-[#8b9cb6] uppercase tracking-wider block mb-1">
                Investigation Destination
              </label>

              <div className="grid grid-cols-2 gap-2 bg-[#050c1d] p-1 rounded-xl border border-[rgba(120,160,255,0.15)]">
                <button
                  type="button"
                  onClick={() => setTargetCaseId("__new")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    targetCaseId === "__new"
                      ? "bg-gradient-to-r from-[#38bdf8] to-[#22d3ee] text-[#050c1d] shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                      : "text-[#8b9cb6] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>＋ Create New Case</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetCaseId(investigations[0]?.id || "")}
                  disabled={investigations.length === 0}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    targetCaseId !== "__new"
                      ? "bg-gradient-to-r from-[#38bdf8] to-[#22d3ee] text-[#050c1d] shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                      : "text-[#8b9cb6] hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  <span>Existing Case</span>
                  {investigations.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 font-mono">
                      {investigations.length}
                    </span>
                  )}
                </button>
              </div>

              {targetCaseId === "__new" ? (
                <div>
                  <label className="text-[#9fb0cc] text-xs font-semibold block mb-1">
                    New Case Title:
                  </label>
                  <input
                    type="text"
                    value={newCaseName}
                    onChange={(e) => setNewCaseName(e.target.value)}
                    placeholder="e.g. Social Media Verification, ID Card Audit"
                    className="w-full bg-[#050c20] border border-[rgba(120,160,255,0.25)] focus:border-[#38bdf8] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                  />
                  <span className="text-[11px] text-[#6f82a6] mt-1 block">
                    A dedicated new investigation case will be opened for this photo.
                  </span>
                </div>
              ) : (
                <div>
                  <label className="text-[#9fb0cc] text-xs font-semibold block mb-1">
                    Select Existing Case:
                  </label>
                  <div className="relative">
                    <select
                      value={targetCaseId}
                      onChange={(e) => setTargetCaseId(e.target.value)}
                      className="w-full bg-[#050c20] border border-[rgba(120,160,255,0.25)] focus:border-[#38bdf8] text-white text-sm rounded-xl px-3.5 py-2.5 pr-8 appearance-none outline-none cursor-pointer transition-colors"
                    >
                      {investigations.map((inv) => (
                        <option key={inv.id} value={inv.id}>{inv.title}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9fb0cc] pointer-events-none" />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="row" style={{ justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => { setShowNameModal(false); setSelectedFileForUpload(null); }}
                className="btn sm"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUpload}
                disabled={creating || !photoName.trim()}
                className="btn pri sm flex items-center gap-1.5"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Start scan →</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
