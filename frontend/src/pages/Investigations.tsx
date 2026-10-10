import { useState, useEffect } from "react";
import { fetchApi } from "../services/api";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Search, ChevronDown, Plus, Bot, CheckCircle, FolderSearch, AlertCircle } from "lucide-react";
import { SecureImage } from "../components/ui/SecureImage";
import { motion } from "framer-motion";

interface AnalysisResult {
  ensemble_score: number;
  verdict: string;
}
interface EvidenceItem {
  id: string;
  status: string;
  analysis_results?: AnalysisResult[];
}
interface InvestigationListResponse {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  evidence_items?: EvidenceItem[];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function Investigations() {
  const navigate = useNavigate();
  const [investigations, setInvestigations] = useState<InvestigationListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "HAS_AI" | "EMPTY">("ALL");
  const [sortBy, setSortBy] = useState<"updated" | "created">("updated");
  const [creating, setCreating] = useState(false);

  const loadInvestigations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi("/api/v2/investigations/");
      
      const detailedPromises = (data || []).map((inv: any) =>
        fetchApi(`/api/v2/investigations/${inv.id}`).catch(() => null)
      );
      const detailed = await Promise.all(detailedPromises);
      setInvestigations(detailed.filter(Boolean));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load investigations";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestigations();
  }, []);

  const handleNewCase = async () => {
    const title = window.prompt("Enter a name for the new case:", "New Investigation");
    if (title === null) return;

    try {
      setCreating(true);
      const invData = await fetchApi("/api/v2/investigations/", {
        method: "POST",
        body: JSON.stringify({ title: title.trim() || "Untitled Case" })
      });
      if (invData && invData.id) {
        navigate(`/investigation/${invData.id}`);
      } else {
        throw new Error("Failed to retrieve new case ID");
      }
    } catch (err) {
      alert("Failed to create case. Please try again.");
      setCreating(false);
    }
  };

  const filteredInvestigations = investigations.filter(inv => {
    const matchesSearch = (inv.title || "").toLowerCase().includes((searchQuery || "").toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === "HAS_AI") {
      matchesStatus = (inv.evidence_items || []).some(ev => 
        ev.status === "COMPLETED" && 
        ev.analysis_results?.[0]?.verdict === "LIKELY_AI_GENERATED"
      );
    } else if (statusFilter === "EMPTY") {
      const activeItems = (inv.evidence_items || []).filter(ev => ev.status !== "FAILED");
      matchesStatus = activeItems.length === 0;
    }
    
    return matchesSearch && matchesStatus;
  });

  const sortedInvestigations = [...filteredInvestigations].sort((a, b) => {
    if (sortBy === "updated") {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#090e17] text-white">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1440px] mx-auto w-full px-8 md:px-12 pt-8 pb-16 flex flex-col"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-[13px] font-semibold text-white mb-2">My Cases</h1>
            <h2 className="text-[36px] font-bold text-white mb-3 leading-none tracking-tight">My <span className="text-[#38bdf8]">Cases</span></h2>
            <p className="text-[13px] text-[#8b9cb6] max-w-[500px] leading-relaxed">
              A case is a folder for photos you want to check together – like "Fake news hunt" or "Is this profile real?"
            </p>
          </div>
          <button 
            onClick={handleNewCase}
            disabled={creating}
            className={`flex items-center gap-2 px-5 py-2.5 border border-[#38bdf8] text-[#38bdf8] rounded-full text-[13px] font-semibold hover:bg-[#38bdf8]/10 transition-colors shrink-0 ${creating ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? "Creating..." : "New case"}
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 mb-10 border-b border-white/5 pb-6">
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb6]" />
            <input 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full bg-[#111a31]/50 border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-[13px] text-white placeholder-[#8b9cb6] outline-none focus:border-[#38bdf8]/50 transition-colors"
               placeholder="Search your cases..."
            />
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            <button 
               onClick={() => setStatusFilter("ALL")}
               className={`px-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${statusFilter === "ALL" ? "border border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/5" : "bg-[#111a31]/80 text-[#8b9cb6] hover:text-white"}`}
            >All</button>
            <button 
               onClick={() => setStatusFilter("HAS_AI")}
               className={`px-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${statusFilter === "HAS_AI" ? "border border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/5" : "bg-[#111a31]/80 text-[#8b9cb6] hover:text-white"}`}
            >Has AI-made photos</button>
            <button 
               onClick={() => setStatusFilter("EMPTY")}
               className={`px-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${statusFilter === "EMPTY" ? "border border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/5" : "bg-[#111a31]/80 text-[#8b9cb6] hover:text-white"}`}
            >Empty</button>
            <div className="flex-1"></div>
            <button 
               onClick={() => setSortBy(s => s === "updated" ? "created" : "updated")}
               className="px-4 py-1.5 rounded-full text-[12px] bg-[#111a31]/80 text-[#8b9cb6] hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap ml-auto"
            >
              {sortBy === "updated" ? "Recently updated" : "Recently created"} <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#8b9cb6] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#38bdf8]" />
            <span className="text-[13px]">Loading your cases...</span>
          </div>
        ) : error ? (
          <div className="py-24 text-center text-[#ef4444] flex flex-col items-center">
            <AlertCircle className="h-10 w-10 mb-3 opacity-80" />
            <p className="text-[14px]">{error}</p>
            <button 
              className="mt-6 px-4 py-2 border border-[#ef4444] text-[#ef4444] rounded hover:bg-[#ef4444]/10 transition-colors text-[13px]" 
              onClick={loadInvestigations}
            >
              Retry
            </button>
          </div>
        ) : sortedInvestigations.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl bg-[#111a31]/30">
            <div className="mx-auto w-12 h-12 bg-[#111a31] rounded-full flex items-center justify-center mb-4">
              <FolderSearch className="h-5 w-5 text-[#8b9cb6]" />
            </div>
            <h3 className="text-[15px] font-semibold text-white mb-2">No cases found</h3>
            <p className="text-[#8b9cb6] text-[13px] max-w-sm mx-auto mb-6">
              Create a new case to start organizing your investigations, or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedInvestigations.map((inv) => {
              const evidenceItems = inv.evidence_items || [];
              let real = 0, ai = 0, pending = 0, failed = 0;
              
              evidenceItems.forEach(ev => {
                if (ev.status === "COMPLETED" && ev.analysis_results && ev.analysis_results.length > 0) {
                  const verdict = ev.analysis_results[0].verdict;
                  if (verdict === "LIKELY_AI_GENERATED") {
                    ai++;
                  } else if (verdict === "LIKELY_AUTHENTIC") {
                    real++;
                  }
                } else if (ev.status === "FAILED") {
                  failed++;
                } else {
                  pending++;
                }
              });

              const total = evidenceItems.length;
              const completed = real + ai;

              return (
                <Link to={`/investigation/${inv.id}`} key={inv.id} className="bg-[#111a31]/80 backdrop-blur-sm rounded-2xl p-5 border border-white/5 hover:border-white/10 hover:bg-[#111a31] transition-all group flex flex-col min-h-[220px]">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="text-[15px] font-semibold text-white truncate group-hover:text-[#38bdf8] transition-colors" title={inv.title}>
                      {inv.title || "Untitled Case"}
                    </h3>
                    {ai > 0 ? (
                      <div className="bg-[#ec4899]/10 text-[#ec4899] px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <Bot className="w-3 h-3" /> {ai} AI
                      </div>
                    ) : total > 0 ? (
                      pending > 0 && completed === 0 ? (
                        <div className="bg-[#eab308]/10 text-[#eab308] px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shrink-0">
                          <Loader2 className="w-3 h-3 animate-spin" /> Awaiting results
                        </div>
                      ) : pending > 0 && completed > 0 ? (
                        <div className="bg-[#eab308]/10 text-[#eab308] px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shrink-0">
                          <Loader2 className="w-3 h-3 animate-spin" /> Partial results
                        </div>
                      ) : completed > 0 ? (
                        <div className="bg-[#22c55e]/10 text-[#22c55e] px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shrink-0">
                          <CheckCircle className="w-3 h-3" /> All clear
                        </div>
                      ) : failed > 0 ? (
                        <div className="bg-[#ef4444]/10 text-[#ef4444] px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shrink-0">
                          <AlertCircle className="w-3 h-3" /> Failed
                        </div>
                      ) : null
                    ) : null}
                  </div>

                  <p className="text-[12.5px] text-[#8b9cb6] mb-6 line-clamp-2 min-h-[36px]">
                    {inv.description || "No description provided for this case."}
                  </p>

                  <div className="flex gap-2 mb-3">
                    {evidenceItems.slice(0, 4).map((evidence) => (
                      <div key={evidence.id} className="w-[52px] h-[52px] rounded-[10px] bg-[#090e17] overflow-hidden border border-white/5 shrink-0 relative">
                        <SecureImage 
                          investigationId={inv.id} 
                          evidenceId={evidence.id} 
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                      </div>
                    ))}
                    {evidenceItems.length > 4 && (
                      <div className="w-[52px] h-[52px] rounded-[10px] bg-[#1e293b]/40 text-[#8b9cb6] border border-white/5 text-[12px] flex items-center justify-center font-medium shrink-0">
                        +{evidenceItems.length - 4}
                      </div>
                    )}
                    {evidenceItems.length === 0 && (
                      <div className="w-full h-[52px] flex items-center text-[12px] text-[#475569] italic">
                        Empty case
                      </div>
                    )}
                  </div>

                  {total > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-[#090e17] flex overflow-hidden mb-4">
                      {pending > 0 && <div style={{ width: `${(pending/total)*100}%` }} className="h-full bg-[#38bdf8]" />}
                      {real > 0 && <div style={{ width: `${(real/total)*100}%` }} className="h-full bg-[#22c55e]" />}
                      {ai > 0 && <div style={{ width: `${(ai/total)*100}%` }} className="h-full bg-[#ec4899]" />}
                      {failed > 0 && <div style={{ width: `${(failed/total)*100}%` }} className="h-full bg-[#ef4444]" />}
                    </div>
                  )}
                  {total === 0 && <div className="h-1.5 mb-4"></div>}

                  <div className="flex items-end justify-between mt-auto">
                    <div>
                      <div className="text-[12px] text-[#8b9cb6]">{total} {total === 1 ? 'photo' : 'photos'}</div>
                      <div className="text-[11px] text-[#475569] mt-0.5">Started {formatDate(inv.created_at)}</div>
                    </div>
                    <div className="text-[11px] text-[#fbbf24]">
                      Updated {timeAgo(inv.updated_at)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
