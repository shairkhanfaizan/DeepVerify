import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchApi } from "../services/api";
import { SecureImage } from "../components/ui/SecureImage";
import {
  Search,
  Upload,
  Check,
  Download,
  GitCompare,
  X
} from "lucide-react";

interface FlattenedEvidence {
  evidenceId: string;
  investigationId: string;
  investigationTitle: string;
  originalFilename: string;
  createdAt: string;
  size?: number;
  mimeType?: string;
  ensembleScore: number | null;
  status: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(t: any): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getVerdict(p: FlattenedEvidence) {
  if (p.status !== "COMPLETED") {
    return { key: "wait", emoji: "⏳", label: "Scanning", color: "var(--muted)" };
  }
  const aiScore = p.ensembleScore !== null ? Math.round(p.ensembleScore * 100) : 50;
  if (aiScore <= 40) {
    return { key: "real", emoji: "✅", label: "Looks real", color: "var(--real)" };
  }
  if (aiScore <= 65) {
    return { key: "warn", emoji: "🤔", label: "Not sure", color: "var(--warn)" };
  }
  return { key: "ai", emoji: "🤖", label: "Likely AI-made", color: "var(--ai)" };
}

export function Vault() {
  const navigate = useNavigate();

  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Controls (Date filter preserved as requested)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [caseFilter, setCaseFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [sortOrder, setSortOrder] = useState<"new" | "old" | "ai" | "real">("new");
  const [verdictFilter, setVerdictFilter] = useState<"all" | "real" | "warn" | "ai">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Upload Flow: Select case first, then pick file
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadCaseSelection, setUploadCaseSelection] = useState<string>("");
  const [newCaseTitle, setNewCaseTitle] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [pendingTargetCaseId, setPendingTargetCaseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchApi("/api/v2/investigations/");
      setInvestigations(data || []);
      if (data && data.length > 0 && !uploadCaseSelection) {
        setUploadCaseSelection(data[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load vault:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Flatten all photos from all investigations
  const allPhotos: FlattenedEvidence[] = [];
  for (const inv of investigations) {
    if (!inv.evidence_items) continue;
    for (const ev of inv.evidence_items) {
      const firstResult = ev.analysis_results?.[0];
      allPhotos.push({
        evidenceId: ev.id,
        investigationId: inv.id,
        investigationTitle: inv.title || "Untitled Case",
        originalFilename: ev.original_filename || "Photo",
        createdAt: ev.created_at || inv.created_at,
        size: ev.size,
        mimeType: ev.mime_type,
        ensembleScore: firstResult ? firstResult.ensemble_score : null,
        status: ev.status
      });
    }
  }

  // Count summaries for stat cards (Matching Screenshot 4)
  const counts = {
    total: allPhotos.length,
    real: allPhotos.filter(p => getVerdict(p).key === "real").length,
    warn: allPhotos.filter(p => getVerdict(p).key === "warn").length,
    ai: allPhotos.filter(p => getVerdict(p).key === "ai").length
  };

  // Filter & Sort
  const filteredPhotos = allPhotos.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchName = p.originalFilename.toLowerCase().includes(q);
      const matchCase = p.investigationTitle.toLowerCase().includes(q);
      if (!matchName && !matchCase) return false;
    }

    if (caseFilter !== "all" && p.investigationId !== caseFilter) {
      return false;
    }

    const v = getVerdict(p);
    if (verdictFilter !== "all" && v.key !== verdictFilter) {
      return false;
    }

    // Date Filter logic (preserved per user request)
    if (dateFilter !== "all" && p.createdAt) {
      const createdDate = new Date(p.createdAt).getTime();
      const now = Date.now();
      if (dateFilter === "today" && now - createdDate > 86400000) return false;
      if (dateFilter === "week" && now - createdDate > 7 * 86400000) return false;
      if (dateFilter === "month" && now - createdDate > 30 * 86400000) return false;
    }

    return true;
  });

  filteredPhotos.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    const scoreA = a.ensembleScore !== null ? a.ensembleScore : 0.5;
    const scoreB = b.ensembleScore !== null ? b.ensembleScore : 0.5;

    if (sortOrder === "new") return timeB - timeA;
    if (sortOrder === "old") return timeA - timeB;
    if (sortOrder === "ai") return scoreB - scoreA;
    if (sortOrder === "real") return scoreA - scoreB;
    return 0;
  });

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCompareSelected = () => {
    if (selectedIds.size !== 2) return;
    const [a, b] = Array.from(selectedIds);
    navigate(`/compare?a=${a}&b=${b}`);
  };

  const handleExportCsv = () => {
    const exportItems = selectedIds.size > 0
      ? allPhotos.filter(p => selectedIds.has(p.evidenceId))
      : filteredPhotos;

    if (exportItems.length === 0) return;

    const rows = [
      ["Photo", "Case", "Added", "Result", "AI chance %"],
      ...exportItems.map(p => {
        const v = getVerdict(p);
        const aiPct = p.ensembleScore !== null ? Math.round(p.ensembleScore * 100) : "—";
        return [
          p.originalFilename,
          p.investigationTitle,
          fmtDate(p.createdAt),
          v.label,
          aiPct
        ];
      })
    ];

    const csvContent = rows.map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-photos.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("List downloaded ✓");
  };

