import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchApi } from "../services/api";
import { SecureImage } from "../components/ui/SecureImage";
import {
  Search,
  UploadCloud,
  Loader2,
  Plus,
  Trash2
} from "lucide-react";

interface AnalysisResult {
  ensemble_score: number;
  verdict: string;
}

interface EvidenceItem {
  id: string;
  status: string;
  name?: string;
  original_filename?: string;
  analysis_results?: AnalysisResult[];
  observations?: Array<{ signal_type: string; value: string }>;
}

interface InvestigationItem {
  id: string;
  title: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
  evidence_items?: EvidenceItem[];
}

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(t: any): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

function timeAgo(t: any): string {
  if (!t) return "just now";
  const s = Math.max(1, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

function getCounts(items: EvidenceItem[] = []) {
  const c = { real: 0, warn: 0, ai: 0, wait: 0 };
  items.forEach((p) => {
    if (p.status !== "COMPLETED") {
      c.wait++;
      return;
    }
    const score = p.analysis_results?.[0]?.ensemble_score ?? 0.5;
    const aiChance = Math.round((1 - score) * 100);
    if (aiChance < 35) c.real++;
    else if (aiChance < 65) c.warn++;
    else c.ai++;
  });
  return c;
}

export function Investigations() {
  const navigate = useNavigate();

  const [investigations, setInvestigations] = useState<InvestigationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "ai" | "empty">("all");
  const [sort, setSort] = useState<"updated" | "created" | "name">("updated");

  // Create Case Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);

  // Topbar Check a photo upload flow
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadPhotoName, setUploadPhotoName] = useState<string>("");
  const [caseMode, setCaseMode] = useState<"new" | "existing">("new");
  const [uploadNewCaseName, setUploadNewCaseName] = useState<string>("");
  const [uploadTargetCaseId, setUploadTargetCaseId] = useState<string>("");
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadingAndScanning, setUploadingAndScanning] = useState<boolean>(false);
  // Delete Case state
  const [caseToDelete, setCaseToDelete] = useState<InvestigationItem | null>(null);
  const [showDeleteCaseModal, setShowDeleteCaseModal] = useState<boolean>(false);
  const [deletingCase, setDeletingCase] = useState<boolean>(false);

  const handleDeleteCase = async () => {
    if (!caseToDelete) return;
    try {
      setDeletingCase(true);
      await fetchApi(`/api/v2/investigations/${caseToDelete.id}`, {
        method: "DELETE"
      });
      setInvestigations((prev) => prev.filter((c) => c.id !== caseToDelete.id));
      setShowDeleteCaseModal(false);
      setCaseToDelete(null);
      showToast("Case deleted");
    } catch (err: any) {
      console.error("Failed to delete case:", err);
      showToast(err.message || "Failed to delete case");
    } finally {
      setDeletingCase(false);
    }
  };

  const [toasts, setToasts] = useState<string[]>([]);
  const showToast = (msg: string) => {
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t !== msg));
    }, 3200);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchApi("/api/v2/investigations/");
      if (Array.isArray(data)) {
        const detailedPromises = data.map((inv: any) =>
          fetchApi(`/api/v2/investigations/${inv.id}`).catch(() => inv)
        );
        const detailed = await Promise.all(detailedPromises);
        setInvestigations(detailed.filter(Boolean));
        if (detailed.length > 0 && !uploadTargetCaseId) {
          setUploadTargetCaseId(detailed[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load investigations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreating(true);
      const invData = await fetchApi("/api/v2/investigations/", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
        }),
      });
      if (invData && invData.id) {
        setShowCreateModal(false);
        navigate(`/investigation/${invData.id}`);
      }
    } catch (err) {
      console.error("Failed to create case:", err);
    } finally {
      setCreating(false);
    }
  };

  // Topbar Photo Upload
  const handleTopCheckPhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileForUpload(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
    setUploadPhotoName(cleanName);

    const todayStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    setUploadNewCaseName(`Case · ${cleanName || todayStr}`);

    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);
    setShowUploadModal(true);
    e.target.value = "";
  };

  const handleConfirmUploadAndScan = async () => {
    if (!selectedFileForUpload) return;
    try {
      setUploadingAndScanning(true);
      let targetId = uploadTargetCaseId;

      if (caseMode === "new") {
        const caseTitle = uploadNewCaseName.trim() || `Case: ${uploadPhotoName.trim() || "Untitled"}`;
        const newCase = await fetchApi("/api/v2/investigations/", {
          method: "POST",
          body: JSON.stringify({ title: caseTitle })
        });
        targetId = newCase.id;
      }

      if (!targetId) throw new Error("No target case selected");

      const formData = new FormData();
      formData.append("file", selectedFileForUpload);
      if (uploadPhotoName.trim()) {
        formData.append("name", uploadPhotoName.trim());
      }

      const evidenceItem = await fetchApi(`/api/v2/investigations/${targetId}/evidence`, {
        method: "POST",
        body: formData
      });

      fetchApi(`/api/v2/investigations/${targetId}/evidence/${evidenceItem.id}/analyze`, {
        method: "POST"
      }).catch(console.error);

      setShowUploadModal(false);
      navigate(`/investigation/${targetId}/evidence/${evidenceItem.id}`);
    } catch (err: any) {
      console.error("Failed to upload evidence:", err);
    } finally {
      setUploadingAndScanning(false);
    }
  };

  // Filtering & Sorting
  let filteredCases = investigations.filter((c) =>
    (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filter === "ai") {
    filteredCases = filteredCases.filter((c) => getCounts(c.evidence_items || []).ai > 0);
  } else if (filter === "empty") {
    filteredCases = filteredCases.filter((c) => !(c.evidence_items?.length));
  }

  filteredCases.sort((a, b) => {
    if (sort === "name") {
      return (a.title || "").localeCompare(b.title || "");
    }
    if (sort === "created") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="cases-page font-sans text-white">
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

        .cases-page {
          min-height: 100vh;
          font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .cases-page h1, .cases-page h2, .cases-page h3 {
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
          font-size: clamp(30px, 3.4vw, 44px);
          letter-spacing: -1.2px;
          font-weight: 800;
          line-height: 1.1;
        }
        h2 {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }
        .grad {
          background: var(--grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .lead {
          color: var(--muted);
          font-size: 17px;
          line-height: 1.5;
          margin-top: 10px;
          max-width: 640px;
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

        .chip {
          padding: 8px 14px;
          border-radius: 99px;
          font-size: 13.5px;
          font-weight: 500;
          border: 1px solid var(--line2);
          color: #c4d2ee;
          transition: .2s;
          cursor: pointer;
          background: none;
        }
        .chip:hover {
          border-color: var(--sky);
        }
        .chip.on {
          background: rgba(56,189,248,.2);
          border-color: var(--sky);
          color: #fff;
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
        .search {
          position: relative;
          flex: 1;
          min-width: 220px;
        }
        .search svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          stroke: var(--faint);
          fill: none;
          stroke-width: 2;
        }
        .search input {
          background: rgba(5,12,32,.7);
          border: 1px solid var(--line2);
          border-radius: 12px;
          padding: 12px 14px 12px 42px;
          width: 100%;
          outline: none;
          color: #fff;
          font-family: inherit;
        }
        .search input:focus {
          border-color: var(--sky);
          box-shadow: 0 0 0 3px rgba(56,189,248,.18);
        }

        .grid {
          display: grid;
          gap: 18px;
        }
        .g3 {
          grid-template-columns: repeat(3, 1fr);
        }
        @media (max-width: 1100px) {
          .g3 { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 700px) {
          .g3 { grid-template-columns: 1fr; }
        }

        .case {
          cursor: pointer;
          transition: .25s;
        }
        .case:hover {
          transform: translateY(-4px);
          border-color: var(--sky);
          box-shadow: 0 12px 34px rgba(37,99,235,.28);
        }
        .strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin: 14px 0;
        }
        .strip .thumb {
          aspect-ratio: 1;
          border-radius: 9px;
          overflow: hidden;
          background: #0b1630;
          border: 1px solid var(--line);
        }
        .strip .empty {
          aspect-ratio: 1;
          border-radius: 9px;
          border: 1px dashed var(--line2);
          display: grid;
          place-items: center;
          color: var(--faint);
          font-size: 18px;
        }
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

        .empty-state {
          text-align: center;
          padding: 50px 20px;
          color: var(--muted);
        }
        .empty-state .emo {
          font-size: 44px;
          margin-bottom: 10px;
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
        .field small {
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

        @keyframes rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stagger > * {
          animation: rise .5s cubic-bezier(.2,.8,.2,1) both;
        }
        .stagger > *:nth-child(2) { animation-delay: .06s; }
        .stagger > *:nth-child(3) { animation-delay: .12s; }
      `}</style>

      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/bmp"
        className="hidden"
        style={{ display: "none" }}
        onChange={handleFilePicked}
      />

      {/* Sticky Topbar */}
      <div className="top">
        <div className="crumb">
          DeepVerify &rsaquo; <b>My Cases</b>
        </div>
        <div className="top-r">
          <span className="pill"><i></i> Scanner ready</span>
          <button className="btn pri sm" onClick={handleTopCheckPhotoClick}>
            <UploadCloud className="w-4 h-4 mr-1 inline" /> Check a photo
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="stagger" style={{ display: "grid", gap: "22px", paddingBottom: "60px" }}>
        
        {/* Title and New Case Header */}
        <div className="row between">
          <div>
            <h1>My <span className="grad">Cases</span></h1>
            <p className="lead">
              A case is a folder for photos you want to check together – like &ldquo;Fake news hunt&rdquo; or &ldquo;Is this profile real?&rdquo;
            </p>
          </div>
          <button className="btn pri" id="nc" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1 inline" /> New case
          </button>
        </div>

        {/* Filter, Search, and Sort Row */}
        <div className="row">
          <div className="search">
            <Search className="ico" />
            <input
              id="q"
              placeholder="Search your cases…"
              aria-label="Search cases"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="row" id="flt">
            <button
              className={`chip ${filter === "all" ? "on" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={`chip ${filter === "ai" ? "on" : ""}`}
              onClick={() => setFilter("ai")}
            >
              Has AI-made photos
            </button>
            <button
              className={`chip ${filter === "empty" ? "on" : ""}`}
              onClick={() => setFilter("empty")}
            >
              Empty
            </button>
          </div>

          <select
            id="srt"
            className="chip"
            style={{ background: "rgba(5,12,32,.7)", color: "#fff", outline: "none" }}
            aria-label="Sort cases"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
          >
            <option value="updated">Recently updated</option>
            <option value="created">Newest first</option>
            <option value="name">A → Z</option>
          </select>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mr-3" />
            <span>Loading cases...</span>
          </div>
        ) : filteredCases.length > 0 ? (
          <div id="list" className="grid g3">
            {filteredCases.map((c) => {
              const ps = c.evidence_items || [];
              const k = getCounts(ps);
              const total = ps.length || 1;

              return (
                <article
                  key={c.id}
                  className="card case"
                  tabIndex={0}
                  onClick={() => navigate(`/investigation/${c.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/investigation/${c.id}`)}
                >
                  <div className="row between">
                    <h2 style={{ fontSize: "18px" }}>{c.title || "Untitled Case"}</h2>
                    <div className="row" style={{ gap: "8px" }}>
                      {k.ai > 0 ? (
                        <span className="tag ai">🤖 {k.ai} AI</span>
                      ) : ps.length > 0 ? (
                        <span className="tag real">✅ All clear</span>
                      ) : (
                        <span className="tag wait">Empty</span>
                      )}
                      <button
                        type="button"
                        className="btn sm danger"
                        style={{ padding: "4px 8px", fontSize: "12px", border: "1px solid rgba(251,113,133,.3)" }}
                        title="Delete case"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaseToDelete(c);
                          setShowDeleteCaseModal(true);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </div>
                  </div>

                  <div className="strip">
                    {[0, 1, 2, 3].map((i) => {
                      const item = ps[i];
                      if (item) {
                        return (
                          <div key={item.id} className="thumb">
                            <SecureImage
                              investigationId={c.id}
                              evidenceId={item.id}
                              type="download"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="empty">
                          {i === 0 && !ps.length ? "＋" : ""}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mix" role="img" aria-label={`${k.real} real, ${k.warn} unsure, ${k.ai} AI-made`}>
                    <i style={{ width: `${(k.real / total) * 100}%`, background: "var(--real)" }}></i>
                    <i style={{ width: `${(k.warn / total) * 100}%`, background: "var(--warn)" }}></i>
                    <i style={{ width: `${(k.ai / total) * 100}%`, background: "var(--ai)" }}></i>
                  </div>

                  <div className="row between sm" style={{ marginTop: "12px" }}>
                    <span className="muted">
                      {ps.length} {ps.length === 1 ? "photo" : "photos"}
                    </span>
                    <span className="faint">Updated {timeAgo(c.updated_at)}</span>
                  </div>

                  <div className="faint sm" style={{ marginTop: "4px" }}>
                    Started {fmtDate(c.created_at)}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card empty-state" style={{ gridColumn: "1/-1" }}>
            <div className="emo">🕵️</div>
            <h3>{searchQuery || filter !== "all" ? "No cases match" : "No cases yet"}</h3>
            <p>
              {searchQuery || filter !== "all"
                ? "Try a different search or filter."
                : "Create your first case to start investigating."}
            </p>
          </div>
        )}

      </div>

      {/* New Case Creation Modal */}
      {showCreateModal && (
        <div
          className="veil"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <h2>Start a new case</h2>
            <p className="muted sm" style={{ margin: "6px 0 18px" }}>
              A case keeps related photos together – like &ldquo;Fake news hunt&rdquo; or &ldquo;Is this profile real?&rdquo;
            </p>
            <form onSubmit={handleCreateCase}>
              <div className="field">
                <label>Case name</label>
                <input
                  id="nc-name"
                  maxLength={60}
                  placeholder="e.g. Viral photo from the group chat"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="row" style={{ justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn pri"
                  disabled={creating || !newTitle.trim()}
                >
                  {creating ? "Creating..." : "Create case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pre-Analysis Photo Upload & Assignment Modal */}
      {showUploadModal && (
        <div
          className="veil"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUploadModal(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" style={{ width: "min(560px, 92vw)" }}>
            <h2>Where should this photo go?</h2>
            <p className="muted sm" style={{ margin: "6px 0 18px" }}>
              Cases are like folders. Pick one or start a new one.
            </p>

            {previewUrl && (
              <div className="row" style={{ marginBottom: "16px", gap: "14px" }}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid var(--line)",
                    background: "#0b1630",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Photo name</label>
                    <input
                      type="text"
                      value={uploadPhotoName}
                      onChange={(e) => setUploadPhotoName(e.target.value)}
                      placeholder="e.g. Street portrait"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="field">
              <label>Choose a case</label>
              <select
                value={caseMode === "new" ? "__new" : uploadTargetCaseId}
                onChange={(e) => {
                  if (e.target.value === "__new") {
                    setCaseMode("new");
                  } else {
                    setCaseMode("existing");
                    setUploadTargetCaseId(e.target.value);
                  }
                }}
              >
                {investigations.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.title || "Untitled Case"}
                  </option>
                ))}
                <option value="__new">＋ Start a new case…</option>
              </select>
            </div>

            {caseMode === "new" && (
              <div className="field">
                <label>Name your new case</label>
                <input
                  value={uploadNewCaseName}
                  onChange={(e) => setUploadNewCaseName(e.target.value)}
                  placeholder="e.g. Is this photo fake?"
                  maxLength={60}
                />
              </div>
            )}

            <div className="row" style={{ justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowUploadModal(false)}
                disabled={uploadingAndScanning}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn pri"
                onClick={handleConfirmUploadAndScan}
                disabled={uploadingAndScanning}
              >
                {uploadingAndScanning ? "Starting scan..." : "Start scan →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Case Confirmation Modal */}
      {showDeleteCaseModal && caseToDelete && (
        <div className="veil" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteCaseModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Delete this case?</h2>
            <p className="muted" style={{ margin: "10px 0 22px", fontSize: "14px", lineHeight: "1.5" }}>
              &ldquo;{caseToDelete.title || "Untitled Case"}&rdquo; and its {(caseToDelete.evidence_items || []).length} photos will be removed. This can&apos;t be undone.
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: "12px" }}>
              <button className="btn" onClick={() => setShowDeleteCaseModal(false)} disabled={deletingCase}>
                Keep it
              </button>
              <button className="btn danger" onClick={handleDeleteCase} disabled={deletingCase}>
                {deletingCase ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
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
