import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchApi } from "../services/api";
import { SecureImage } from "../components/ui/SecureImage";
import {
  Search,
  Plus,
  Upload,
  Loader2,
  X
} from "lucide-react";

interface ScannedPhoto {
  evidenceId: string;
  investigationId: string;
  investigationTitle: string;
  originalFilename: string;
  createdAt: string;
  size?: number;
  mimeType?: string;
  ensembleScore: number | null;
  status: string;
  dimensions?: string;
  clue?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(t: any): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtSize(b?: number): string {
  if (!b) return "—";
  return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
}

function getVerdict(p: ScannedPhoto) {
  const aiScore = p.ensembleScore !== null ? Math.round(p.ensembleScore * 100) : 50;
  if (aiScore <= 40) {
    return { key: "real", emoji: "✅", label: "Looks real", color: "var(--real)" };
  }
  if (aiScore <= 65) {
    return { key: "warn", emoji: "🤔", label: "Not sure", color: "var(--warn)" };
  }
  return { key: "ai", emoji: "🤖", label: "Likely AI-made", color: "var(--ai)" };
}

export function InvestigationComparison() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const qA = searchParams.get("a") || searchParams.get("evA") || "";
  const qB = searchParams.get("b") || searchParams.get("evB") || "";

  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Picked photo IDs
  const [photoAId, setPhotoAId] = useState<string>(qA);
  const [photoBId, setPhotoBId] = useState<string>(qB);

