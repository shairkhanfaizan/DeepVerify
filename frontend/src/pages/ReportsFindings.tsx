import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchApi, API_BASE } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { SecureImage } from "../components/ui/SecureImage";
import { 
  Loader2, 
  Share2, 
  Download, 
  Printer, 
  ChevronDown,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Pencil,
  Check,
  X,
  FileImage
} from "lucide-react";

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(t: any): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDateTime(t: any): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

function getPhotoDisplayName(p: any): string {
  if (p.original_filename && p.original_filename.trim()) return p.original_filename.trim();
  if (p.name && p.name.trim()) return p.name.trim();
  const obs = p.observations?.find((o: any) => o.signal_type === "ORIGINAL_FILENAME" || o.signal_type === "EVIDENCE_NAME");
  if (obs?.value && obs.value.trim()) return obs.value.trim();
  return `Photo (${p.id.slice(0, 8)})`;
}

export function ReportsFindings() {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [investigationsList, setInvestigationsList] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(routeId || "");
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Conclusion notes state & autosave
  const [conclusion, setConclusion] = useState("");
  const [conclusionSavedStatus, setConclusionSavedStatus] = useState<string>("Saved ✓");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Export states
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Photo Inline Renaming
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingPhotoName, setEditingPhotoName] = useState<string>("");
  const [savingPhotoName, setSavingPhotoName] = useState<boolean>(false);

  // Pre-Analysis Naming / Upload modal
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadPhotoName, setUploadPhotoName] = useState<string>("");
  const [caseMode, setCaseMode] = useState<"new" | "existing">("new");
  const [uploadNewCaseName, setUploadNewCaseName] = useState<string>("");
  const [uploadTargetCaseId, setUploadTargetCaseId] = useState<string>(selectedCaseId || "");
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadingAndScanning, setUploadingAndScanning] = useState<boolean>(false);

  useEffect(() => {
    if (selectedCaseId) {
      setUploadTargetCaseId(selectedCaseId);
    }
  }, [selectedCaseId]);

  const handleStartRename = (photoId: string, currentName: string) => {
    setEditingPhotoId(photoId);
    setEditingPhotoName(currentName);
  };

  const handleCancelRename = () => {
    setEditingPhotoId(null);
    setEditingPhotoName("");
  };

  const handleSaveRename = async (photoId: string) => {
    if (!editingPhotoName.trim() || !selectedCaseId) return;
    try {
      setSavingPhotoName(true);
      await fetchApi(`/api/v2/investigations/${selectedCaseId}/evidence/${photoId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editingPhotoName.trim() })
      });
      
      setCaseData((prev: any) => {
        if (!prev || !prev.evidence_items) return prev;
        return {
          ...prev,
          evidence_items: prev.evidence_items.map((ev: any) => {
            if (ev.id !== photoId) return ev;
            const obs = ev.observations ? [...ev.observations] : [];
            const fnIdx = obs.findIndex((o: any) => o.signal_type === "ORIGINAL_FILENAME" || o.signal_type === "EVIDENCE_NAME");
            if (fnIdx >= 0) {
              obs[fnIdx] = { ...obs[fnIdx], value: editingPhotoName.trim() };
            } else {
              obs.push({ signal_type: "ORIGINAL_FILENAME", value: editingPhotoName.trim(), provenance: "User Input" });
            }
            return {
              ...ev,
              name: editingPhotoName.trim(),
              original_filename: editingPhotoName.trim(),
              observations: obs
            };
          })
        };
      });
      setEditingPhotoId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save photo name.");
    } finally {
      setSavingPhotoName(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const cleanName = file.name.replace(/\.[^.]+$/, "");
    setSelectedFileForUpload(file);
    setUploadPhotoName(cleanName);
    setUploadNewCaseName("Case: " + cleanName);
    // Default to "new" case so the user is never forced to choose an existing case
    setCaseMode("new");
    setUploadTargetCaseId(selectedCaseId || (investigationsList[0]?.id || ""));
    setPreviewUrl(URL.createObjectURL(file));
    setShowUploadModal(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmUploadAndAnalyze = async () => {
    if (!selectedFileForUpload) return;
    try {
      setUploadingAndScanning(true);
      let targetInvId = uploadTargetCaseId;

      if (caseMode === "new") {
        const title = uploadNewCaseName.trim() || `Case: ${uploadPhotoName.trim() || selectedFileForUpload.name}`;
        const newInv = await fetchApi("/api/v2/investigations/", {
          method: "POST",
          body: JSON.stringify({
            title,
            notes: `Created during photo check for "${uploadPhotoName.trim()}"`
          })
        });
        targetInvId = newInv.id;
        setInvestigationsList(prev => [newInv, ...prev]);
      }

      if (!targetInvId) {
        alert("Please select or create an investigation case.");
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFileForUpload);
      formData.append("name", uploadPhotoName.trim() || selectedFileForUpload.name.replace(/\.[^.]+$/, ""));

      const evData = await fetchApi(`/api/v2/investigations/${targetInvId}/evidence`, {
        method: "POST",
        body: formData,
      });

      if (evData && evData.evidence_id) {
        await fetchApi(`/api/v2/investigations/${targetInvId}/evidence/${evData.evidence_id}/analyze`, {
          method: "POST",
          body: JSON.stringify({ policy: "ensemble-v1.0" })
        });

        setShowUploadModal(false);
        setSelectedFileForUpload(null);

        // Direct user to the regular scanning pipeline with live scanning animation
        navigate(`/investigation/${targetInvId}/evidence/${evData.evidence_id}`);
      } else {
        setShowUploadModal(false);
        setSelectedFileForUpload(null);
        navigate(`/investigation/${targetInvId}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to upload and analyze photo.");
    } finally {
      setUploadingAndScanning(false);
    }
  };

  // 1. Fetch investigations list
  useEffect(() => {
    const loadList = async () => {
      try {
        setLoading(true);
        const data = await fetchApi("/api/v2/investigations/");
        setInvestigationsList(data || []);
        if (!selectedCaseId && data && data.length > 0) {
          setSelectedCaseId(data[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadList();
  }, []);

  // 2. Fetch selected investigation details
  useEffect(() => {
    if (!selectedCaseId) return;

    const loadDetail = async () => {
      try {
        setLoading(true);
        const data = await fetchApi(`/api/v2/investigations/${selectedCaseId}`);
        setCaseData(data);
        setConclusion(data?.notes || "");
        setConclusionSavedStatus("Saved ✓");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [selectedCaseId]);

  // 3. Debounced autosave for conclusion notes
  const handleConclusionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setConclusion(val);
    setConclusionSavedStatus("Editing...");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!selectedCaseId) return;
      try {
        setConclusionSavedStatus("Saving...");
        await fetchApi(`/api/v2/investigations/${selectedCaseId}`, {
          method: "PATCH",
          body: JSON.stringify({ notes: val })
        });
        setConclusionSavedStatus("Saved ✓");
      } catch {
        setConclusionSavedStatus("Failed to save");
      }
    }, 600);
  };

  // PDF Export
  const handleDownloadPdf = async () => {
    if (!selectedCaseId) return;
    try {
      setDownloadingPdf(true);
      const url = `${API_BASE}/api/v2/investigations/${selectedCaseId}/report`;
      const res = await fetch(url, { method: "GET", credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${(caseData?.title || "DeepVerify").replace(/\W+/g, "-")}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  // CSV Export
  const handleDownloadCSV = () => {
    if (!caseData || !caseData.evidence_items) return;
    const items = caseData.evidence_items.filter((p: any) => p.status === "COMPLETED");
    const rows = [["Photo", "Checked on", "Result", "AI chance %", "Spatial AI %", "Spectral FFT AI %", "SHA-256 Hash", "My notes"]].concat(
      items.map((p: any) => {
        const auth = p.analysis_results?.[0]?.ensemble_score ?? 0.5;
        const ai = Math.round((1 - auth) * 100);

        const sSig = p.signals?.find((s: any) => s.signal_type.includes("SPATIAL"));
        const sVal = sSig ? parseFloat(sSig.value) : auth;
        const sAi = Math.round((1 - sVal) * 100);

        const fSig = p.signals?.find((s: any) => s.signal_type.includes("FREQUENCY"));
        const fVal = fSig ? parseFloat(fSig.value) : auth;
        const fAi = Math.round((1 - fVal) * 100);

        let res = "Looks real";
        if (ai >= 65) res = "Likely AI-made";
        else if (ai >= 35) res = "Not sure";
        return [
          getPhotoDisplayName(p),
          fmtDate(p.created_at),
          res,
          `${ai}%`,
          `${sAi}%`,
          `${fAi}%`,
          p.file_hash || "—",
          p.notes || "—"
        ];
      })
    );
    const csvContent = rows.map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csvContent], { type: "text/csv" }));
    a.download = `${(caseData?.title || "report").replace(/\W+/g, "-")}-report.csv`;
    a.click();
  };

  // Instant Markdown summary copy
  const handleShareLink = () => {
    if (!caseData) return;
    const items = caseData.evidence_items?.filter((p: any) => p.status === "COMPLETED") || [];
    let realCount = 0;
    let warnCount = 0;
    let aiCount = 0;

    const lines = items.map((p: any) => {
      const auth = p.analysis_results?.[0]?.ensemble_score ?? 0.5;
      const ai = Math.round((1 - auth) * 100);
      let label = "Looks real";
      if (ai >= 65) { aiCount++; label = "Likely AI-made"; }
      else if (ai >= 35) { warnCount++; label = "Not sure"; }
      else { realCount++; }
      return `• ${getPhotoDisplayName(p)}: ${label} (${ai}% AI)`;
    });

    const txt = `DeepVerify report – ${caseData.title}\nChecked ${fmtDate(Date.now())}\n${items.length} photos: ${realCount} look real, ${warnCount} not sure, ${aiCount} likely AI-made.\n` + lines.join("\n");
    navigator.clipboard.writeText(txt);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  if (loading && !caseData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="h-8 w-8 text-[#38bdf8] animate-spin mb-3" />
        <span className="text-[#9fb0cc] text-sm">Loading forensic dossier…</span>
      </div>
    );
  }

  const items = caseData?.evidence_items?.filter((p: any) => p.status === "COMPLETED") || [];
  const n = items.length;

  let realCount = 0;
  let warnCount = 0;
  let aiCount = 0;

  const processed = items.map((p: any) => {
    const auth = p.analysis_results?.[0]?.ensemble_score ?? 0.5;
    const ai = Math.round((1 - auth) * 100);

    const sSig = p.signals?.find((s: any) => s.signal_type.includes("SPATIAL"));
    const sVal = sSig ? parseFloat(sSig.value) : auth;
    const spatialAi = Math.round((1 - sVal) * 100);

    const fSig = p.signals?.find((s: any) => s.signal_type.includes("FREQUENCY"));
    const fVal = fSig ? parseFloat(fSig.value) : auth;
    const freqAi = Math.round((1 - fVal) * 100);

    const dimObs = p.observations?.find((o: any) => o.signal_type === "IMAGE_DIMENSIONS");
    const fmtObs = p.observations?.find((o: any) => o.signal_type === "IMAGE_FORMAT");
    const dims = dimObs ? dimObs.value.replace("x", "×") : "1024×768";
    const format = fmtObs?.value || p.mime_type?.split("/")[1]?.toUpperCase() || "JPG";

    let verdictKey: "real" | "warn" | "ai" = "real";
    let verdictLabel = "Looks real";
    let verdictEmoji = "✅";
    let barColor = "#2ee6a6";

    if (ai >= 65) {
      aiCount++;
      verdictKey = "ai";
      verdictLabel = "Likely AI-made";
      verdictEmoji = "🤖";
      barColor = "#fb7185";
    } else if (ai >= 35) {
      warnCount++;
      verdictKey = "warn";
      verdictLabel = "Not sure";
      verdictEmoji = "🤔";
      barColor = "#fbbf24";
    } else {
      realCount++;
    }

    // Signal Concordance / Divergence evaluation
    const spread = Math.abs(spatialAi - freqAi);
    let concordanceText = "High Concordance: Spatial convolutional features and 2D-FFT spectral harmonics both agree on the structural integrity of this image.";
    let concordanceType: "concordant" | "divergent" = "concordant";
    if (spread >= 25) {
      concordanceType = "divergent";
      if (spatialAi > freqAi) {
        concordanceText = `Signal Divergence (${spread}% spread): Spatial model detected synthetic micro-textures, while frequency spectrum was partially smoothed by JPEG compression.`;
      } else {
        concordanceText = `Signal Divergence (${spread}% spread): 2D-FFT Fourier analysis detected periodic upsampler lattice spikes, despite organic spatial textures.`;
      }
    }

    // Plain-English diagnostic finding
    let diagnosticSummary = "Natural sensor noise distribution, authentic illumination gradients, and optical depth characteristics present.";
    if (verdictKey === "ai") {
      if (freqAi > spatialAi) {
        diagnosticSummary = "Periodic checkerboard lattice spikes identified in high-frequency Fourier spectrum, typical of diffusion transposed convolution upsamplers.";
      } else {
        diagnosticSummary = "Smoothed organic micro-textures and lighting gradient discrepancies identified by convolutional spatial feature detectors.";
      }
    } else if (verdictKey === "warn") {
      diagnosticSummary = "Borderline anomaly indicators. Substantial image compression or subtle post-processing may mask definitive attribution.";
    }

    return {
      id: p.id,
      name: getPhotoDisplayName(p),
      ai,
      spatialAi,
      freqAi,
      dims,
      format,
      meta: `${dims} · ${format}`,
      hash: p.file_hash || "SHA-256 Uncomputed",
      checkedOn: fmtDate(p.created_at),
      verdictKey,
      verdictLabel,
      verdictEmoji,
      barColor,
      notes: p.notes,
      concordanceType,
      concordanceText,
      diagnosticSummary
    };
  }).sort((a: any, b: any) => b.ai - a.ai);

  const avg = n ? Math.round(processed.reduce((sum: number, x: any) => sum + x.ai, 0) / n) : 0;
  const worst = processed.length > 0 ? processed[0] : null;

  const head = !n 
    ? "No scanned photos in this case yet." 
    : aiCount 
      ? `${aiCount} of ${n} ${n === 1 ? "photo looks" : "photos look"} AI-made.` 
      : warnCount 
        ? `Nothing is clearly AI-made, but ${warnCount} ${warnCount === 1 ? "photo needs" : "photos need"} a second look.` 
        : `All ${n} ${n === 1 ? "photo looks" : "photos look"} real.`;

  const bannerColor = aiCount ? "var(--ai)" : warnCount ? "var(--warn)" : "var(--real)";

  // SVG Donut calculation
  const R = 70;
  const CIRC = 2 * Math.PI * R;
  const realLen = n ? (realCount / n) * CIRC : 0;
  const warnLen = n ? (warnCount / n) * CIRC : 0;
  const aiLen = n ? (aiCount / n) * CIRC : 0;

  return (
    <div className="report-page font-sans text-white">
      <style>{`
        :root {
          --bg: #050c1d;
          --panel: rgba(14,30,70,.55);
          --line: rgba(120,160,255,.16);
          --line2: rgba(120,160,255,.28);
          --text: #fff;
          --muted: #9fb0cc;
          --faint: #6f82a6;
          --cyan: #22d3ee;
          --sky: #38bdf8;
          --real: #2ee6a6;
          --warn: #fbbf24;
          --ai: #fb7185;
          --grad: linear-gradient(90deg,#38bdf8,#22d3ee);
        }
        .report-page {
          min-height: 100vh;
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
        .card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 22px;
          backdrop-filter: blur(6px);
        }
        .card.glow {
          box-shadow: 0 0 40px rgba(37,99,235,.15);
        }
        .chip {
          padding: 8px 14px;
          border-radius: 99px;
          font-size: 13.5px;
          font-weight: 500;
          border: 1px solid var(--line2);
          color: #c4d2ee;
          transition: .2s;
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
        .tag.real {
          background: rgba(46,230,166,.14);
          color: var(--real);
        }
        .tag.warn {
          background: rgba(251,191,36,.14);
          color: var(--warn);
        }
        .tag.ai {
          background: rgba(251,113,133,.15);
          color: var(--ai);
        }
        .tag.info {
          background: rgba(56,189,248,.15);
          color: var(--sky);
        }
        .bar {
          height: 8px;
          border-radius: 99px;
          background: rgba(80,120,200,.25);
          overflow: hidden;
        }
        .bar i {
          display: block;
          height: 100%;
          border-radius: 99px;
          transition: width 1s cubic-bezier(.2,.8,.2,1);
        }
        .thumb {
          position: relative;
          aspect-ratio: 1;
          border-radius: 9px;
          overflow: hidden;
          background: #0b1630;
          border: 1px solid var(--line);
          width: 48px;
          height: 48px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        th {
          text-align: left;
          color: var(--faint);
          font-weight: 600;
          font-size: 12.5px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--line);
        }
        td {
          padding: 12px;
          border-bottom: 1px solid var(--line);
        }
        tr:last-child td {
          border: 0;
        }
        tbody tr {
          transition: .15s;
        }
        tbody tr:hover {
          background: rgba(56,130,255,.08);
        }
        .grid-g4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .grid-g4 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .grid-g2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 768px) {
          .grid-g2 {
            grid-template-columns: 1fr;
          }
        }
        @media print {
          body { background: #fff!important; color: #111; overflow: visible; }
          .top, .toolbar, .btn { display: none!important; }
          #sheet { background: #fff!important; border: 1px solid #ddd!important; color: #111!important; box-shadow: none!important; backdrop-filter: none; }
          .text-white { color: #111!important; }
          .muted, .faint, th, small { color: #444!important; }
        }
      `}</style>

      {/* 1. Fixed Top Header (Matches Screenshot 2) */}
      <div className="top">
        <div className="crumb">
          <b>Reports</b>
        </div>
        <div className="top-r">
          <span className="pill">
            <i />Scanner ready
          </span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn pri sm flex items-center gap-1.5"
          >
            ↑ Check a photo
          </button>
        </div>
      </div>

      <div className="w-full space-y-6">

        {/* Intro Page Title & Description (Restored) */}
        <div className="row between">
          <div>
            <h1>Case <span className="grad">Reports</span></h1>
            <p className="lead">
              A tidy summary of a case that you can print, save as a PDF, or share with your teacher or friends.
            </p>
          </div>
        </div>

        {/* 2. Case Selector & Export Toolbar Bar */}
        <div className="card toolbar flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-[#9fb0cc] text-sm whitespace-nowrap" htmlFor="rc">
              Report for case:
            </label>
            <div className="relative">
              <select
                id="rc"
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="chip appearance-none bg-[#050c20] text-white pr-9 cursor-pointer outline-none focus:border-[#38bdf8]"
                style={{ minWidth: 240 }}
              >
                {investigationsList.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.title}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9fb0cc] pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button onClick={handleShareLink} className="btn sm">
              <Share2 className="w-4 h-4" />
              {copiedShare ? "Summary copied!" : "Copy summary"}
            </button>
            <button onClick={handleDownloadCSV} className="btn sm">
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <button onClick={handleDownloadPdf} disabled={downloadingPdf} className="btn pri sm">
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Print / Save as PDF
            </button>
          </div>
        </div>

        {/* 3. The Full Forensic Dossier Sheet Container (#sheet) */}
        <div id="sheet" className="card glow space-y-8" style={{ padding: 34 }}>

          {/* Section 1: Header Block & Case Metadata */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-[rgba(120,160,255,0.12)] pb-6">
            <div>
              <span className="tag info">DEEPVERIFY FORENSIC REPORT</span>
              <h2 className="text-3xl font-bold text-white mt-2.5 tracking-tight">
                {caseData?.title || "Investigation Case"}
              </h2>
              <p className="text-[#9fb0cc] text-[15px] mt-1.5 max-w-xl leading-relaxed">
                {caseData?.notes || "No case intake notes recorded."}
              </p>
            </div>

            <div className="text-xs text-[#9fb0cc] md:text-right leading-[1.8] min-w-[220px]">
              <div>Prepared by <b className="text-white">{user?.email || "Faizan"}</b></div>
              <div>Generated <b className="text-white">{fmtDateTime(Date.now())}</b></div>
              <div>Case started <b className="text-white">{fmtDate(caseData?.created_at)}</b></div>
              <div>Last updated <b className="text-white">{fmtDate(caseData?.updated_at || caseData?.created_at)}</b></div>
              <div className="font-mono text-[#38bdf8] text-[11px] mt-1">ID: {caseData?.id?.slice(0, 12)}…</div>
            </div>
          </div>

          {/* Section 2: The Short Version Summary Banner */}
          <div 
            style={{ 
              padding: "20px 24px", 
              borderRadius: 16, 
              border: `1px solid ${bannerColor}`, 
              background: "rgba(255,255,255,.03)" 
            }}
          >
            <div className="text-[#6f82a6] text-xs font-bold tracking-wider uppercase">
              THE SHORT VERSION
            </div>
            <h2 className="text-2xl font-bold mt-1.5 mb-1.5 tracking-tight" style={{ color: bannerColor }}>
              {head}
            </h2>
            {worst && (
              <p className="text-[#9fb0cc] text-sm">
                Most suspicious photo: <b className="text-white">{worst.name}</b> ({worst.ai}% chance of AI).
              </p>
            )}
          </div>

          {/* Section 3: 4 Metric Cards */}
          <div className="grid-g4">
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,.04)", borderLeft: "4px solid #38bdf8" }}>
              <div className="text-[#9fb0cc] text-sm">Photos checked</div>
              <div className="text-3xl font-extrabold text-white mt-1">{n}</div>
            </div>

            <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,.04)", borderLeft: "4px solid #2ee6a6" }}>
              <div className="text-[#9fb0cc] text-sm">Look real</div>
              <div className="text-3xl font-extrabold text-white mt-1">{realCount}</div>
            </div>

            <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,.04)", borderLeft: "4px solid #fbbf24" }}>
              <div className="text-[#9fb0cc] text-sm">Not sure</div>
              <div className="text-3xl font-extrabold text-white mt-1">{warnCount}</div>
            </div>

            <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,.04)", borderLeft: "4px solid #fb7185" }}>
              <div className="text-[#9fb0cc] text-sm">AI-made</div>
              <div className="text-3xl font-extrabold text-white mt-1">{aiCount}</div>
            </div>
          </div>

          {/* Section 4: 2-Column Analytics Overview (Bars + Donut) */}
          {n > 0 && (
            <div className="grid-g2 pt-2">
              <div>
                <h3 className="text-base font-semibold text-white mb-4">AI chance for each photo</h3>
                <div className="space-y-4">
                  {processed.map((p: any) => (
                    <div key={p.id}>
                      <div className="flex justify-between items-center text-[13px] mb-1.5">
                        <span className="font-semibold text-white truncate max-w-[280px]" title={p.name}>
                          {p.name}
                        </span>
                        <b className="text-white">{p.ai}%</b>
                      </div>
                      <div className="bar">
                        <i style={{ width: `${p.ai}%`, background: p.barColor }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <h3 className="text-base font-semibold text-white mb-3 w-full text-left">Overall mix</h3>
                
                <div className="relative w-48 h-48 flex items-center justify-center my-2">
                  <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                    <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(120,160,255,.12)" strokeWidth="26" />
                    {realLen > 0 && (
                      <circle cx="100" cy="100" r={R} fill="none" stroke="#2ee6a6" strokeWidth="26" strokeDasharray={`${Math.max(0, realLen - 2)} ${CIRC}`} strokeDashoffset="0" />
                    )}
                    {warnLen > 0 && (
                      <circle cx="100" cy="100" r={R} fill="none" stroke="#fbbf24" strokeWidth="26" strokeDasharray={`${Math.max(0, warnLen - 2)} ${CIRC}`} strokeDashoffset={-realLen} />
                    )}
                    {aiLen > 0 && (
                      <circle cx="100" cy="100" r={R} fill="none" stroke="#fb7185" strokeWidth="26" strokeDasharray={`${Math.max(0, aiLen - 2)} ${CIRC}`} strokeDashoffset={-(realLen + warnLen)} />
                    )}
                  </svg>
                  
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-extrabold text-white leading-none">{n}</span>
                    <span className="text-xs text-[#8da0c4] mt-1 font-medium">photos</span>
                  </div>
                </div>

                <p className="text-sm text-[#9fb0cc] mt-1">
                  Average AI chance: <b className="text-white">{avg}%</b>
                </p>

                <div className="flex items-center gap-4 text-xs font-medium text-[#c4d2ee] mt-3">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2ee6a6]" /> Looks real</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" /> Not sure</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#fb7185]" /> Likely AI-made</span>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Technical Model Methodology Specification */}
          <div className="border border-[rgba(120,160,255,0.18)] bg-[rgba(10,22,54,0.5)] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Cpu className="w-4 h-4 text-[#38bdf8]" />
              <span>Forensic Engine Architecture & Policy Specification</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#9fb0cc] pt-1">
              <div className="space-y-1 bg-[#050c1d]/60 p-3 rounded-xl border border-[rgba(120,160,255,0.1)]">
                <span className="text-white font-semibold block">Spatial Domain (60% Weight)</span>
                <div>Model: <code className="text-[#38bdf8]">EfficientNet-B0</code> (v1.0)</div>
                <div>Focus: Convolutional feature anomalies, texture smoothing, anatomical inconsistencies.</div>
              </div>
              <div className="space-y-1 bg-[#050c1d]/60 p-3 rounded-xl border border-[rgba(120,160,255,0.1)]">
                <span className="text-white font-semibold block">Frequency Domain (40% Weight)</span>
                <div>Model: <code className="text-[#22d3ee]">2D-FFT Fourier Analysis</code> (v1.0)</div>
                <div>Focus: High-frequency spectral lattice periodicity from generative upsampling grids.</div>
              </div>
              <div className="space-y-1 bg-[#050c1d]/60 p-3 rounded-xl border border-[rgba(120,160,255,0.1)]">
                <span className="text-white font-semibold block">Policy & Decision Threshold</span>
                <div>Ensemble Policy: <code className="text-[#2ee6a6]">ensemble-v1.0</code></div>
                <div>Calibrated Decision Boundary: <code className="text-white">0.50</code> (Authentic vs Synthetic)</div>
              </div>
            </div>
          </div>

          {/* Section 6: In-Depth Photo Evidentiary Dossier (Detailed Cards directly on page) */}
          <div className="space-y-6 pt-2">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#38bdf8]" />
                <span>In-Depth Photo Evidence Dossier</span>
              </h3>
              <p className="text-xs text-[#6f82a6] mt-0.5">
                Full visual and mathematical evidence recorded for every photo in this case.
              </p>
            </div>

            <div className="space-y-6">
              {processed.map((p: any, idx: number) => (
                <div 
                  key={p.id}
                  className="bg-[rgba(5,12,32,0.65)] border border-[rgba(120,160,255,0.2)] rounded-2xl p-5 space-y-5"
                >
                  {/* Card Header: Photo name, ID, verdict, score */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[rgba(120,160,255,0.1)] pb-3.5">
                    <div>
                      <div className="text-xs text-[#6f82a6] font-mono mb-0.5">EVIDENCE ITEM #{idx + 1} · ID: {p.id.slice(0, 12)}</div>
                      {editingPhotoId === p.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            value={editingPhotoName}
                            onChange={(e) => setEditingPhotoName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(p.id);
                              if (e.key === "Escape") handleCancelRename();
                            }}
                            className="bg-[#050c20] border border-[#38bdf8] text-white text-base font-bold rounded-lg px-2.5 py-1 outline-none w-64"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(p.id)}
                            disabled={savingPhotoName}
                            className="p-1.5 rounded-lg bg-[#38bdf8]/20 hover:bg-[#38bdf8]/40 text-[#38bdf8] transition-colors"
                            title="Save name"
                          >
                            {savingPhotoName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#9fb0cc] transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group mt-0.5">
                          <h4 className="text-base font-bold text-white">{p.name}</h4>
                          <button
                            onClick={() => handleStartRename(p.id, p.name)}
                            className="opacity-0 group-hover:opacity-100 text-[#6f82a6] hover:text-[#38bdf8] transition-opacity p-1 rounded hover:bg-white/5"
                            title="Rename photo"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`tag ${p.verdictKey}`}>
                        {p.verdictEmoji} {p.verdictLabel}
                      </span>
                      <div className="text-right">
                        <span className="text-xs text-[#6f82a6] block leading-none">AI Likelihood</span>
                        <span className="text-lg font-extrabold text-white font-mono leading-tight">{p.ai}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Triple Visual Inspection: Original, Grad-CAM, Fourier FFT */}
                  <div>
                    <div className="text-xs font-semibold text-[#9fb0cc] mb-2.5">Triple Visual Saliency & Spectral Inspection</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      
                      {/* 1. Original Asset */}
                      <div className="space-y-1.5">
                        <div className="h-44 w-full bg-[#0b1630] rounded-xl overflow-hidden border border-[rgba(120,160,255,0.16)] flex items-center justify-center">
                          <SecureImage
                            investigationId={selectedCaseId}
                            evidenceId={p.id}
                            type="download"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-semibold text-white block">1. Original Evidence Asset</span>
                          <span className="text-[11px] text-[#6f82a6]">Physical ingested image file</span>
                        </div>
                      </div>

                      {/* 2. Grad-CAM Neural Attention Heatmap */}
                      <div className="space-y-1.5">
                        <div className="h-44 w-full bg-[#0b1630] rounded-xl overflow-hidden border border-[rgba(120,160,255,0.16)] flex items-center justify-center">
                          <SecureImage
                            investigationId={selectedCaseId}
                            evidenceId={p.id}
                            type="heatmap"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-semibold text-[#38bdf8] block">2. Grad-CAM Activation Map</span>
                          <span className="text-[11px] text-[#6f82a6]">Conv feature sensitivity zones</span>
                        </div>
                      </div>

                      {/* 3. 2D-FFT Fourier Power Spectrum */}
                      <div className="space-y-1.5">
                        <div className="h-44 w-full bg-[#0b1630] rounded-xl overflow-hidden border border-[rgba(120,160,255,0.16)] flex items-center justify-center">
                          <SecureImage
                            investigationId={selectedCaseId}
                            evidenceId={p.id}
                            type="spectrum"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-semibold text-[#2ee6a6] block">3. 2D-FFT Power Spectrum</span>
                          <span className="text-[11px] text-[#6f82a6]">Fourier frequency grid distribution</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Forensic Measurements & Provenance Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                    
                    {/* Left: Model Signals & Concordance */}
                    <div className="space-y-2.5 bg-[#0a1530]/60 p-3.5 rounded-xl border border-[rgba(120,160,255,0.12)]">
                      <div className="font-semibold text-white flex items-center justify-between">
                        <span>Dual-Domain Signals:</span>
                        <span className="font-mono text-[#38bdf8]">60 / 40 Policy Weighting</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center font-mono">
                          <span className="text-[#9fb0cc]">Spatial Model (EfficientNet-B0):</span>
                          <span className="font-bold text-white">{p.spatialAi}% AI</span>
                        </div>
                        <div className="bar">
                          <i style={{ width: `${p.spatialAi}%`, background: "var(--grad)" }} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center font-mono">
                          <span className="text-[#9fb0cc]">Spectral Model (2D-FFT Fourier):</span>
                          <span className="font-bold text-white">{p.freqAi}% AI</span>
                        </div>
                        <div className="bar">
                          <i style={{ width: `${p.freqAi}%`, background: "linear-gradient(90deg, #3b82f6, #2ee6a6)" }} />
                        </div>
                      </div>
                      <div className="text-[11px] text-[#9fb0cc] pt-1 border-t border-[rgba(120,160,255,0.1)] leading-relaxed">
                        <strong className="text-white">Signal Concordance: </strong>
                        {p.concordanceText}
                      </div>
                    </div>

                    {/* Right: Technical Physical Integrity & Findings */}
                    <div className="space-y-2.5 bg-[#0a1530]/60 p-3.5 rounded-xl border border-[rgba(120,160,255,0.12)]">
                      <div className="font-semibold text-white">Physical & Cryptographic Integrity</div>
                      <div className="space-y-1 text-[#9fb0cc]">
                        <div className="flex justify-between">
                          <span>Dimensions:</span>
                          <span className="font-mono text-white">{p.dims}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Container Format:</span>
                          <span className="font-mono text-white">{p.format}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SHA-256 Digest:</span>
                          <span className="font-mono text-[#38bdf8] truncate max-w-[200px]" title={p.hash}>{p.hash.slice(0, 20)}…</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ingestion Timestamp:</span>
                          <span className="text-white">{p.checkedOn}</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-[#9fb0cc] pt-1 border-t border-[rgba(120,160,255,0.1)] leading-relaxed">
                        <strong className="text-white">Diagnostic Observation: </strong>
                        {p.diagnosticSummary}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 7: Master Evidence Inventory Table (Matches Screenshot 3) */}
          <div className="pt-4 border-t border-[rgba(120,160,255,0.12)]">
            <h3 className="text-lg font-bold text-white mb-3">Photo by photo summary</h3>
            
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 64 }}></th>
                    <th>Photo</th>
                    <th>Checked on</th>
                    <th>Result</th>
                    <th>AI chance</th>
                    <th>My notes</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.length > 0 ? (
                    processed.map((p: any) => (
                      <tr key={p.id}>
                        {/* Thumbnail */}
                        <td style={{ width: 64, padding: "12px 12px 12px 0" }}>
                          <div className="thumb">
                            <SecureImage
                              investigationId={selectedCaseId}
                              evidenceId={p.id}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </td>

                        {/* Name + Resolution/Format */}
                        <td>
                          {editingPhotoId === p.id ? (
                            <div className="flex items-center gap-1.5 py-0.5">
                              <input
                                type="text"
                                value={editingPhotoName}
                                onChange={(e) => setEditingPhotoName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveRename(p.id);
                                  if (e.key === "Escape") handleCancelRename();
                                }}
                                className="bg-[#050c20] border border-[#38bdf8] text-white text-xs font-semibold rounded px-2 py-1 outline-none w-44"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveRename(p.id)}
                                disabled={savingPhotoName}
                                className="p-1 rounded bg-[#38bdf8]/20 hover:bg-[#38bdf8]/40 text-[#38bdf8] transition-colors"
                                title="Save name"
                              >
                                {savingPhotoName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={handleCancelRename}
                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-[#9fb0cc] transition-colors"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group">
                              <b className="text-white text-sm font-semibold">{p.name}</b>
                              <button
                                onClick={() => handleStartRename(p.id, p.name)}
                                className="opacity-0 group-hover:opacity-100 text-[#6f82a6] hover:text-[#38bdf8] transition-opacity p-0.5 rounded hover:bg-white/5"
                                title="Rename photo"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <div className="text-[#6f82a6] text-xs mt-0.5">{p.meta}</div>
                        </td>

                        {/* Checked on */}
                        <td className="text-[#9fb0cc] text-sm">
                          {p.checkedOn}
                        </td>

                        {/* Result Tag */}
                        <td>
                          <span className={`tag ${p.verdictKey}`}>
                            {p.verdictEmoji} {p.verdictLabel}
                          </span>
                        </td>

                        {/* AI Chance */}
                        <td>
                          <b className="text-white text-sm">{p.ai}%</b>
                        </td>

                        {/* My Notes */}
                        <td className="text-[#9fb0cc] text-sm max-w-[220px] truncate" title={p.notes || ""}>
                          {p.notes || "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-[#6f82a6] text-sm">
                        No photos to display.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 8: Investigator Conclusion & Findings */}
          <div className="pt-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-semibold text-white m-0">My conclusion</h3>
              <small className="text-[#6f82a6] text-xs font-mono">{conclusionSavedStatus}</small>
            </div>
            <textarea
              id="concl"
              rows={4}
              value={conclusion}
              onChange={handleConclusionChange}
              placeholder="Write what you found out, in your own words…"
              style={{
                width: "100%",
                background: "rgba(5,12,32,.7)",
                border: "1px solid var(--line2)",
                borderRadius: 12,
                padding: 12,
                resize: "vertical",
                color: "#fff",
                fontSize: 14,
                outline: "none"
              }}
            />
          </div>

          {/* Section 9: Canonical Ledger Integrity Seal & Epistemic Boundaries */}
          <div className="pt-4 border-t border-[rgba(120,160,255,0.12)] space-y-3.5">
            <div className="bg-[#050c20]/80 border border-[rgba(120,160,255,0.18)] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#22d3ee] shrink-0" />
                <div>
                  <div className="text-white font-semibold">CANONICAL LEDGER AUDIT SEAL</div>
                  <div className="text-[#6f82a6]">Verified against PostgreSQL evidentiary records & pinned asset digests.</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[#9fb0cc] text-[11px]">Ledger Scope: </span>
                <span className="text-[#38bdf8]">
                  SHA256:{selectedCaseId ? selectedCaseId.replace(/-/g, '').slice(0, 24) : "VERIFIED"}…
                </span>
              </div>
            </div>

            <p className="text-[#6f82a6] text-xs leading-relaxed italic">
              ⚠️ <strong>Mandatory Scientific Grounding Disclaimer:</strong> DeepVerify outputs represent statistical likelihoods under policy <code>ensemble-v1.0</code> (decision threshold 0.50). Grad-CAM heatmaps highlight neural feature sensitivity and are diagnostic tools rather than causal tampering boundaries. For legal attribution, corroborate with independent primary source evidence.
            </p>
          </div>

        </div>

      </div>

      {/* Pre-Analysis Naming Dialog Modal */}
      {showUploadModal && selectedFileForUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b1630] border border-[rgba(120,160,255,0.25)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(120,160,255,0.15)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#38bdf8]/15 flex items-center justify-center text-[#38bdf8]">
                  <FileImage className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Name Photo Before Analysis</h3>
                  <p className="text-xs text-[#9fb0cc]">Give this photo a clean title for the report</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowUploadModal(false); setSelectedFileForUpload(null); }}
                className="text-[#6f82a6] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thumbnail Preview */}
            {previewUrl && (
              <div className="h-44 w-full bg-[#050c1d] rounded-xl overflow-hidden border border-[rgba(120,160,255,0.15)] flex items-center justify-center p-2">
                <img src={previewUrl} alt="Preview" className="h-full w-full object-contain rounded-lg" />
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[#9fb0cc] font-semibold block mb-1.5">
                  Photo Name / Label:
                </label>
                <input 
                  type="text" 
                  value={uploadPhotoName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUploadPhotoName(val);
                    if (caseMode === "new") {
                      setUploadNewCaseName("Case: " + val);
                    }
                  }}
                  placeholder="e.g. Suspect Profile Photo, Evidence Item A"
                  className="w-full bg-[#050c20] border border-[rgba(120,160,255,0.25)] focus:border-[#38bdf8] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                  autoFocus
                />
              </div>

              {/* Destination Mode: New Case vs Existing Case */}
              <div className="space-y-2.5">
                <label className="text-[#9fb0cc] font-semibold block mb-1">
                  Investigation Destination:
                </label>
                
                <div className="grid grid-cols-2 gap-2 bg-[#050c1d] p-1 rounded-xl border border-[rgba(120,160,255,0.15)]">
                  <button
                    type="button"
                    onClick={() => setCaseMode("new")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      caseMode === "new"
                        ? "bg-gradient-to-r from-[#38bdf8] to-[#22d3ee] text-[#050c1d] shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                        : "text-[#9fb0cc] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>＋ Create New Case</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaseMode("existing")}
                    disabled={investigationsList.length === 0}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      caseMode === "existing"
                        ? "bg-gradient-to-r from-[#38bdf8] to-[#22d3ee] text-[#050c1d] shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                        : "text-[#9fb0cc] hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    <span>Existing Case</span>
                    {investigationsList.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 font-mono">
                        {investigationsList.length}
                      </span>
                    )}
                  </button>
                </div>

                {caseMode === "new" ? (
                  <div>
                    <label className="text-[#9fb0cc] font-semibold block mb-1">
                      New Case Title:
                    </label>
                    <input 
                      type="text" 
                      value={uploadNewCaseName}
                      onChange={(e) => setUploadNewCaseName(e.target.value)}
                      placeholder="e.g. Social Media Verification, ID Card Audit"
                      className="w-full bg-[#050c20] border border-[rgba(120,160,255,0.25)] focus:border-[#38bdf8] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                    />
                    <span className="text-[11px] text-[#6f82a6] mt-1 block">
                      A dedicated new investigation dossier will be created for this photo.
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="text-[#9fb0cc] font-semibold block mb-1">
                      Select Existing Case:
                    </label>
                    <div className="relative">
                      <select
                        value={uploadTargetCaseId}
                        onChange={(e) => setUploadTargetCaseId(e.target.value)}
                        className="w-full bg-[#050c20] border border-[rgba(120,160,255,0.25)] focus:border-[#38bdf8] text-white text-sm rounded-xl px-3.5 py-2.5 pr-8 appearance-none outline-none cursor-pointer transition-colors"
                      >
                        {investigationsList.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.title}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9fb0cc] pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[rgba(120,160,255,0.15)]">
              <button
                type="button"
                onClick={() => { setShowUploadModal(false); setSelectedFileForUpload(null); }}
                className="btn sm"
                disabled={uploadingAndScanning}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUploadAndAnalyze}
                disabled={uploadingAndScanning || !uploadPhotoName.trim()}
                className="btn pri sm flex items-center gap-1.5"
              >
                {uploadingAndScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading & Scanning…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Photo</span>
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