  // Upload Flow: Stage 1 = Open Case Select Modal
  const handleOpenUploadFlow = () => {
    if (investigations.length > 0) {
      setUploadCaseSelection(investigations[0].id);
    } else {
      setUploadCaseSelection("__new");
    }
    setNewCaseTitle("");
    setShowUploadModal(true);
  };

  // Upload Flow: Stage 2 = Case confirmed, now trigger file picker
  const handleConfirmCaseAndPickFile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let targetCaseId = uploadCaseSelection;
      if (targetCaseId === "__new") {
        if (!newCaseTitle.trim()) {
          return;
        }
        setIsUploading(true);
        const createdInv = await fetchApi("/api/v2/investigations/", {
          method: "POST",
          body: JSON.stringify({
            title: newCaseTitle.trim() || "New Investigation",
          })
        });
        targetCaseId = createdInv.id;
        setInvestigations(prev => [createdInv, ...prev]);
        setIsUploading(false);
      }
      setPendingTargetCaseId(targetCaseId);
      setShowUploadModal(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        fileInputRef.current.click();
      }
    } catch (err: any) {
      console.error("Error creating investigation:", err);
      setIsUploading(false);
      showToast("Failed to create case: " + (err.message || "Unknown error"));
    }
  };

  // Upload Flow: Stage 3 = File picked, execute upload
  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const targetCaseId = pendingTargetCaseId || uploadCaseSelection;
    if (!targetCaseId) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const evData = await fetchApi(`/api/v2/investigations/${targetCaseId}/evidence`, {
        method: "POST",
        body: formData
      });

      // Kick off background analysis immediately
      fetchApi(`/api/v2/investigations/${targetCaseId}/evidence/${evData.id}/analyze`, {
        method: "POST"
      }).catch(console.error);

      showToast("Photo added – opening scan!");
      navigate(`/investigation/${targetCaseId}/evidence/${evData.id}`);
    } catch (err: any) {
      console.error("Upload failed:", err);
      showToast("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setIsUploading(false);
      setPendingTargetCaseId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ minHeight: "100%" }}>
      {/* Hidden file input triggered after case selection */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilePicked}
        accept="image/*"
        style={{ display: "none" }}
      />

      {/* 1. Fixed Top Header (Matches Screenshot 4 & deepverify-app Exactly) */}
      <div className="top">
        <div className="crumb">
          <b>Media Vault</b>
        </div>
        <div className="top-r">
          <span className="pill">
            <i />Scanner ready
          </span>
          <button
            onClick={handleOpenUploadFlow}
            className="btn pri sm"
          >
            <Upload className="w-3.5 h-3.5 mr-1 inline" /> Check a photo
          </button>
        </div>
      </div>

      <div id="view">
        <div className="stagger" style={{ display: "grid", gap: "22px" }}>
          
          {/* Header Row */}
          <div className="row between">
            <div>
              <h1>Media <span className="grad">Vault</span></h1>
              <p className="lead">
                Every photo you've checked, all in one place. Search, sort and pick the ones you want.
              </p>
            </div>
            <button className="btn pri" id="vu" onClick={handleOpenUploadFlow}>
              <Upload className="w-4 h-4 mr-1.5 inline" /> Check a new photo
            </button>
          </div>

          {/* 4 Stat Cards (Matches Screenshot 4 Exactly: bold white numbers) */}
        <div className="grid g4">
          <div className="card stat" style={{ padding: "18px" }}>
            <div className="ic" style={{ background: "rgba(56,189,248,.12)" }}>🖼️</div>
            <div className="l">All photos</div>
            <div className="n" style={{ fontSize: "32px" }}>{loading ? "…" : counts.total}</div>
          </div>
          <div className="card stat" style={{ padding: "18px" }}>
            <div className="ic" style={{ background: "rgba(46,230,166,.12)" }}>✅</div>
            <div className="l">Looks real</div>
            <div className="n" style={{ fontSize: "32px" }}>{loading ? "…" : counts.real}</div>
          </div>
          <div className="card stat" style={{ padding: "18px" }}>
            <div className="ic" style={{ background: "rgba(251,191,36,.12)" }}>🤔</div>
            <div className="l">Not sure</div>
            <div className="n" style={{ fontSize: "32px" }}>{loading ? "…" : counts.warn}</div>
          </div>
          <div className="card stat" style={{ padding: "18px" }}>
            <div className="ic" style={{ background: "rgba(251,113,133,.12)" }}>🤖</div>
            <div className="l">Likely AI-made</div>
            <div className="n" style={{ fontSize: "32px" }}>{loading ? "…" : counts.ai}</div>
          </div>
        </div>

        {/* Main Vault Panel (Card) */}
        <div className="card">
          
          {/* Row 1: Search and Dropdowns (Includes the preserved Date Filter) */}
          <div className="row" style={{ marginBottom: "14px" }}>
            <div className="search">
              <Search className="w-4 h-4" />
              <input
                id="q"
                placeholder="Search photos by name…"
                aria-label="Search photos"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter by case */}
            <select
              id="cf"
              className="chip"
              style={{ background: "rgba(5,12,32,.7)" }}
              aria-label="Filter by case"
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value)}
            >
              <option value="all">All cases</option>
              {investigations.map((inv: any) => (
                <option key={inv.id} value={inv.id}>
                  {inv.title}
                </option>
              ))}
            </select>

            {/* Filter by date - Preserved per user request */}
            <select
              id="df"
              className="chip"
              style={{ background: "rgba(5,12,32,.7)" }}
              aria-label="Filter by date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
            >
              <option value="all">All dates</option>
              <option value="today">Added today</option>
              <option value="week">Past 7 days</option>
              <option value="month">Past 30 days</option>
            </select>

            {/* Sort photos */}
            <select
              id="srt"
              className="chip"
              style={{ background: "rgba(5,12,32,.7)" }}
              aria-label="Sort photos"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
            >
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
              <option value="ai">Most AI-like first</option>
              <option value="real">Most real first</option>
            </select>
          </div>

          {/* Row 2: Verdict Filter Chips & Action Controls */}
          <div className="row between" style={{ marginBottom: "16px" }}>
            <div className="row" id="flt">
              {[
                { k: "all", l: "All" },
                { k: "real", l: "✅ Looks real" },
                { k: "warn", l: "🤔 Not sure" },
                { k: "ai", l: "🤖 AI-made" }
              ].map(({ k, l }) => (
                <button
                  key={k}
                  className={`chip ${verdictFilter === k ? "on" : ""}`}
                  onClick={() => setVerdictFilter(k as any)}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="row">
              <span className="muted sm" id="cnt">
                Showing {filteredPhotos.length} of {allPhotos.length}
                {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}
              </span>
              <button
                className="btn sm"
                id="cmp"
                disabled={selectedIds.size !== 2}
                onClick={handleCompareSelected}
                title="Select exactly 2 photos to compare head-to-head"
              >
                <GitCompare className="w-3.5 h-3.5 mr-1.5 inline" /> Compare 2
              </button>
              <button
                className="btn sm"
                id="exp"
                disabled={filteredPhotos.length === 0}
                onClick={handleExportCsv}
                title="Download CSV list of photos"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 inline" /> Download list
              </button>
            </div>
          </div>

          {/* Photos 4-column Grid (Matches Screenshot 4) */}
          <div id="g" className="grid g4">
            {filteredPhotos.length > 0 ? (
              filteredPhotos.map((p) => {
                const v = getVerdict(p);
                const aiPct = p.ensembleScore !== null ? Math.round(p.ensembleScore * 100) : 50;
                const isSelected = selectedIds.has(p.evidenceId);

                return (
                  <div
                    key={p.evidenceId}
                    className={`photo ${isSelected ? "sel" : ""}`}
                    onClick={() => {
                      navigate(`/investigation/${p.investigationId}/evidence/${p.evidenceId}`);
                    }}
                  >
                    <div className="thumb">
                      <SecureImage
                        investigationId={p.investigationId}
                        evidenceId={p.evidenceId}
                        type="download"
                      />
                      <span className={`tg tag ${v.key}`}>
                        {v.emoji} {v.label}
                      </span>
                      <div
                        className="chk"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(p.evidenceId);
                        }}
                      >
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#04122b]" strokeWidth={3} />
                        )}
                      </div>
                    </div>
                    <div className="meta">
                      <b>{p.originalFilename}</b>
                      <small>{fmtDate(p.createdAt)} · {aiPct}% AI</small>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                <div className="emo">🔍</div>
                <h3>No photos match</h3>
                <p>Try changing the search or filters.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>

      {/* Case-First Upload Modal (Matches Reference Flow) */}
      {showUploadModal && (
        <div className="veil" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ marginBottom: "6px" }}>
              <h2>Where should this photo go?</h2>
              <button className="btn sm" onClick={() => setShowUploadModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="muted sm" style={{ margin: "6px 0 18px" }}>
              Cases are like folders. Pick one or start a new one.
            </p>

            <form onSubmit={handleConfirmCaseAndPickFile}>
              <div className="field">
                <label>Choose a case</label>
                <select
                  value={uploadCaseSelection}
                  onChange={(e) => setUploadCaseSelection(e.target.value)}
                >
                  {investigations.map((inv: any) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.title}
                    </option>
                  ))}
                  <option value="__new">＋ Start a new case…</option>
                </select>
              </div>

              {uploadCaseSelection === "__new" && (
                <div className="field">
                  <label>Name your new case</label>
                  <input
                    placeholder="e.g. Is this photo fake?"
                    maxLength={60}
                    value={newCaseTitle}
                    onChange={(e) => setNewCaseTitle(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <div className="row" style={{ justifyContent: "flex-end", marginTop: "20px" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn pri"
                  disabled={isUploading}
                >
                  {isUploading ? "Uploading…" : "Choose photos →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast popup */}
      {toastMessage && (
        <div className="toasts">
          <div className="toast">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
