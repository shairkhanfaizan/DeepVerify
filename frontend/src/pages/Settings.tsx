import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { fetchApi } from "../services/api";
import {
  UploadCloud,
  Eye,
  EyeOff,
  Loader2,
  Check,
  Save,
  CheckCircle2,
  AlertCircle,
  FileImage,
  X
} from "lucide-react";

export function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // About you state
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem("deepverify_user_name") || user?.email?.split("@")[0] || "Faizan";
  });

  // AI Helper state
  const [googleApiKey, setGoogleApiKey] = useState<string>(() => {
    return localStorage.getItem("deepverify_google_api_key") || "";
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("deepverify_gemini_model") || "gemini-2.5-flash";
  });
  const [defaultModel, setDefaultModel] = useState<string>(() => {
    return localStorage.getItem("deepverify_default_model") || localStorage.getItem("deepverify_gemini_model") || "gemini-2.5-flash";
  });

  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isDefaultSaved, setIsDefaultSaved] = useState<boolean>(false);

  // Toast notifications state
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type?: "info" | "success" | "error" }>>([]);

  const addToast = (message: string, type: "info" | "success" | "error" = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Debounced auto-save for user name
  const nameSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserName(val);

    if (nameSaveTimeoutRef.current) {
      clearTimeout(nameSaveTimeoutRef.current);
    }

    nameSaveTimeoutRef.current = setTimeout(() => {
      const trimmed = val.trim() || "Faizan";
      localStorage.setItem("deepverify_user_name", trimmed);
      addToast("Saved ✓", "success");
    }, 500);
  };

  // Debounced auto-save for Gemini API key
  const keySaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGoogleApiKey(val);

    if (keySaveTimeoutRef.current) {
      clearTimeout(keySaveTimeoutRef.current);
    }

    keySaveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem("deepverify_google_api_key", val.trim());
      addToast("Saved ✓", "success");
    }, 600);
  };

  // Model change handler
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setSelectedModel(model);
    localStorage.setItem("deepverify_gemini_model", model);
    addToast("Saved ✓", "success");
  };

  // Save Default Option handler
  const handleSaveDefault = () => {
    localStorage.setItem("deepverify_gemini_model", selectedModel);
    localStorage.setItem("deepverify_default_model", selectedModel);
    if (googleApiKey.trim()) {
      localStorage.setItem("deepverify_google_api_key", googleApiKey.trim());
    }
    setDefaultModel(selectedModel);
    setIsDefaultSaved(true);
    addToast("Default model saved ✓", "success");
    setTimeout(() => setIsDefaultSaved(false), 2500);
  };

  // Test API key handler
  const handleTestKey = async () => {
    const trimmed = googleApiKey.trim();
    if (!trimmed) {
      addToast("Paste a key first.", "info");
      return;
    }
    if (trimmed.length < 15) {
      addToast("That key looks too short.", "error");
      return;
    }

    try {
      setIsValidating(true);
      const res = await fetchApi("/api/v2/investigations/assistant/validate-key", {
        method: "POST",
        body: JSON.stringify({
          google_api_key: trimmed,
          gemini_model: selectedModel
        })
      });

      if (res && res.valid) {
        addToast("Key looks good! Google Gemini verified successfully ✓", "success");
      } else {
        addToast(res?.message || "Google rejected this API key.", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Connection failed during test.", "error");
    } finally {
      setIsValidating(false);
    }
  };

  // -------------------------------------------------------------
  // Topbar "Check a photo" Flow (Consistent with Dashboard & Reports)
  // -------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadPhotoName, setUploadPhotoName] = useState<string>("");
  const [caseMode, setCaseMode] = useState<"new" | "existing">("new");
  const [uploadNewCaseName, setUploadNewCaseName] = useState<string>("");
  const [uploadTargetCaseId, setUploadTargetCaseId] = useState<string>("");
  const [investigationsList, setInvestigationsList] = useState<any[]>([]);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadingAndScanning, setUploadingAndScanning] = useState<boolean>(false);

  const handleTopCheckPhotoClick = async () => {
    try {
      const data = await fetchApi("/api/v2/investigations/");
      if (Array.isArray(data)) {
        setInvestigationsList(data);
        if (data.length > 0) {
          setUploadTargetCaseId(data[0].id);
        }
      }
    } catch {
      // Non-blocking
    }
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

      // Trigger analysis immediately and navigate to workbench
      fetchApi(`/api/v2/investigations/${targetId}/evidence/${evidenceItem.id}/analyze`, {
        method: "POST"
      }).catch(console.error);

      setShowUploadModal(false);
      navigate(`/investigation/${targetId}/evidence/${evidenceItem.id}`);
    } catch (err: any) {
      addToast(err.message || "Failed to initiate photo scan.", "error");
    } finally {
      setUploadingAndScanning(false);
    }
  };

  const isCurrentDefault = defaultModel === selectedModel;

  return (
    <div className="settings-page font-sans text-white">
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

        .settings-page {
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
          padding: 24px;
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
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
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
          transition: .2s;
        }
        .field input:focus, .field select:focus, .field textarea:focus {
          border-color: var(--sky);
          box-shadow: 0 0 0 3px rgba(56,189,248,.18);
        }
        .field input[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
          background: rgba(5,12,32,.4);
        }
        .field small {
          color: var(--faint);
          font-size: 12.5px;
        }

        .opt {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 16px 0;
          border-bottom: 1px solid var(--line);
        }
        .opt:last-child {
          border: 0;
          padding-bottom: 0;
        }

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
          animation: pop .25s ease-out;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        @keyframes rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pop {
          from { opacity: 0; transform: scale(.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .stagger > * {
          animation: rise .5s cubic-bezier(.2,.8,.2,1) both;
        }
        .stagger > *:nth-child(2) { animation-delay: .06s; }
        .stagger > *:nth-child(3) { animation-delay: .12s; }
        .stagger > *:nth-child(4) { animation-delay: .18s; }
      `}</style>

      {/* Hidden File Picker for Topbar Action */}
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
          DeepVerify &rsaquo; <b>Settings</b>
        </div>
        <div className="top-r">
          <span className="pill"><i></i> Scanner ready</span>
          <button className="btn pri sm" onClick={handleTopCheckPhotoClick}>
            <UploadCloud className="w-4 h-4 mr-1 inline" /> Check a photo
          </button>
        </div>
      </div>

      {/* Main Settings Content — Exact Two Sections Requested */}
      <div className="stagger" style={{ display: "grid", gap: "22px", maxWidth: "820px", paddingBottom: "60px" }}>
        
        {/* Title & Lead */}
        <div>
          <h1><span className="grad">Settings</span></h1>
          <p className="lead">Make DeepVerify work the way you like. Everything saves automatically.</p>
        </div>

        {/* Section 1: About you */}
        <div className="card">
          <h2>About you</h2>
          <div className="field" style={{ marginTop: "16px" }}>
            <label htmlFor="s-name">Your name</label>
            <input
              id="s-name"
              value={userName}
              onChange={handleNameChange}
              maxLength={30}
              placeholder="Your name"
            />
            <small>We use it to say hello and on your reports.</small>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Email</label>
            <input value={user?.email || "faizan@deepverify.io"} disabled />
          </div>
        </div>

        {/* Section 2: AI Helper with Model Selection & Save Default */}
        <div className="card">
          <h2>AI Helper</h2>
          <p className="muted sm" style={{ margin: "6px 0 16px" }}>
            The helper explains results in plain language. It works out of the box. Add your own Google Gemini key for smarter, longer answers.
          </p>

          <div className="field">
            <label htmlFor="s-key">
              Gemini key <span className="faint">(optional)</span>
            </label>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  id="s-key"
                  type={showKey ? "text" : "password"}
                  placeholder="Paste your key here"
                  value={googleApiKey}
                  onChange={handleKeyChange}
                  autoComplete="off"
                  style={{ paddingRight: "42px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--faint)",
                    cursor: "pointer"
                  }}
                  title={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                className="btn"
                id="s-test"
                onClick={handleTestKey}
                disabled={isValidating}
              >
                {isValidating ? <Loader2 size={16} className="animate-spin" /> : null}
                Test
              </button>
            </div>
            <small>Stored only in this browser.</small>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="s-mod">Model selection</label>
            <select
              id="s-mod"
              value={selectedModel}
              onChange={handleModelChange}
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash — Quick answers (faster)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro — Detailed forensic reasoning (slower)</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash — High throughput</option>
              <option value="gemini-3.5-flash">Gemini 3.5 Flash — Balanced analysis</option>
            </select>
            <small>Select the model used by the AI helper for interpreting detection findings.</small>
          </div>

          {/* Save Default Option inside AI Helper Box */}
          <div className="opt" style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <b>Save as default model</b>
                {isCurrentDefault && (
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "99px",
                    background: "rgba(34,211,238,0.15)",
                    color: "var(--cyan)",
                    border: "1px solid rgba(34,211,238,0.3)"
                  }}>
                    ACTIVE DEFAULT
                  </span>
                )}
              </div>
              <div className="muted sm" style={{ marginTop: "2px" }}>
                Always use this model for future forensic workbench analyses and reports.
              </div>
            </div>
            <button
              className="btn pri sm"
              id="s-save-default"
              onClick={handleSaveDefault}
              style={{ gap: "6px", whiteSpace: "nowrap" }}
            >
              {isDefaultSaved ? <Check size={15} /> : <Save size={15} />}
              {isDefaultSaved ? "Saved as default ✓" : "Save default"}
            </button>
          </div>
        </div>

      </div>

      {/* Floating Toasts Notification System */}
      {toasts.length > 0 && (
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              {t.type === "success" ? (
                <CheckCircle2 size={16} color="var(--real)" />
              ) : t.type === "error" ? (
                <AlertCircle size={16} color="var(--ai)" />
              ) : null}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pre-Analysis Photo Upload & Naming Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-[#0a1530] border border-[rgba(120,160,255,.28)] rounded-2xl shadow-2xl p-6 flex flex-col gap-5 text-white">
            
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(120,160,255,.16)]">
              <div className="flex items-center gap-2">
                <FileImage className="w-5 h-5 text-[#38bdf8]" />
                <h3 className="text-lg font-bold">Configure Photo Analysis</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-[#9fb0cc] hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview and Photo Name Input */}
            <div className="flex gap-4 items-center">
              {previewUrl && (
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-[rgba(120,160,255,.2)] shrink-0 bg-[#060e22]">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 field" style={{ margin: 0 }}>
                <label className="text-xs font-semibold text-[#9fb0cc]">
                  Photo Name (Customizable)
                </label>
                <input
                  type="text"
                  value={uploadPhotoName}
                  onChange={(e) => setUploadPhotoName(e.target.value)}
                  placeholder="e.g. Street portrait"
                  className="w-full"
                />
              </div>
            </div>

            {/* Segmented Switcher: New Case vs Existing Case */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#9fb0cc]">
                Investigation Assignment
              </label>
              
              <div className="grid grid-cols-2 p-1 bg-[#060e22] border border-[rgba(120,160,255,.16)] rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setCaseMode("new")}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    caseMode === "new"
                      ? "bg-[#38bdf8] text-[#04122b] shadow-md shadow-[#38bdf8]/20"
                      : "text-[#9fb0cc] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>＋</span> Create New Case
                </button>
                <button
                  type="button"
                  onClick={() => setCaseMode("existing")}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    caseMode === "existing"
                      ? "bg-[#38bdf8] text-[#04122b] shadow-md shadow-[#38bdf8]/20"
                      : "text-[#9fb0cc] hover:text-white hover:bg-white/5"
                  }`}
                >
                  Existing Case
                </button>
              </div>

              {caseMode === "new" ? (
                <div className="mt-2 field" style={{ margin: 0 }}>
                  <label className="text-xs font-semibold text-[#9fb0cc]">
                    New Case Title
                  </label>
                  <input
                    type="text"
                    value={uploadNewCaseName}
                    onChange={(e) => setUploadNewCaseName(e.target.value)}
                    placeholder="e.g. Profile photos investigation"
                    className="w-full"
                  />
                  <small className="text-[11px] text-[#6f82a6]">
                    A new case folder will be created immediately for this photo.
                  </small>
                </div>
              ) : (
                <div className="mt-2 field" style={{ margin: 0 }}>
                  <label className="text-xs font-semibold text-[#9fb0cc]">
                    Select Existing Case
                  </label>
                  {investigationsList.length === 0 ? (
                    <div className="p-3 text-xs text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20 rounded-xl">
                      No existing cases found. A new case will be created instead.
                    </div>
                  ) : (
                    <select
                      value={uploadTargetCaseId}
                      onChange={(e) => setUploadTargetCaseId(e.target.value)}
                      className="w-full"
                    >
                      {investigationsList.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.title || "Untitled Case"} ({inv.evidence_items?.length || 0} items)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[rgba(120,160,255,.16)]">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="btn sm"
                disabled={uploadingAndScanning}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUploadAndScan}
                disabled={uploadingAndScanning}
                className="btn pri sm"
              >
                {uploadingAndScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting Pipeline...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Analyze Photo
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
