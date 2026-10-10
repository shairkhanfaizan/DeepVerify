import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchApi } from "../services/api";
import { Loader2, Search, Upload, Image as ImageIcon, CheckCircle, Bot, Clock, ChevronDown, Download, CheckSquare } from "lucide-react";
import { motion } from "framer-motion";
import { SecureImage } from "../components/ui/SecureImage";

interface EvidenceRow {
  evidenceId: string;
  investigationId: string;
  investigationTitle: string;
  originalFilename: string;
  createdAt: string;
  ensembleScore: number | null;
  verdict: string | null;
  status: string;
}

export function Vault() {
  const [evidenceList, setEvidenceList] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [caseFilter, setCaseFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "LAST_7" | "LAST_30">("ALL");
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AUTHENTIC" | "PENDING" | "AI">("ALL");
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadVaultData = async () => {
      try {
        setLoading(true);
        setError(null);
        const investigations = await fetchApi("/api/v2/investigations/");
        
        const rows: EvidenceRow[] = [];
        const detailPromises = (investigations || []).map((inv: any) =>
          fetchApi(`/api/v2/investigations/${inv.id}`).catch(() => null)
        );
        const detailedInvs = await Promise.all(detailPromises);

        for (const detailed of detailedInvs) {
          if (!detailed || !detailed.evidence_items) continue;
          for (const ev of detailed.evidence_items) {
            let verdict = null;
            let ensembleScore = null;
            if (ev.status === "COMPLETED" && ev.analysis_results && ev.analysis_results.length > 0) {
              verdict = ev.analysis_results[0].verdict;
              ensembleScore = ev.analysis_results[0].ensemble_score;
            }
            rows.push({
              evidenceId: ev.id,
              investigationId: detailed.id,
              investigationTitle: detailed.title || "Untitled Case",
              originalFilename: ev.original_filename || "Image",
              createdAt: ev.created_at || detailed.created_at,
              ensembleScore,
              verdict,
              status: ev.status
            });
          }
        }
        setEvidenceList(rows);
      } catch (err: unknown) {
        setError("Failed to load Photo Vault");
      } finally {
        setLoading(false);
      }
    };
    loadVaultData();
  }, []);

  const totalPhotos = evidenceList.length;
  const authenticCount = evidenceList.filter(e => e.verdict === "LIKELY_AUTHENTIC").length;
  const aiCount = evidenceList.filter(e => e.verdict === "LIKELY_AI_GENERATED").length;
  const pendingCount = totalPhotos - authenticCount - aiCount;

  // Derive unique cases for dropdown
  const uniqueCases = Array.from(new Set(evidenceList.map(e => e.investigationTitle))).sort();

  // Filter & Sort
  const filteredList = evidenceList.filter(item => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = item.originalFilename.toLowerCase().includes(query) ||
                          item.investigationTitle.toLowerCase().includes(query);
    if (!matchesSearch) return false;

    if (caseFilter !== "ALL" && item.investigationTitle !== caseFilter) return false;

    if (statusFilter === "AUTHENTIC" && item.verdict !== "LIKELY_AUTHENTIC") return false;
    if (statusFilter === "AI" && item.verdict !== "LIKELY_AI_GENERATED") return false;
    if (statusFilter === "PENDING" && (item.verdict === "LIKELY_AUTHENTIC" || item.verdict === "LIKELY_AI_GENERATED")) return false;

    if (dateFilter === "LAST_7") {
      if (Date.now() - new Date(item.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000) return false;
    }
    if (dateFilter === "LAST_30") {
      if (Date.now() - new Date(item.createdAt).getTime() > 30 * 24 * 60 * 60 * 1000) return false;
    }

    return true;
  }).sort((a, b) => {
    const tA = new Date(a.createdAt).getTime();
    const tB = new Date(b.createdAt).getTime();
    return sortOrder === "NEWEST" ? tB - tA : tA - tB;
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDownload = () => {
    const target = selectedIds.size > 0 ? evidenceList.filter(r => selectedIds.has(r.evidenceId)) : filteredList;
    if (target.length === 0) return;
    const headers = ["Evidence_ID", "Case", "Filename", "Date", "Status", "Verdict", "Model_Score"];
    const rows = target.map(r => [
      `"${r.evidenceId}"`,
      `"${r.investigationTitle}"`,
      `"${r.originalFilename}"`,
      new Date(r.createdAt).toISOString(),
      r.status,
      r.verdict || "N/A",
      r.ensembleScore !== null ? (r.ensembleScore * 100).toFixed(1) + "%" : "N/A"
    ]);
    const csv = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "PhotoVault_Export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#090e17] text-white">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1440px] mx-auto w-full px-8 md:px-12 pt-8 pb-16 flex flex-col"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-[13px] font-semibold text-white mb-2">Photo Vault</h1>
            <h2 className="text-[36px] font-bold text-white mb-3 leading-none tracking-tight">Photo <span className="text-[#38bdf8]">Vault</span></h2>
            <p className="text-[13px] text-[#8b9cb6] max-w-[500px] leading-relaxed">
              Every photo you've checked, all in one place. Search, sort and pick the ones you want.
            </p>
          </div>
          <Link 
            to="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 border border-[#38bdf8] text-[#38bdf8] rounded-full text-[13px] font-semibold hover:bg-[#38bdf8]/10 transition-colors shrink-0"
          >
            <Upload className="w-4 h-4" />
            Check a new photo
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#111a31]/80 backdrop-blur-sm rounded-2xl p-5 border border-white/5 flex flex-col justify-between h-[100px]">
            <div className="flex items-center justify-between text-[13px] text-[#8b9cb6]">
              <span>All photos</span>
              <div className="bg-[#38bdf8]/10 p-1 rounded"><ImageIcon className="w-3.5 h-3.5 text-[#38bdf8]" /></div>
            </div>
            <div className="text-[28px] font-bold text-white">{loading ? "-" : totalPhotos}</div>
          </div>
          <div className="bg-[#111a31]/80 backdrop-blur-sm rounded-2xl p-5 border border-white/5 flex flex-col justify-between h-[100px]">
            <div className="flex items-center justify-between text-[13px] text-[#8b9cb6]">
              <span>Looks real</span>
              <div className="bg-[#22c55e]/10 p-1 rounded"><CheckCircle className="w-3.5 h-3.5 text-[#22c55e]" /></div>
            </div>
            <div className="text-[28px] font-bold text-white">{loading ? "-" : authenticCount}</div>
          </div>
          <div className="bg-[#111a31]/80 backdrop-blur-sm rounded-2xl p-5 border border-white/5 flex flex-col justify-between h-[100px]">
            <div className="flex items-center justify-between text-[13px] text-[#8b9cb6]">
              <span>Pending</span>
              <div className="bg-[#eab308]/10 p-1 rounded"><Clock className="w-3.5 h-3.5 text-[#eab308]" /></div>
            </div>
            <div className="text-[28px] font-bold text-white">{loading ? "-" : pendingCount}</div>
          </div>
          <div className="bg-[#111a31]/80 backdrop-blur-sm rounded-2xl p-5 border border-white/5 flex flex-col justify-between h-[100px]">
            <div className="flex items-center justify-between text-[13px] text-[#8b9cb6]">
              <span>Likely AI-made</span>
              <div className="bg-[#ec4899]/10 p-1 rounded"><Bot className="w-3.5 h-3.5 text-[#ec4899]" /></div>
            </div>
            <div className="text-[28px] font-bold text-white">{loading ? "-" : aiCount}</div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-4 mb-6">
          <div className="relative w-full lg:flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb6]" />
            <input 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full bg-[#111a31]/50 border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-[13px] text-white placeholder-[#8b9cb6] outline-none focus:border-[#38bdf8]/50 transition-colors"
               placeholder="Search photos by name..."
            />
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-[200px]">
              <select 
                value={caseFilter} 
                onChange={(e) => setCaseFilter(e.target.value)}
                className="w-full appearance-none bg-[#111a31]/50 border border-white/5 rounded-xl py-2.5 pl-4 pr-10 text-[13px] text-white outline-none focus:border-[#38bdf8]/50 transition-colors"
              >
                <option value="ALL">All cases</option>
                {uniqueCases.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb6] pointer-events-none" />
            </div>
            <div className="relative flex-1 lg:w-[150px]">
              <select 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full appearance-none bg-[#111a31]/50 border border-white/5 rounded-xl py-2.5 pl-4 pr-10 text-[13px] text-white outline-none focus:border-[#38bdf8]/50 transition-colors"
              >
                <option value="ALL">All time</option>
                <option value="LAST_7">Last 7 days</option>
                <option value="LAST_30">Last 30 days</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb6] pointer-events-none" />
            </div>
            <div className="relative flex-1 lg:w-[150px]">
              <select 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="w-full appearance-none bg-[#111a31]/50 border border-white/5 rounded-xl py-2.5 pl-4 pr-10 text-[13px] text-white outline-none focus:border-[#38bdf8]/50 transition-colors"
              >
                <option value="NEWEST">Newest first</option>
                <option value="OLDEST">Oldest first</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb6] pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            <button onClick={() => setStatusFilter("ALL")} className={`px-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${statusFilter === "ALL" ? "border border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/5" : "bg-[#111a31]/80 text-[#8b9cb6] hover:text-white"}`}>All</button>
            <button onClick={() => setStatusFilter("AUTHENTIC")} className={`px-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${statusFilter === "AUTHENTIC" ? "border border-[#22c55e] text-[#22c55e] bg-[#22c55e]/5" : "bg-[#111a31]/80 text-[#8b9cb6] hover:text-white"}`}>
              <CheckCircle className="w-3.5 h-3.5" /> Looks real
            </button>
            <button onClick={() => setStatusFilter("PENDING")} className={`px-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${statusFilter === "PENDING" ? "border border-[#eab308] text-[#eab308] bg-[#eab308]/5" : "bg-[#111a31]/80 text-[#8b9cb6] hover:text-white"}`}>
              <Clock className="w-3.5 h-3.5" /> Pending
            </button>
            <button onClick={() => setStatusFilter("AI")} className={`px-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${statusFilter === "AI" ? "border border-[#ec4899] text-[#ec4899] bg-[#ec4899]/5" : "bg-[#111a31]/80 text-[#8b9cb6] hover:text-white"}`}>
              <Bot className="w-3.5 h-3.5" /> AI-made
            </button>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-[#8b9cb6]">
            <span>Showing {filteredList.length} of {totalPhotos}</span>
            <Link 
              to={(() => {
                if (selectedIds.size !== 2) return "#";
                const ids = Array.from(selectedIds);
                const a = evidenceList.find(e => e.evidenceId === ids[0]);
                const b = evidenceList.find(e => e.evidenceId === ids[1]);
                if (!a || !b) return "#";
                return `/comparison?invA=${a.investigationId}&evA=${a.evidenceId}&invB=${b.investigationId}&evB=${b.evidenceId}`;
              })()}
              className={`flex items-center gap-1.5 transition-colors ${selectedIds.size === 2 ? "text-white hover:text-[#38bdf8]" : "opacity-50 cursor-not-allowed"}`}
            >
              <CheckSquare className="w-3.5 h-3.5" /> Compare 2
            </Link>
            <button onClick={handleDownload} className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Download className="w-3.5 h-3.5" /> Download list
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#8b9cb6] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#38bdf8]" />
            <span className="text-[13px]">Loading vault...</span>
          </div>
        ) : error ? (
          <div className="py-24 text-center text-[#ef4444] text-[14px]">{error}</div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl bg-[#111a31]/30">
            <h3 className="text-[15px] font-semibold text-white mb-2">No photos found</h3>
            <p className="text-[#8b9cb6] text-[13px]">Upload a photo or adjust your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredList.map((row) => {
              const isSelected = selectedIds.has(row.evidenceId);
              const dateStr = new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              let badge = null;
              let subtitleText = dateStr;

              if (row.verdict === "LIKELY_AI_GENERATED") {
                badge = (
                  <div className="absolute top-3 left-3 bg-[#ec4899]/90 text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-sm z-10">
                    <Bot className="w-3 h-3" /> Likely AI-made
                  </div>
                );
                subtitleText += ` · ${row.ensembleScore !== null ? Math.round(row.ensembleScore * 100) : "??"}% AI`;
              } else if (row.verdict === "LIKELY_AUTHENTIC") {
                badge = (
                  <div className="absolute top-3 left-3 bg-[#22c55e]/90 text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-sm z-10">
                    <CheckCircle className="w-3 h-3" /> Looks real
                  </div>
                );
              } else {
                badge = (
                  <div className="absolute top-3 left-3 bg-[#eab308]/90 text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-sm z-10">
                    <Clock className="w-3 h-3" /> Pending
                  </div>
                );
                subtitleText += ` · Pending`;
              }

              return (
                <div key={row.evidenceId} className="bg-[#111a31]/80 backdrop-blur-sm rounded-xl p-3 border border-white/5 hover:border-white/20 transition-all group relative flex flex-col">
                  <div className="absolute top-4 right-4 z-20">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(row.evidenceId)}
                      className="w-4 h-4 rounded text-[#38bdf8] bg-black/50 border-white/20 cursor-pointer"
                    />
                  </div>

                  <Link to={`/investigation/${row.investigationId}`} className="block relative aspect-[4/3] rounded-lg overflow-hidden bg-[#090e17] mb-3">
                    <SecureImage 
                      investigationId={row.investigationId} 
                      evidenceId={row.evidenceId} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>
                    {badge}
                  </Link>

                  <div className="flex flex-col flex-1 px-1">
                    <h3 className="text-[14px] font-semibold text-white truncate mb-0.5" title={row.originalFilename}>
                      {row.originalFilename}
                    </h3>
                    <p className="text-[11px] text-[#8b9cb6] truncate" title={row.investigationTitle}>
                      {subtitleText}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
