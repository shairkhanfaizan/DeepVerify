import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { fetchApi } from "../services/api";
import { SecureImage } from "../components/ui/SecureImage";
import {
  ArrowLeft,
  UploadCloud,
  GitCompare,
  FileText,
  Trash2,
  Loader2
} from "lucide-react";

interface AnalysisResult {
  ensemble_score: number;
  verdict?: string;
}

interface EvidenceItem {
  id: string;
  name?: string;
  original_filename?: string;
  status: string;
  created_at?: string;
  analysis_results?: AnalysisResult[];
  observations?: Array<{ signal_type: string; value: string }>;
}

interface InvestigationData {
  id: string;
  title: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
  evidence_items?: EvidenceItem[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(t: any): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(t: any): string {
  if (!t) return "";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDateTime(t: any): string {
  if (!t) return "—";
  const dateStr = fmtDate(t);
  const timeStr = fmtTime(t);
  return timeStr ? `${dateStr}, ${timeStr}` : dateStr;
}

function getVerdict(p: EvidenceItem) {
  if (p.status !== "COMPLETED") {
    return { key: "wait", label: "Checking…", emoji: "⏳", aiChance: 0 };
  }
  const score = p.analysis_results?.[0]?.ensemble_score ?? 0.5;
  const aiChance = Math.round((1 - score) * 100);
  if (aiChance < 35) {
    return { key: "real", label: "Looks real", emoji: "✅", aiChance };
  }
  if (aiChance < 65) {
    return { key: "warn", label: "Not sure", emoji: "🤔", aiChance };
  }
  return { key: "ai", label: "Likely AI-made", emoji: "🤖", aiChance };
}

function getCounts(items: EvidenceItem[] = []) {
  const c = { real: 0, warn: 0, ai: 0, wait: 0 };
  items.forEach((p) => {
    const v = getVerdict(p);
    c[v.key as keyof typeof c]++;
  });
  return c;
}

function getPhotoDisplayName(p: EvidenceItem): string {
  if (p.original_filename && p.original_filename.trim()) return p.original_filename.trim();
  if (p.name && p.name.trim()) return p.name.trim();
  const obs = p.observations?.find(
    (o) => o.signal_type === "ORIGINAL_FILENAME" || o.signal_type === "EVIDENCE_NAME"
  );
  if (obs && obs.value) return obs.value;
  return `Photo ${p.id ? p.id.slice(0, 8) : ""}`;
}

export function InvestigationResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [investigation, setInvestigation] = useState<InvestigationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("Notes save automatically.");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [toasts, setToasts] = useState<string[]>([]);

  const showToast = (msg: string) => {
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t !== msg));
    }, 3200);
  };

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi(`/api/v2/investigations/${id}`);
      setInvestigation(data);
      setNotes(data.notes || "");
    } catch (err: any) {
      console.error("Failed to load investigation:", err);
      setError(err.message || "Failed to load investigation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleTitleBlur = async (e: React.FocusEvent<HTMLHeadingElement>) => {
    if (!investigation || !id) return;
    const newTitle = e.currentTarget.textContent?.trim() || investigation.title;
    if (newTitle && newTitle !== investigation.title) {
      try {
        await fetchApi(`/api/v2/investigations/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: newTitle }),
        });
        setInvestigation((prev) =>
          prev ? { ...prev, title: newTitle, updated_at: new Date().toISOString() } : null
        );
        showToast("Case renamed");
      } catch (err) {
        console.error("Failed to rename case:", err);
        e.currentTarget.textContent = investigation.title;
      }
    }
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!id) return;
    const val = e.target.value;
    setNotes(val);
    setSaveStatus("Saving...");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetchApi(`/api/v2/investigations/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ notes: val }),
        });
        setInvestigation((prev) =>
          prev ? { ...prev, notes: val, updated_at: new Date().toISOString() } : null
        );
        setSaveStatus("Saved ✓");
      } catch (err) {
        console.error("Failed to auto-save notes:", err);
        setSaveStatus("Error saving note");
      }
    }, 500);
  };

  const handleDeleteCase = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await fetchApi(`/api/v2/investigations/${id}`, {
        method: "DELETE",
      });
      setShowDeleteModal(false);
      showToast("Case deleted");
      navigate("/investigations");
    } catch (err: any) {
      console.error("Failed to delete case:", err);
      showToast(err.message || "Failed to delete case");
    } finally {
      setDeleting(false);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!id || files.length === 0) return;
    try {
      setUploading(true);
      let firstAddedId = "";
      for (const f of files) {
        const formData = new FormData();
        formData.append("file", f);
        const cleanName = f.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
        formData.append("name", cleanName);

        const ev = await fetchApi(`/api/v2/investigations/${id}/evidence`, {
          method: "POST",
          body: formData,
        });

        if (ev && ev.id) {
          if (!firstAddedId) firstAddedId = ev.id;
          fetchApi(`/api/v2/investigations/${id}/evidence/${ev.id}/analyze`, {
            method: "POST",
          }).catch(console.error);
        }
      }

      showToast(
        files.length === 1
          ? "Photo added – starting the scan!"
          : `${files.length} photos added – scanning now!`
      );
      await loadData();
    } catch (err) {
      console.error("Failed to upload evidence:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      uploadFiles(files);
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-[#9fb0cc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#38bdf8] mr-3" />
        <span style={{ fontSize: "16px", fontWeight: 500 }}>Loading case info...</span>
      </div>
    );
  }

  if (error || !investigation) {
    return (
      <div className="case-page font-sans text-white p-6">
        <style>{`
          .empty-state { text-align: center; padding: 50px 20px; color: #9fb0cc; }
          .empty-state .emo { font-size: 44px; margin-bottom: 10px; }
          .card { background: rgba(14,30,70,.55); border: 1px solid rgba(120,160,255,.16); border-radius: 16px; padding: 22px; backdrop-filter: blur(6px); }
          .btn.pri { background: linear-gradient(90deg,#38bdf8,#22d3ee); color: #04122b; border: 0; box-shadow: 0 0 26px rgba(56,189,248,.35); padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 15px; display: inline-flex; align-items: center; text-decoration: none; }
        `}</style>
        <div className="card empty-state">
          <div className="emo">🤷</div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
            We couldn&apos;t find that case
          </h3>
          <p style={{ marginTop: "6px", color: "#9fb0cc" }}>
            The case may have been deleted or the link is invalid.
          </p>
          <Link to="/investigations" className="btn pri" style={{ marginTop: "14px" }}>
            Back to My Cases
          </Link>
        </div>
      </div>
    );
  }

  const ps = investigation.evidence_items || [];
  const k = getCounts(ps);
  const total = ps.length || 1;
  const done = ps.filter((p) => p.status === "COMPLETED");
  const avg = done.length
    ? Math.round(
        done.reduce((acc, p) => acc + getVerdict(p).aiChance, 0) / done.length
      )
    : 0;

  const summary = !ps.length
    ? "No photos yet – add some below."
    : k.ai > 0
    ? `${k.ai} of ${ps.length} ${ps.length === 1 ? "photo looks" : "photos look"} AI-made.`
    : k.warn > 0
    ? `${k.warn} ${k.warn === 1 ? "photo needs" : "photos need"} a closer look.`
    : "Everything here looks real. 🎉";

  return (
    <div className="case-page font-sans text-white">
      <style>{`
        :root {
          --bg: #050c1d;
          --bg2: #0a1530;
          --panel: rgba(14,30,70,.55);
          --panel2: rgba(10,22,54,.8);
          --line: rgba(120,160,255,.16);
          --line2: rgba(120,160,255,.28);
          --text: #fff;
          --muted: #9fb0cc;
          --faint: #6f82a6;
          --cyan: #22d3ee;
          --sky: #38bdf8;
          --blue: #3b82f6;
          --real: #2ee6a6;
          --warn: #fbbf24;
          --ai: #fb7185;
          --grad: linear-gradient(90deg,#38bdf8,#22d3ee);
          --r: 16px;
        }

        .case-page {
          min-height: 100vh;
          font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
          background: radial-gradient(900px 550px at 0% 0%, rgba(34,211,238,.24), rgba(56,189,248,.12) 40%, transparent 70%),
                      radial-gradient(900px 600px at 85% 0%, rgba(37,99,235,.25), transparent 65%),
                      radial-gradient(700px 500px at 0% 100%, rgba(34,211,238,.08), transparent 60%),
                      linear-gradient(180deg, #060e22, #040a18);
          background-attachment: fixed;
        }
        .case-page h1, .case-page h2, .case-page h3 {
          font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif !important;
        }

        .top {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 0 18px 0;
          background: rgba(5,12,29,.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--line);
          margin-bottom: 24px;
        }
        .crumb {
          color: var(--faint);
          font-size: 14px;
        }
        .crumb b {
          color: #fff;
          font-weight: 600;
        }
        .crumb a {
          color: var(--faint);
          text-decoration: none;
          transition: color .15s;
        }
        .crumb a:hover {
          color: #fff;
        }
        .top-r {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--real);
          letter-spacing: .4px;
        }
        .pill i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--real);
          box-shadow: 0 0 10px var(--real);
        }

        h1 {
          font-size: clamp(26px, 3.2vw, 40px);
          letter-spacing: -1.2px;
          font-weight: 800;
          line-height: 1.1;
        }
        h2 {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }
        h3 {
          font-size: 16px;
          font-weight: 600;
        }
        .grad {
          background: var(--grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .muted { color: var(--muted); }
        .faint { color: var(--faint); }
        .sm { font-size: 13px; }

        .card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--r);
          padding: 22px;
          backdrop-filter: blur(6px);
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 20px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          transition: .2s;
          border: 1px solid var(--line2);
          background: rgba(10,20,50,.5);
          color: #fff;
          cursor: pointer;
          text-decoration: none;
        }
        .btn:hover {
          border-color: var(--sky);
          background: rgba(56,130,255,.15);
        }
        .btn.pri {
          background: var(--grad);
          color: #04122b;
          border: 0;
          box-shadow: 0 0 26px rgba(56,189,248,.35);
        }
        .btn.pri:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 34px rgba(56,189,248,.55);
        }
        .btn.sm {
          padding: 8px 14px;
          font-size: 13.5px;
          border-radius: 10px;
        }
        .btn.danger {
          color: var(--ai);
          border-color: rgba(251,113,133,.4);
        }
        .btn.danger:hover {
          border-color: var(--ai);
          background: rgba(251,113,133,.12);
        }
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .between {
          justify-content: space-between;
        }
        .grid {
          display: grid;
          gap: 18px;
        }
        .g-main {
          grid-template-columns: 1.6fr 1fr;
        }
        .g4 {
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 1100px) {
          .g-main { grid-template-columns: 1fr; }
          .g4 { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 700px) {
          .g4 { grid-template-columns: 1fr; }
        }

        .field {
          display: grid;
          gap: 8px;
          margin-bottom: 16px;
        }
        .field label {
          font-size: 13.5px;
          font-weight: 600;
          color: #cdd9f2;
        }
        .field input, .field select, .field textarea {
          background: rgba(5,12,32,.7);
          border: 1px solid var(--line2);
          border-radius: 12px;
          padding: 12px 14px;
          width: 100%;
          outline: none;
          color: #fff;
          font-family: inherit;
        }
        .field input:focus, .field select:focus, .field textarea:focus {
          border-color: var(--sky);
          box-shadow: 0 0 0 3px rgba(56,189,248,.18);
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .3px;
        }
        .tag.real { background: rgba(46,230,166,.14); color: var(--real); }
        .tag.warn { background: rgba(251,191,36,.14); color: var(--warn); }
        .tag.ai { background: rgba(251,113,133,.15); color: var(--ai); }
        .tag.wait { background: rgba(159,176,204,.15); color: var(--muted); }

        .mix {
          display: flex;
          height: 8px;
          border-radius: 99px;
          overflow: hidden;
          background: rgba(80,120,200,.2);
        }
        .mix i {
          display: block;
          height: 100%;
          transition: width .8s;
        }

        .drop {
          border: 2px dashed rgba(56,189,248,.5);
          border-radius: 18px;
          padding: 30px;
          text-align: center;
          transition: .25s;
          cursor: pointer;
          background: rgba(5,12,32,.5);
        }
        .drop:hover, .drop.over {
          border-color: var(--cyan);
          background: rgba(34,211,238,.08);
          transform: scale(1.01);
        }

        .thumb {
          position: relative;
          aspect-ratio: 4/3;
          border-radius: 14px;
          overflow: hidden;
          background: #0b1630;
          border: 1px solid var(--line);
        }
        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .thumb .tg {
          position: absolute;
          left: 10px;
          top: 10px;
          z-index: 2;
        }

        .photo {
          cursor: pointer;
          transition: .25s;
        }
        .photo:hover {
          transform: translateY(-4px);
        }
        .photo:hover .thumb {
          border-color: var(--sky);
          box-shadow: 0 10px 30px rgba(37,99,235,.35);
        }
        .photo .meta {
          padding: 10px 4px 0;
        }
        .photo .meta b {
          display: block;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .photo .meta small {
          color: var(--faint);
          font-size: 12.5px;
        }

        .veil {
          position: fixed;
          inset: 0;
          background: rgba(2,6,16,.7);
          backdrop-filter: blur(6px);
          display: grid;
          place-items: center;
          z-index: 50;
          animation: fade .2s;
        }
        .modal {
          width: min(520px, 92vw);
          background: #0a1530;
          border: 1px solid var(--line2);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 20px 80px rgba(0,0,0,.6);
          animation: pop .25s;
        }

        @keyframes fade { from { opacity: 0; } }
        @keyframes pop { from { opacity: 0; transform: scale(.96) translateY(8px); } }
        @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .stagger > * {
          animation: rise .5s cubic-bezier(.2,.8,.2,1) both;
        }
        .stagger > *:nth-child(2) { animation-delay: .06s; }
        .stagger > *:nth-child(3) { animation-delay: .12s; }
        .stagger > *:nth-child(4) { animation-delay: .18s; }
        .stagger > *:nth-child(5) { animation-delay: .24s; }

        .toasts {
          position: fixed;
          right: 24px;
          bottom: 24px;
          display: grid;
          gap: 10px;
          z-index: 60;
        }
        .toast {
          background: #0a1a3e;
          border: 1px solid var(--line2);
          border-left: 4px solid var(--cyan);
          padding: 14px 18px;
          border-radius: 12px;
          font-size: 14px;
          box-shadow: 0 10px 40px rgba(0,0,0,.5);
          animation: pop .25s;
          color: #fff;
        }
      `}</style>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      {/* Top Sticky Bar */}
      <div className="top">
        <div className="crumb">
          <Link to="/investigations" className="muted">My Cases</Link> &rsaquo; <b>{investigation.title}</b>
        </div>
        <div className="top-r">
          <span className="pill"><i></i> Scanner ready</span>
          <button
            className="btn pri sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <UploadCloud className="w-4 h-4 mr-1 inline" /> Check a photo
          </button>
        </div>
      </div>

      <div className="stagger" style={{ display: "grid", gap: "22px", paddingBottom: "60px" }}>

        {/* Back Link */}
        <Link to="/investigations" className="muted sm row" style={{ gap: "6px", textDecoration: "none" }}>
          <ArrowLeft className="w-4 h-4 inline" /> All cases
        </Link>

        {/* Case Title & Actions Row */}
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <h1
              contentEditable
              suppressContentEditableWarning
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLElement).blur())}
              style={{
                outline: "none",
                borderBottom: "1px dashed transparent",
                cursor: "text"
              }}
              title="Click to rename"
            >
              {investigation.title}
            </h1>
            <p className="faint sm" style={{ marginTop: "10px" }}>
              Started {fmtDate(investigation.created_at)} &middot; Last updated {fmtDateTime(investigation.updated_at)}
            </p>
          </div>

          <div className="row">
            <Link to={`/investigation/${id}/compare`} className="btn">
              <GitCompare className="w-4 h-4 mr-1 inline" /> Compare photos
            </Link>
            <Link to={`/investigation/${id}/report`} className="btn">
              <FileText className="w-4 h-4 mr-1 inline" /> Make report
            </Link>
            <button className="btn danger" id="del" onClick={() => setShowDeleteModal(true)}>
              <Trash2 className="w-4 h-4 mr-1 inline" /> Delete case
            </button>
          </div>
        </div>

        {/* 2-column Grid: Notes (Left) & Case Summary (Right) */}
        <div className="grid g-main">
          {/* Notes Card */}
          <div className="card">
            <h3>What are you trying to find out?</h3>
            <textarea
              id="cnote"
              rows={3}
              value={notes}
              onChange={handleNotesChange}
              style={{
                width: "100%",
                marginTop: "10px",
                background: "rgba(5,12,32,.7)",
                border: "1px solid var(--line2)",
                borderRadius: "12px",
                padding: "12px",
                resize: "vertical",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "14px",
                outline: "none"
              }}
              placeholder="Write a note to your future self…"
            />
            <small className="faint" id="saved" style={{ display: "block", marginTop: "6px" }}>
              {saveStatus}
            </small>
          </div>

          {/* Summary Card */}
          <div className="card">
            <h3>Case summary</h3>
            <p style={{ margin: "10px 0 14px", fontSize: "17px", fontWeight: 600 }}>
              {summary}
            </p>
            <div className="mix" role="img" aria-label={`${k.real} real, ${k.warn} unsure, ${k.ai} AI-made`}>
              <i style={{ width: `${(k.real / total) * 100}%`, background: "var(--real)" }}></i>
              <i style={{ width: `${(k.warn / total) * 100}%`, background: "var(--warn)" }}></i>
              <i style={{ width: `${(k.ai / total) * 100}%`, background: "var(--ai)" }}></i>
            </div>
            <div className="row sm muted" style={{ marginTop: "12px", gap: "16px" }}>
              <span style={{ color: "var(--real)" }}>● {k.real} real</span>
              <span style={{ color: "var(--warn)" }}>● {k.warn} unsure</span>
              <span style={{ color: "var(--ai)" }}>● {k.ai} AI</span>
            </div>
            {done.length > 0 && (
              <p className="sm muted" style={{ marginTop: "12px" }}>
                Average AI chance: <b style={{ color: "#fff" }}>{avg}%</b>
              </p>
            )}
          </div>
        </div>

        {/* Photos Card */}
        <div className="card">
          <div className="row between" style={{ marginBottom: "16px" }}>
            <h2>
              Photos in this case{" "}
              <span className="faint" style={{ fontWeight: 500 }}>({ps.length})</span>
            </h2>
            <button
              className="btn pri sm"
              id="add"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <UploadCloud className="w-4 h-4 mr-1 inline" /> {uploading ? "Uploading..." : "Add photos"}
            </button>
          </div>

          {/* Dropzone */}
          <div
            className={`drop ${isDragging ? "over" : ""}`}
            id="cdrop"
            style={{
              marginBottom: ps.length ? "20px" : "0px",
              padding: ps.length ? "18px" : "40px"
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <p className="muted">
              {ps.length ? (
                "Drop more photos here to add them"
              ) : (
                <>
                  <b style={{ color: "#fff", display: "block", marginBottom: "4px" }}>
                    Drop your first photo here
                  </b>
                  <span className="sm">We&apos;ll scan it the moment it lands</span>
                </>
              )}
            </p>
          </div>

          {/* Photo Grid */}
          {ps.length > 0 && (
            <div className="grid g4" id="pg">
              {ps.map((p) => {
                const v = getVerdict(p);
                const displayName = getPhotoDisplayName(p);
                return (
                  <div
                    key={p.id}
                    className="photo"
                    data-id={p.id}
                    onClick={() => navigate(`/investigation/${id}/evidence/${p.id}`)}
                  >
                    <div className="thumb">
                      <SecureImage
                        investigationId={id}
                        evidenceId={p.id}
                        type="download"
                        className="w-full h-full object-cover"
                      />
                      <span className={`tg tag ${v.key}`}>
                        {v.emoji} {v.label}
                      </span>
                    </div>
                    <div className="meta">
                      <b>{displayName}</b>
                      <small>
                        {fmtDate(p.created_at)}
                        {p.status === "COMPLETED" ? ` · ${v.aiChance}% AI` : ""}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="veil" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Delete this case?</h2>
            <p className="muted" style={{ margin: "10px 0 22px", fontSize: "14px", lineHeight: "1.5" }}>
              &ldquo;{investigation.title}&rdquo; and its {ps.length} {ps.length === 1 ? "photo" : "photos"} will be removed. This can&apos;t be undone.
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: "12px" }}>
              <button className="btn" data-x onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Keep it
              </button>
              <button className="btn danger" data-y onClick={handleDeleteCase} disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="toasts">
        {toasts.map((t, i) => (
          <div key={i} className="toast">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
