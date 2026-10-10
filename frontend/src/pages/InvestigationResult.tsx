import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchApi, API_BASE } from "../services/api";
import { Loader2, AlertCircle, ArrowLeft, UploadCloud, GitCompare, FileDown } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";

export function InvestigationResult() {
  const { id } = useParams<{ id: string }>();
  const [investigation, setInvestigation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInvestigation = async (isRetry = false) => {
    try {
      if (isRetry) setLoading(true);
      setError(null);
      const data = await fetchApi(`/api/v2/investigations/${id}`);
      setInvestigation(data);
    } catch (err: any) {
      setError(err.message || "Failed to load investigation");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (evidenceId?: string) => {
    if (!id) return;
    try {
      setDownloadingReport(true);
      setReportError(null);
      const url = evidenceId 
        ? `${API_BASE}/api/v2/investigations/${id}/report?evidence_id=${evidenceId}`
        : `${API_BASE}/api/v2/investigations/${id}/report`;

      const res = await fetch(url, {
        method: "GET",
        credentials: "include"
      });

      if (!res.ok) {
        throw new Error(`Report export failed (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const contentDisp = res.headers.get("content-disposition");
      let filename = `DeepVerify_Report_${id.slice(0, 8)}.pdf`;
      if (contentDisp && contentDisp.includes("filename=")) {
        const match = contentDisp.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      setReportError(err.message || "Failed to download forensic report");
    } finally {
      setDownloadingReport(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadInvestigation(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    try {
      setUploading(true);
      setUploadError(null);
      
      const formData = new FormData();
      formData.append("file", file);

      await fetchApi(`/api/v2/investigations/${id}/evidence`, {
        method: "POST",
        body: formData,
      });

      // Reload to see the new evidence item
      await loadInvestigation(true);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload evidence");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-24 flex justify-center text-on-surface-variant">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !investigation) {
    return (
      <div className="container mx-auto px-4 py-24 flex flex-col items-center text-destructive">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">Error Loading Case</h2>
        <p className="text-on-surface-variant">{error || "Investigation not found"}</p>
        <Link to="/dashboard" className="mt-6">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Evidence Library</Button>
        </Link>
      </div>
    );
  }

  const evidenceItems = investigation.evidence_items || [];


  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto px-4 py-8 max-w-[1440px] flex flex-col gap-space-lg"
    >
      {/* Top Action Breadcrumb & Meta Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg mb-4">
        <div className="flex flex-col gap-space-xs">
          <Link to="/dashboard" className="text-sm text-on-surface-variant hover:text-primary flex items-center transition-colors mb-2 w-fit">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Evidence Library
          </Link>
          <div className="flex items-center gap-space-sm">
            <span className="font-label-mono text-label-mono px-space-sm py-0.5 rounded bg-surface-container-high text-primary tracking-wider uppercase">Case Dossier</span>
            <span className="font-label-mono text-label-mono text-on-surface-variant">•</span>
            <span className="font-label-mono text-label-mono text-on-surface-variant">ID: #{investigation.id.split('-')[0]}</span>
            <span className="font-label-mono text-label-mono text-on-surface-variant">•</span>
            <span className={`font-label-mono text-label-mono flex items-center gap-1 ${investigation.status === 'OPEN' ? 'text-secondary' : 'text-on-surface-variant'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${investigation.status === 'OPEN' ? 'bg-secondary' : 'bg-on-surface-variant'}`}></span>
              {investigation.status === 'OPEN' ? 'Active Case' : 'Closed / Archived'}
            </span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight font-semibold mt-1">
            {investigation.title}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl">
            Official Forensic Findings Summary. Time of intake: {new Date(investigation.created_at).toLocaleString()}
          </p>
        </div>

        {/* Action Cluster */}
        <div className="flex items-center flex-wrap gap-space-sm flex-shrink-0">
          <Link to={`/investigation/${investigation.id}/compare`}>
            <Button variant="outline" className="border-surface-container-high hover:bg-surface-bright text-on-surface">
              <GitCompare className="mr-2 h-4 w-4 text-primary" /> Cross-Compare Items
            </Button>
          </Link>
          <Button 
            onClick={() => handleDownloadReport()} 
            disabled={downloadingReport}
            className="bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-semibold shadow-[0_0_20px_rgba(77,142,255,0.25)]"
          >
            {downloadingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Download Academic PDF Dossier
          </Button>
        </div>
      </div>

      {reportError && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 bg-error-container/20 border border-error/30 rounded-lg text-xs text-error flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{reportError}</span>
        </motion.div>
      )}

      {/* Case Notes */}
      {investigation.notes && (
        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-space-xs border border-surface-container-highest/60 shadow-sm">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">notes</span>
            Investigator Hypothesis
          </span>
          <p className="font-body-md text-on-surface leading-relaxed mt-1">
            {investigation.notes}
          </p>
        </div>
      )}

      {/* Evidence Ledger List */}
      <div className="rounded-2xl bg-surface-container border border-surface-container-highest/60 shadow-md flex flex-col mt-space-lg">
        <div className="p-space-md border-b border-surface-container-highest/60 flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-high/30">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">inventory_2</span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">Evidence Ledger</h2>
          </div>
          <div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/jpeg, image/png, image/webp"
              onChange={handleFileUpload}
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={uploading}
              className="bg-primary text-on-primary hover:bg-primary-fixed hover:text-on-primary-fixed transition-colors font-semibold shadow-sm"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4 mr-2" />
              )}
              Upload Image
            </Button>
          </div>
        </div>
        
        {uploadError && (
          <div className="bg-error-container/20 border-b border-error/30 p-4 text-sm text-error flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            {uploadError}
          </div>
        )}

        <div className="p-space-lg flex flex-col gap-space-md">
          {evidenceItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-on-surface-variant border-2 border-dashed border-surface-container-highest rounded-xl">
              <span className="material-symbols-outlined text-[48px] mb-4 opacity-20">image_not_supported</span>
              <h3 className="font-label-lg text-on-surface font-semibold">No evidence ingested</h3>
              <p className="font-body-sm mt-1 max-w-sm">Upload media to begin the forensic analysis analysis.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-space-md">
              {evidenceItems.map((item: any, index: number) => {
                const sortedJobs = [...(item.jobs || [])].sort((a: any, b: any) => 
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                const job = sortedJobs[0]; 
                const results = item.analysis_results || [];
                const finalResult = results.length > 0 ? results[0] : null;
                
                return (
                  <Link to={`/investigation/${id}/evidence/${item.id}`} key={item.id} className="block group">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + (index * 0.05) }}
                      className="border border-surface-container-highest rounded-xl p-space-md flex flex-col md:flex-row gap-space-md items-start md:items-center bg-surface-container-lowest hover:bg-surface-container hover:border-primary/40 transition-all shadow-sm group-hover:shadow-md"
                    >
                      <div className="w-12 h-12 bg-surface-container-high rounded-lg shrink-0 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors text-on-surface-variant border border-outline-variant/30">
                        <span className="material-symbols-outlined text-[24px]">image</span>
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-label-lg font-semibold truncate text-on-surface">Image #{item.id.split('-')[0]}</span>
                          <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded font-label-mono text-[10px] uppercase">
                            {item.mime_type}
                          </span>
                        </div>
                        <div className="font-label-mono text-[11px] text-on-surface-variant/70 truncate flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">lock</span>
                          SHA256: {item.file_hash}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col md:items-end gap-2">
                        <div className="flex items-center gap-2 font-label-mono text-[11px]">
                          <span className="text-on-surface-variant">Analysis:</span>
                          <span className={`${item.status === 'COMPLETED' ? 'text-secondary' : item.status === 'FAILED' ? 'text-error' : item.status === 'UPLOADED' ? 'text-on-surface-variant' : 'text-primary'}`}>
                            {item.status || job?.status || 'PENDING'}
                          </span>
                        </div>
                        
                        {finalResult ? (
                          <div className="flex items-center gap-2">
                            {finalResult.verdict === 'LIKELY_AUTHENTIC' ? (
                              <div className="flex items-center gap-1.5 text-secondary bg-secondary-container/20 px-2 py-1 rounded font-label-mono text-[11px] font-bold border border-secondary/20">
                                <span className="material-symbols-outlined text-[14px]">verified</span>
                                {finalResult.verdict.replaceAll('_', ' ')}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-error bg-error-container/20 px-2 py-1 rounded font-label-mono text-[11px] font-bold border border-error/20">
                                <span className="material-symbols-outlined text-[14px]">warning</span>
                                {finalResult.verdict.replaceAll('_', ' ')}
                              </div>
                            )}
                            <span className="font-headline-sm font-semibold text-on-surface">{(finalResult.ensemble_score * 100).toFixed(1)}</span>
                          </div>
                        ) : (
                          job?.status === 'COMPLETED' && <span className="font-label-mono text-xs text-on-surface-variant italic">No verdict generated</span>
                        )}
                      </div>
                      
                      <div className="hidden md:flex ml-4 text-on-surface-variant group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined">chevron_right</span>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