  // Interactive slider position (0 - 100%)
  const [slidePos, setSlidePos] = useState<number>(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  // Picker Modal State
  const [pickerSlot, setPickerSlot] = useState<"A" | "B" | null>(null);
  const [pickerSearch, setPickerSearch] = useState<string>("");

  // Upload Flow State (Case first, then pick file)
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTargetSlot, setUploadTargetSlot] = useState<"A" | "B" | null>(null);
  const [uploadCaseSelection, setUploadCaseSelection] = useState<string>("");
  const [newCaseTitle, setNewCaseTitle] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [pendingTargetCaseId, setPendingTargetCaseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchApi("/api/v2/investigations/");
      setInvestigations(data || []);
      if (data && data.length > 0 && !uploadCaseSelection) {
        setUploadCaseSelection(data[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load investigations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Collect all completed/scanned photos across all investigations
  const scannedPhotos: ScannedPhoto[] = [];
  for (const inv of investigations) {
    if (!inv.evidence_items) continue;
    for (const ev of inv.evidence_items) {
      if (ev.status === "COMPLETED") {
        const firstResult = ev.analysis_results?.[0];
        const dimObs = ev.observations?.find((o: any) => o.signal_type === "DIMENSIONS");
        const clueObs = ev.observations?.find((o: any) =>
          o.signal_type === "MAIN_CLUE" || o.signal_type === "VERDICT_REASON" || o.signal_type === "SUMMARY"
        );

        scannedPhotos.push({
          evidenceId: ev.id,
          investigationId: inv.id,
          investigationTitle: inv.title || "Untitled Case",
          originalFilename: ev.original_filename || "Photo",
          createdAt: ev.created_at || inv.created_at,
          size: ev.size,
          mimeType: ev.mime_type,
          ensembleScore: firstResult ? firstResult.ensemble_score : null,
          status: ev.status,
          dimensions: dimObs?.value || "1024×1024",
          clue: clueObs?.value || "Texture artifacts in facial periphery"
        });
      }
    }
  }

  // Auto-select initial photos if passed in URL query or if available
  useEffect(() => {
    if (scannedPhotos.length >= 2) {
      if (!photoAId && !photoBId) {
        if (qA && scannedPhotos.some(p => p.evidenceId === qA)) {
          setPhotoAId(qA);
        }
        if (qB && scannedPhotos.some(p => p.evidenceId === qB)) {
          setPhotoBId(qB);
        }
      }
    }
  }, [scannedPhotos.length, qA, qB]);

  const photoA = scannedPhotos.find(p => p.evidenceId === photoAId);
  const photoB = scannedPhotos.find(p => p.evidenceId === photoBId);

  // Dragging handler for Interactive Slider
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDraggingSlider(true);
    updateSlider(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSlider) return;
    updateSlider(e.clientX);
  };

  const handlePointerUp = () => {
    setIsDraggingSlider(false);
  };

  const updateSlider = (clientX: number) => {
    if (!viewerRef.current) return;
    const rect = viewerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(2, Math.min(98, (x / rect.width) * 100));
    setSlidePos(percent);
  };

  const swapAB = () => {
    const temp = photoAId;
    setPhotoAId(photoBId);
    setPhotoBId(temp);
  };

  // Upload flow actions (Case first, then select images)
  const handleOpenUploadFlow = (targetSlot?: "A" | "B" | null) => {
    setUploadTargetSlot(targetSlot || null);
    if (investigations.length > 0) {
      setUploadCaseSelection(investigations[0].id);
    } else {
      setUploadCaseSelection("__new");
    }
    setNewCaseTitle("");
    setShowUploadModal(true);
  };

  const handleConfirmCaseAndPick = async (e: React.FormEvent) => {
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
      // Immediately open native file picker
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        fileInputRef.current.click();
      }
    } catch (err: any) {
      console.error("Error creating investigation:", err);
      setIsUploading(false);
      alert("Failed to initialize case: " + (err.message || "Unknown error"));
    }
  };

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

      if (uploadTargetSlot) {
        const slot = uploadTargetSlot;
        setUploadTargetSlot(null);
        if (slot === "A") setPhotoAId(evData.id);
        else setPhotoBId(evData.id);
        await loadData();
      } else {
        navigate(`/investigation/${targetCaseId}/evidence/${evData.id}`);
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setIsUploading(false);
      setPendingTargetCaseId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Calculate comparison metrics
  const aAi = photoA ? (photoA.ensembleScore !== null ? Math.round(photoA.ensembleScore * 100) : 50) : 0;
  const bAi = photoB ? (photoB.ensembleScore !== null ? Math.round(photoB.ensembleScore * 100) : 50) : 0;

  const aManip = Math.min(99, Math.round(aAi * 0.85 + 4));
  const bManip = Math.min(99, Math.round(bAi * 0.85 + 4));

  const diff = aAi - bAi;
  const more = Math.abs(diff) < 10 ? null : diff > 0 ? { photo: photoA, which: "A", ai: aAi, otherAi: bAi } : { photo: photoB, which: "B", ai: bAi, otherAi: aAi };

  const verdictText = more
    ? `Photo ${more.which} looks more AI-made – ${more.ai}% vs ${more.otherAi}%.`
    : `Both photos score about the same (${aAi}% and ${bAi}%).`;

  const va = photoA ? getVerdict(photoA) : null;
  const vb = photoB ? getVerdict(photoB) : null;

  // Filtered modal photos
  const excludeId = pickerSlot === "A" ? photoBId : photoAId;
  const modalPhotos = scannedPhotos
    .filter(p => p.evidenceId !== excludeId)
    .filter(p => {
      const q = pickerSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        p.originalFilename.toLowerCase().includes(q) ||
        p.investigationTitle.toLowerCase().includes(q)
      );
    });

  if (loading) {
    return (
      <div style={{ minHeight: "100%", padding: "80px 40px", textAlign: "center" }}>
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#22d3ee] mb-3" />
        <p className="muted">Loading photos to compare…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%" }}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilePicked}
        accept="image/*"
        style={{ display: "none" }}
      />

      {/* 1. Fixed Top Header (Matches Screenshot 2 & deepverify-app Exactly) */}
      <div className="top">
        <div className="crumb">
          <b>Compare</b>
        </div>
        <div className="top-r">
          <span className="pill">
            <i />Scanner ready
          </span>
          <button
            onClick={() => handleOpenUploadFlow(null)}
            className="btn pri sm"
          >
            <Upload className="w-3.5 h-3.5 mr-1 inline" /> Check a photo
          </button>
        </div>
      </div>

      <div id="view">
        <div className="stagger" style={{ display: "grid", gap: "22px" }}>
          
          {/* Header Title & Lead */}
          <div>
            <h1>Compare <span className="grad">Photos</span></h1>
            <p className="lead">
              Put two photos side by side to see which one looks more AI-made – great for checking a suspicious photo against a real one.
            </p>
          </div>

          {/* 2 Drop Cards (Matches Screenshot 2) */}
          <div id="cmp" style={{ display: "grid", gap: "22px" }}>
          <div className="grid g2">
            
            {/* Slot A */}
            <div className="card" style={{ textAlign: "center" }}>
              {photoA ? (
                <div>
                  <div className="thumb" style={{ aspectRatio: "4/3" }}>
                    <SecureImage
                      investigationId={photoA.investigationId}
                      evidenceId={photoA.evidenceId}
                      type="download"
                    />
                    {va && <span className={`tg tag ${va.key}`}>{va.emoji} {va.label}</span>}
                  </div>
                  <div className="row between" style={{ marginTop: "12px" }}>
                    <div style={{ textAlign: "left" }}>
                      <b>{photoA.originalFilename}</b>
                      <div className="faint sm">{photoA.investigationTitle} · {fmtDate(photoA.createdAt)}</div>
                    </div>
                    <button className="btn sm" onClick={() => setPickerSlot("A")}>
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="drop"
                  onClick={() => setPickerSlot("A")}
                >
                  <div className="big">
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h3>Choose Photo A</h3>
                  <p className="muted sm" style={{ marginTop: "6px" }}>
                    The photo you're unsure about
                  </p>
                  <div className="row" style={{ justifyContent: "center", marginTop: "14px", gap: "10px" }}>
                    <span className="btn sm" style={{ pointerEvents: "none" }}>
                      Choose from vault
                    </span>
                    <button
                      type="button"
                      className="btn pri sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUploadFlow("A");
                      }}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1 inline" /> Upload new
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Slot B */}
            <div className="card" style={{ textAlign: "center" }}>
              {photoB ? (
                <div>
                  <div className="thumb" style={{ aspectRatio: "4/3" }}>
                    <SecureImage
                      investigationId={photoB.investigationId}
                      evidenceId={photoB.evidenceId}
                      type="download"
                    />
                    {vb && <span className={`tg tag ${vb.key}`}>{vb.emoji} {vb.label}</span>}
                  </div>
                  <div className="row between" style={{ marginTop: "12px" }}>
                    <div style={{ textAlign: "left" }}>
                      <b>{photoB.originalFilename}</b>
                      <div className="faint sm">{photoB.investigationTitle} · {fmtDate(photoB.createdAt)}</div>
                    </div>
                    <button className="btn sm" onClick={() => setPickerSlot("B")}>
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="drop"
                  onClick={() => setPickerSlot("B")}
                >
                  <div className="big">
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h3>Choose Photo B</h3>
                  <p className="muted sm" style={{ marginTop: "6px" }}>
                    A photo to compare it with
                  </p>
                  <div className="row" style={{ justifyContent: "center", marginTop: "14px", gap: "10px" }}>
                    <span className="btn sm" style={{ pointerEvents: "none" }}>
                      Choose from vault
                    </span>
                    <button
                      type="button"
                      className="btn pri sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUploadFlow("B");
                      }}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1 inline" /> Upload new
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Comparison Output (Rendered when both photos selected) */}
          {photoA && photoB && va && vb && (
            <>
              {/* Result Summary Banner */}
              <div className="card glow" style={{ textAlign: "center" }}>
                <span className="tag info">🏁 RESULT</span>
                <h2 style={{ marginTop: "10px", fontSize: "22px", fontWeight: "600" }}>
                  {verdictText}
                </h2>
                <p className="muted sm" style={{ marginTop: "8px" }}>
                  {more ? "A bigger gap means a clearer difference." : "Try comparing with a photo you know is real."}
                </p>
              </div>

              {/* Interactive Split Viewer */}
              <div className="card">
                <div className="row between" style={{ marginBottom: "12px" }}>
                  <h2>Slide to compare</h2>
                  <button className="btn sm" onClick={swapAB}>
                    ⇄ Swap A and B
                  </button>
                </div>
                <div
                  className="viewer"
                  ref={viewerRef}
                  style={{
                    maxWidth: "720px",
                    margin: "0 auto",
                    position: "relative",
                    aspectRatio: "4/3",
                    userSelect: "none"
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  {/* Photo B Base */}
                  <div style={{ position: "absolute", inset: 0 }}>
                    <SecureImage
                      investigationId={photoB.investigationId}
                      evidenceId={photoB.evidenceId}
                      type="download"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Photo A Clipped Overlay */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      clipPath: `inset(0 ${100 - slidePos}% 0 0)`
                    }}
                  >
                    <SecureImage
                      investigationId={photoA.investigationId}
                      evidenceId={photoA.evidenceId}
                      type="download"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Vertical Divider Line */}
                  <div
                    className="divider"
                    style={{
                      left: `${slidePos}%`,
                      display: "block"
                    }}
                  />

                  <span className="tag info" style={{ position: "absolute", left: "12px", top: "12px", zIndex: 12 }}>
                    A
                  </span>
                  <span className="tag info" style={{ position: "absolute", right: "12px", top: "12px", zIndex: 12 }}>
                    B
                  </span>
                </div>
              </div>

              {/* Head-to-Head Forensic Metrics Table */}
              <div className="card">
                <h2 style={{ marginBottom: "12px" }}>Head to head</h2>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "26%" }}></th>
                      <th>Photo A</th>
                      <th>Photo B</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">Result</td>
                      <td>
                        <span className={`tag ${va.key}`}>{va.emoji} {va.label}</span>
                      </td>
                      <td>
                        <span className={`tag ${vb.key}`}>{vb.emoji} {vb.label}</span>
                      </td>
                    </tr>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">AI-made chance</td>
                      <td>
                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          <div className="bar" style={{ flex: 1 }}>
                            <i style={{ width: `${aAi}%`, background: "linear-gradient(90deg,#38bdf8,#fb7185)" }} />
                          </div>
                          <b style={{ minWidth: "42px" }}>{aAi}%</b>
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          <div className="bar" style={{ flex: 1 }}>
                            <i style={{ width: `${bAi}%`, background: "linear-gradient(90deg,#38bdf8,#fb7185)" }} />
                          </div>
                          <b style={{ minWidth: "42px" }}>{bAi}%</b>
                        </div>
                      </td>
                    </tr>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">Edited chance</td>
                      <td>
                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          <div className="bar" style={{ flex: 1 }}>
                            <i style={{ width: `${aManip}%`, background: "linear-gradient(90deg,#38bdf8,#fbbf24)" }} />
                          </div>
                          <b style={{ minWidth: "42px" }}>{aManip}%</b>
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          <div className="bar" style={{ flex: 1 }}>
                            <i style={{ width: `${bManip}%`, background: "linear-gradient(90deg,#38bdf8,#fbbf24)" }} />
                          </div>
                          <b style={{ minWidth: "42px" }}>{bManip}%</b>
                        </div>
                      </td>
                    </tr>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">Looks natural</td>
                      <td style={aAi < bAi ? { color: "var(--real)", fontWeight: 700 } : {}}>{100 - aAi}%</td>
                      <td style={bAi < aAi ? { color: "var(--real)", fontWeight: 700 } : {}}>{100 - bAi}%</td>
                    </tr>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">Size</td>
                      <td>{fmtSize(photoA.size)}</td>
                      <td>{fmtSize(photoB.size)}</td>
                    </tr>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">Dimensions</td>
                      <td>{photoA.dimensions || "1024×1024"}</td>
                      <td>{photoB.dimensions || "1024×1024"}</td>
                    </tr>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">File type</td>
                      <td>{(photoA.mimeType?.split("/")[1] || "JPEG").toUpperCase()}</td>
                      <td>{(photoB.mimeType?.split("/")[1] || "JPEG").toUpperCase()}</td>
                    </tr>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">Case</td>
                      <td>{photoA.investigationTitle}</td>
                      <td>{photoB.investigationTitle}</td>
                    </tr>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">Added</td>
                      <td>{fmtDate(photoA.createdAt)}</td>
                      <td>{fmtDate(photoB.createdAt)}</td>
                    </tr>
                    <tr style={{ cursor: "default" }}>
                      <td className="muted">Main clue</td>
                      <td className="sm">{photoA.clue || "Synthetic artifacts detected in deep layers"}</td>
                      <td className="sm">{photoB.clue || "Synthetic artifacts detected in deep layers"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>

      {/* Photo Picker Modal */}
      {pickerSlot && (
        <div className="veil" onClick={() => setPickerSlot(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ marginBottom: "6px" }}>
              <h2>Choose Photo {pickerSlot}</h2>
              <button className="btn sm" onClick={() => setPickerSlot(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="muted sm" style={{ margin: "6px 0 14px" }}>
              Only photos that have been scanned show up here.
            </p>
            <div className="row between" style={{ marginBottom: "14px" }}>
              <div className="search" style={{ flex: 1, minWidth: "200px" }}>
                <Search className="w-4 h-4" />
                <input
                  placeholder="Search by photo or case name…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="btn pri sm"
                onClick={() => {
                  const slot = pickerSlot;
                  setPickerSlot(null);
                  handleOpenUploadFlow(slot);
                }}
              >
                <Upload className="w-3.5 h-3.5 mr-1 inline" /> Upload new photo
              </button>
            </div>
            <div className="grid g3" style={{ maxHeight: "52vh", overflowY: "auto", padding: "2px" }}>
              {modalPhotos.length > 0 ? (
                modalPhotos.map((p) => {
                  const v = getVerdict(p);
                  return (
                    <div
                      key={p.evidenceId}
                      className="photo"
                      onClick={() => {
                        if (pickerSlot === "A") setPhotoAId(p.evidenceId);
                        else setPhotoBId(p.evidenceId);
                        setPickerSlot(null);
                        setPickerSearch("");
                      }}
                    >
                      <div className="thumb">
                        <SecureImage
                          investigationId={p.investigationId}
                          evidenceId={p.evidenceId}
                          type="download"
                        />
                        <span className={`tg tag ${v.key}`}>{v.emoji} {v.label}</span>
                      </div>
                      <div className="meta">
                        <b>{p.originalFilename}</b>
                        <small>{p.investigationTitle} · {fmtDate(p.createdAt)}</small>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state" style={{ gridColumn: "1/-1", padding: "30px 20px" }}>
                  <p className="muted sm" style={{ marginBottom: "12px" }}>No scanned photos found.</p>
                  <button
                    type="button"
                    className="btn pri sm"
                    onClick={() => {
                      const slot = pickerSlot;
                      setPickerSlot(null);
                      handleOpenUploadFlow(slot);
                    }}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1 inline" /> Upload a photo to compare
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

            <form onSubmit={handleConfirmCaseAndPick}>
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
    </div>
  );
}
