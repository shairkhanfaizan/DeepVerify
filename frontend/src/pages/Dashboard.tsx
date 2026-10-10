import { useState, useEffect, useRef } from "react";
import { fetchApi } from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Upload, TrendingUp, CheckSquare, Bot, Folder, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { SecureImage } from "../components/ui/SecureImage";

interface AnalysisResultResponse {
  verdict: string;
  ensemble_score: number;
  created_at: string;
}

interface EvidenceItem {
  id: string;
  status: string;
  created_at: string;
  analysis_results?: AnalysisResultResponse[];
}

interface InvestigationListResponse {
  id: string;
  title: string;
  status: string;
  created_at: string;
  evidence_items?: EvidenceItem[];
}

export function Dashboard() {
  const { user } = useAuth();
  const [investigations, setInvestigations] = useState<InvestigationListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [timeframe, setTimeframe] = useState<7 | 14 | 30>(14);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileDrop = async (file: File) => {
    try {
      setCreating(true);
      const invData = await fetchApi("/api/v2/investigations/", {
        method: "POST",
        body: JSON.stringify({ title: "Quick Scan", notes: "Initiated from Dashboard upload" }),
      });
      const invId = invData.id;

      const formData = new FormData();
      formData.append("file", file);
      
      const evData = await fetchApi(`/api/v2/investigations/${invId}/evidence`, {
        method: "POST",
        body: formData,
      });
      
      if (evData.evidence_id) {
         navigate(`/investigation/${invId}/evidence/${evData.evidence_id}`);
      } else {
         navigate(`/investigation/${invId}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to initialize scan.");
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

  // Metrics Logic
  let photosChecked = 0;
  let lookedReal = 0;
  let likelyAi = 0;
  let notSure = 0;
  let casesWithPhotos = 0;
  
  // Data grouping for line chart
  const timeSeriesData: Record<string, { real: number, ai: number, notSure: number, timestamp: number }> = {};
  
  const now = new Date();
  const cutoffTime = now.getTime() - (timeframe * 24 * 60 * 60 * 1000);

  investigations.forEach(inv => {
    if (inv.evidence_items && inv.evidence_items.length > 0) {
      casesWithPhotos++;
      inv.evidence_items.forEach(ev => {
        if (ev.status === "COMPLETED" && ev.analysis_results && ev.analysis_results.length > 0) {
          photosChecked++;
          const result = ev.analysis_results[0];
          const score = result.ensemble_score;
          
          // UI display convention mapping; score boundaries are descriptive, not scientifically absolute
          let cat: "real" | "ai" | "notSure";
          if (score >= 0.6) {
            lookedReal++;
            cat = "real";
          } else if (score <= 0.4) {
            likelyAi++;
            cat = "ai";
          } else {
            notSure++;
            cat = "notSure";
          }

          // Track for chart by day, using actual analysis completion time if available
          const resultTime = result.created_at ? new Date(result.created_at) : new Date(ev.created_at || inv.created_at);
          
          if (resultTime.getTime() >= cutoffTime) {
            const dateStr = resultTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!timeSeriesData[dateStr]) {
              timeSeriesData[dateStr] = { real: 0, ai: 0, notSure: 0, timestamp: new Date(resultTime.getFullYear(), resultTime.getMonth(), resultTime.getDate()).getTime() };
            }
            timeSeriesData[dateStr][cat]++;
          }
        }
      });
    }
  });

  const totalCases = investigations.length;
  const realPercentage = photosChecked > 0 ? Math.round((lookedReal / photosChecked) * 100) : 0;
  const aiPercentage = photosChecked > 0 ? Math.round((likelyAi / photosChecked) * 100) : 0;

  // Donut chart logic (SVG)
  const donutSize = 140;
  const strokeWidth = 16;
  const radius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const totalAnalyzed = (lookedReal + likelyAi + notSure) || 1;
  const realRatio = lookedReal / totalAnalyzed;
  const notSureRatio = notSure / totalAnalyzed;
  const aiRatio = likelyAi / totalAnalyzed;
  
  const realLen = realRatio * circumference;
  const notSureLen = notSureRatio * circumference;
  const aiLen = aiRatio * circumference;
  
  const realDasharray = `${realLen} ${circumference}`;
  const notSureDasharray = `${notSureLen} ${circumference}`;
  const aiDasharray = `${aiLen} ${circumference}`;
  
  const realOffset = 0;
  const notSureOffset = -realLen;
  const aiOffset = -(realLen + notSureLen);

  // Bottom sections logic
  const busiestCases = [...investigations]
    .map(inv => ({
      name: inv.title || "Untitled",
      count: (inv.evidence_items || []).length
    }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const maxBusiest = Math.max(1, ...busiestCases.map(c => c.count));

  const allEvidence = investigations.flatMap(inv => 
    (inv.evidence_items || []).filter(ev => ev.status === "COMPLETED").map(ev => ({
      ...ev,
      investigation: inv
    }))
  );
  allEvidence.sort((a, b) => {
    const timeA = a.analysis_results?.[0]?.created_at || a.created_at;
    const timeB = b.analysis_results?.[0]?.created_at || b.created_at;
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });
  const latestChecks = allEvidence.slice(0, 3);

  const timeAgo = (dateStr: string) => {
    const diffMs = new Date().getTime() - new Date(dateStr).getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${Math.max(1, diffMins)} min ago`;
    const diffHrs = Math.round(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} hours ago`;
    return `${Math.round(diffHrs / 24)} days ago`;
  };

  // Line chart logic
  const sortedDates = Object.keys(timeSeriesData).sort((a, b) => timeSeriesData[a].timestamp - timeSeriesData[b].timestamp);
  
  let realPath = "";
  let aiPath = "";
  let notSurePath = "";
  let xLabels = sortedDates;
  
  let maxValForChart = 4;
  if (sortedDates.length > 0) {
    maxValForChart = Math.max(4, ...sortedDates.map(d => Math.max(timeSeriesData[d].real, timeSeriesData[d].ai, timeSeriesData[d].notSure)));
    const yRatio = 140 / maxValForChart;
    
    if (sortedDates.length === 1) {
      const metrics = timeSeriesData[sortedDates[0]];
      const realY = 140 - (metrics.real * yRatio);
      const aiY = 140 - (metrics.ai * yRatio);
      const notSureY = 140 - (metrics.notSure * yRatio);
      
      realPath = `0,${realY} 100,${realY}`;
      aiPath = `0,${aiY} 100,${aiY}`;
      notSurePath = `0,${notSureY} 100,${notSureY}`;
      
      xLabels = ["", sortedDates[0], ""];
    } else {
      const xStep = 100 / (sortedDates.length - 1);
      
      sortedDates.forEach((date, i) => {
        const x = i * xStep;
        const metrics = timeSeriesData[date];
        
        const realY = 140 - (metrics.real * yRatio);
        const aiY = 140 - (metrics.ai * yRatio);
        const notSureY = 140 - (metrics.notSure * yRatio);
        
        const prefix = i === 0 ? "" : " ";
        realPath += `${prefix}${x},${realY}`;
        aiPath += `${prefix}${x},${aiY}`;
        notSurePath += `${prefix}${x},${notSureY}`;
      });
    }
  }

  const yLabels = [];
  for (let i = 4; i >= 0; i--) {
    yLabels.push(Math.round((maxValForChart / 4) * i));
  }

  const firstName = user?.email?.split('@')[0] || "Faizan";

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0b1426] text-white">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept="image/jpeg, image/png, image/webp" 
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[15px] font-semibold text-[#8b9cb6]">Home</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"></span>
            <span className="text-[12px] font-medium text-[#22c55e]">Scanner ready</span>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={creating}
            className="flex items-center gap-2 bg-[#38bdf8] text-[#090e17] px-4 py-1.5 rounded text-[13px] font-bold hover:bg-[#7dd3fc] transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Check a photo
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        
        {/* Top Hero Section */}
        <div className="bg-[#111a31] rounded-2xl p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 border border-white/5">
          <div className="flex flex-col justify-center">
            <div className="inline-flex items-center gap-1.5 bg-[#1e3a8a]/30 text-[#38bdf8] text-[11px] font-bold px-3 py-1 rounded-full w-fit mb-4 border border-[#38bdf8]/20">
              <span className="text-[12px]">✨</span> AI PHOTO DETECTIVE
            </div>
            
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
              Good morning, <span className="text-[#38bdf8]">{firstName}</span> 👋
            </h2>
            
            <p className="text-[#8b9cb6] text-[15px] leading-relaxed mb-6 max-w-md">
              Got a photo you're not sure about? Drop it in and we'll tell you if it looks real or AI-made – in about 10 seconds.
            </p>
            
            <div className="bg-[#17254a] border border-[#1e3a8a] rounded-lg p-3 text-[13px] text-[#b0c4de] flex items-start gap-2">
              <span className="text-[14px]">💡</span>
              <p>
                <strong className="text-white font-semibold">Tip:</strong> AI faces often get ears, teeth and earrings slightly wrong. Zoom in on them!
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-center">
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-w-md border-[2px] border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors group ${
                isDragging ? "border-[#38bdf8] bg-[#38bdf8]/10" : "border-[#1e3a8a] hover:border-[#38bdf8] bg-[#0a1128]"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-[#38bdf8] flex items-center justify-center text-[#090e17] group-hover:scale-110 transition-transform">
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              </div>
              <div className="text-center">
                <p className="text-[15px] font-semibold text-white mb-1">Drop a photo here</p>
                <p className="text-[12px] text-[#8b9cb6]">or click to browse · JPG, PNG, WebP</p>
              </div>
              <button disabled={creating} className="mt-2 bg-[#38bdf8] text-[#090e17] px-6 py-2 rounded-full text-[13px] font-bold">
                Choose a photo
              </button>
            </div>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111a31] rounded-xl p-5 border border-white/5 flex flex-col justify-between h-[110px]">
            <div className="flex items-start justify-between">
              <span className="text-[13px] text-[#8b9cb6] font-medium">Photos checked</span>
              <div className="w-7 h-7 rounded-lg bg-[#1e3a8a]/40 flex items-center justify-center text-[#38bdf8]">
                <Upload className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">{loading ? '-' : photosChecked}</div>
              <div className="flex items-center gap-1 text-[11px] text-[#22c55e] mt-1 font-medium">
                <TrendingUp className="w-3 h-3" />
                <span>1 vs last week</span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#111a31] rounded-xl p-5 border border-white/5 flex flex-col justify-between h-[110px]">
            <div className="flex items-start justify-between">
              <span className="text-[13px] text-[#8b9cb6] font-medium">Looked real</span>
              <div className="w-7 h-7 rounded-lg bg-[#22c55e]/20 flex items-center justify-center text-[#22c55e]">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">{loading ? '-' : lookedReal}</div>
              <div className="text-[11px] text-[#8b9cb6] mt-1">
                {realPercentage}% of your photos
              </div>
            </div>
          </div>
          
          <div className="bg-[#111a31] rounded-xl p-5 border border-white/5 flex flex-col justify-between h-[110px]">
            <div className="flex items-start justify-between">
              <span className="text-[13px] text-[#8b9cb6] font-medium">Likely AI-made</span>
              <div className="w-7 h-7 rounded-lg bg-[#ec4899]/20 flex items-center justify-center text-[#ec4899]">
                <Bot className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">{loading ? '-' : likelyAi}</div>
              <div className="text-[11px] text-[#8b9cb6] mt-1">
                {aiPercentage}% of your photos
              </div>
            </div>
          </div>
          
          <div className="bg-[#111a31] rounded-xl p-5 border border-white/5 flex flex-col justify-between h-[110px]">
            <div className="flex items-start justify-between">
              <span className="text-[13px] text-[#8b9cb6] font-medium">Cases</span>
              <div className="w-7 h-7 rounded-lg bg-[#eab308]/20 flex items-center justify-center text-[#eab308]">
                <Folder className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">{loading ? '-' : totalCases}</div>
              <div className="text-[11px] text-[#8b9cb6] mt-1">
                {casesWithPhotos} with photos
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
          
          {/* Line Chart */}
          <div className="bg-[#111a31] rounded-xl p-6 border border-white/5 flex flex-col">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h3 className="text-[15px] font-semibold">Real vs AI over time</h3>
                <p className="text-[12px] text-[#8b9cb6] mt-0.5">Scans completed by timeframe</p>
              </div>
              <div className="flex items-center gap-2 bg-[#090e17] p-1 rounded-md border border-white/5">
                <button 
                  onClick={() => setTimeframe(7)}
                  className={`px-3 py-1 text-[11px] font-medium transition-colors ${timeframe === 7 ? 'bg-[#1e3a8a] text-white rounded' : 'text-[#8b9cb6] hover:text-white'}`}
                >7 days</button>
                <button 
                  onClick={() => setTimeframe(14)}
                  className={`px-3 py-1 text-[11px] font-medium transition-colors ${timeframe === 14 ? 'bg-[#1e3a8a] text-white rounded' : 'text-[#8b9cb6] hover:text-white'}`}
                >14 days</button>
                <button 
                  onClick={() => setTimeframe(30)}
                  className={`px-3 py-1 text-[11px] font-medium transition-colors ${timeframe === 30 ? 'bg-[#1e3a8a] text-white rounded' : 'text-[#8b9cb6] hover:text-white'}`}
                >30 days</button>
              </div>
            </div>
            
            <div className="flex-1 relative min-h-[160px] w-full mt-auto">
              <div className="absolute inset-0 flex flex-col justify-between pb-6">
                {yLabels.map((val, idx) => (
                  <div key={idx} className="w-full flex items-center gap-3">
                    <span className="text-[10px] text-[#475569] w-4 text-right">{val}</span>
                    <div className="flex-1 border-b border-[#1e293b]/40"></div>
                  </div>
                ))}
              </div>
              
              <div className="absolute inset-0 left-6 bottom-6">
                {sortedDates.length > 0 ? (
                  <svg width="100%" height="100%" viewBox="0 0 100 140" preserveAspectRatio="none">
                    <polyline points={realPath} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />
                    <polyline points={notSurePath} fill="none" stroke="#eab308" strokeWidth="2" strokeLinejoin="round" />
                    <polyline points={aiPath} fill="none" stroke="#ec4899" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#8b9cb6] text-[13px]">
                    No historical scan data available.
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-0 left-6 right-0 flex justify-between text-[9px] text-[#475569]">
                {xLabels.map((label, idx) => (
                  <span key={idx}>{label}</span>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-6 text-[11px] font-medium">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22c55e]"></span><span className="text-[#8b9cb6]">Looks real</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#eab308]"></span><span className="text-[#8b9cb6]">Not sure</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ec4899]"></span><span className="text-[#8b9cb6]">Likely AI-made</span></div>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="bg-[#111a31] rounded-xl p-6 border border-white/5 flex flex-col justify-between min-h-[280px]">
            <div>
              <h3 className="text-[15px] font-semibold">What we found</h3>
              <p className="text-[12px] text-[#8b9cb6] mt-0.5">Share of all your results</p>
            </div>
            
            <div className="flex-1 flex flex-col justify-center items-center py-4 relative">
              {photosChecked > 0 ? (
                <>
                  <svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
                    <circle cx={donutSize/2} cy={donutSize/2} r={radius} fill="transparent" stroke="#1e293b" strokeWidth={strokeWidth} />
                    
                    <circle 
                      cx={donutSize/2} cy={donutSize/2} r={radius} 
                      fill="transparent" stroke="#22c55e" strokeWidth={strokeWidth} 
                      strokeDasharray={realDasharray}
                      strokeDashoffset={realOffset}
                      transform={`rotate(-90 ${donutSize/2} ${donutSize/2})`}
                      className="transition-all duration-1000 ease-out"
                    />
                    <circle 
                      cx={donutSize/2} cy={donutSize/2} r={radius} 
                      fill="transparent" stroke="#eab308" strokeWidth={strokeWidth} 
                      strokeDasharray={notSureDasharray}
                      strokeDashoffset={notSureOffset}
                      transform={`rotate(-90 ${donutSize/2} ${donutSize/2})`}
                      className="transition-all duration-1000 ease-out"
                    />
                    <circle 
                      cx={donutSize/2} cy={donutSize/2} r={radius} 
                      fill="transparent" stroke="#ec4899" strokeWidth={strokeWidth} 
                      strokeDasharray={aiDasharray}
                      strokeDashoffset={aiOffset}
                      transform={`rotate(-90 ${donutSize/2} ${donutSize/2})`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold leading-none">{photosChecked}</span>
                    <span className="text-[11px] text-[#8b9cb6] mt-1">photos</span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#8b9cb6] text-[13px]">
                  No scans yet.
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2.5 mt-2">
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#22c55e]"></span><span className="text-[#8b9cb6]">Looks real</span></div>
                <span className="font-semibold">{lookedReal}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#eab308]"></span><span className="text-[#8b9cb6]">Not sure</span></div>
                <span className="font-semibold">{notSure}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#ec4899]"></span><span className="text-[#8b9cb6]">Likely AI-made</span></div>
                <span className="font-semibold">{likelyAi}</span>
              </div>
            </div>
          </div>
          
        </div>

        {/* Third Row: Busiest Cases & Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#111a31] rounded-xl p-6 border border-white/5 flex flex-col min-h-[220px]">
            <div>
              <h3 className="text-[15px] font-semibold">Busiest cases</h3>
              <p className="text-[12px] text-[#8b9cb6] mt-0.5">Which cases have the most photos</p>
            </div>
            
            <div className="flex-1 flex items-stretch justify-center gap-8 pt-6 pb-2">
              {busiestCases.length > 0 ? (
                busiestCases.map((c, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center h-full group">
                    <span className="text-[11px] font-semibold text-white mb-2">{c.count}</span>
                    <div className="relative w-full max-w-[50px] flex-1 flex flex-col items-center">
                      <div 
                        className="absolute bottom-0 w-full bg-[#38bdf8] rounded-t-md transition-all duration-1000"
                        style={{ height: `${Math.max(5, (c.count / maxBusiest) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[11px] text-[#8b9cb6] truncate w-full text-center px-1 mt-2">
                      {c.name}
                    </span>
                  </div>
                ))
              ) : (
                <div className="w-full h-full flex flex-col justify-center items-center text-[#8b9cb6] text-[13px] pb-4">
                  <p>No active cases</p>
                </div>
              )}
            </div>
            
            {/* Axis line */}
            <div className="w-full border-t border-[#1e293b] mt-auto"></div>
          </div>

          <div className="bg-[#111a31] rounded-xl p-6 border border-white/5 flex flex-col min-h-[220px]">
            <div>
              <h3 className="text-[15px] font-semibold">Which tools you use</h3>
              <p className="text-[12px] text-[#8b9cb6] mt-0.5">Every scan runs two checks. The AI Helper answers your questions.</p>
            </div>
            
            <div className="flex-1 flex flex-col justify-center gap-5 mt-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[12px]">
                  <span className="font-medium">Pixel Check <span className="text-[#8b9cb6] font-normal">- looks at tiny details</span></span>
                  <span className="font-semibold">{photosChecked}</span>
                </div>
                <div className="w-full h-1.5 bg-[#090e17] rounded-full overflow-hidden">
                  <div className="h-full bg-[#38bdf8]" style={{ width: photosChecked > 0 ? '100%' : '0%' }}></div>
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[12px]">
                  <span className="font-medium">Pattern Check <span className="text-[#8b9cb6] font-normal">- hunts repeating patterns</span></span>
                  <span className="font-semibold">{photosChecked}</span>
                </div>
                <div className="w-full h-1.5 bg-[#090e17] rounded-full overflow-hidden">
                  <div className="h-full bg-[#38bdf8]" style={{ width: photosChecked > 0 ? '100%' : '0%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fourth Row: Latest Checks */}
        <div className="bg-[#111a31] rounded-xl p-6 border border-white/5 flex flex-col">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-[15px] font-semibold">Latest checks</h3>
              <p className="text-[12px] text-[#8b9cb6] mt-0.5">Your most recent photos</p>
            </div>
            <Link to="/vault" className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#090e17] border border-white/5 px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors">
              See all photos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {latestChecks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-[#1e293b] text-[11px] text-[#8b9cb6]">
                    <th className="pb-3 font-medium">Photo</th>
                    <th className="pb-3 font-medium">Case</th>
                    <th className="pb-3 font-medium">Checked on</th>
                    <th className="pb-3 font-medium">Result</th>
                    <th className="pb-3 font-medium text-right pr-4">AI chance</th>
                  </tr>
                </thead>
                <tbody>
                  {latestChecks.map((ev) => {
                    const result = ev.analysis_results?.[0];
                    const score = result?.ensemble_score || 0;
                    
                    let verdictText = "Not sure";
                    let verdictColorClass = "text-[#eab308] bg-[#eab308]/10 border-[#eab308]/20";
                    let dotColor = "bg-[#eab308]";
                    
                    if (score >= 0.6) {
                      verdictText = "Looks real";
                      verdictColorClass = "text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20";
                      dotColor = "bg-[#22c55e]";
                    } else if (score <= 0.4) {
                      verdictText = "Likely AI-made";
                      verdictColorClass = "text-[#ec4899] bg-[#ec4899]/10 border-[#ec4899]/20";
                      dotColor = "bg-[#ec4899]";
                    }
                    
                    const time = result?.created_at || ev.created_at;
                    const dateFormatted = new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    
                    // Predict AI chance: low score = high AI chance.
                    const aiChance = Math.round((1 - score) * 100);

                    return (
                      <tr key={ev.id} className="border-b border-[#1e293b] last:border-0 hover:bg-[#090e17]/50 transition-colors group">
                        <td className="py-4">
                          <Link to={`/investigation/${ev.investigation.id}/evidence/${ev.id}`} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-[#090e17] border border-white/5 flex-shrink-0 relative">
                              <SecureImage investigationId={ev.investigation.id} evidenceId={ev.id} alt="Thumbnail" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                            </div>
                            <span className="text-[13px] font-semibold text-white group-hover:text-[#38bdf8] transition-colors line-clamp-1">{ev.investigation.title} - Photo</span>
                          </Link>
                        </td>
                        <td className="py-4 text-[12px] text-[#b0c4de]">{ev.investigation.title}</td>
                        <td className="py-4">
                          <div className="flex flex-col">
                            <span className="text-[12px] text-[#b0c4de]">{dateFormatted}</span>
                            <span className="text-[10px] text-[#8b9cb6]">{timeAgo(time)}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${verdictColorClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                            {verdictText}
                          </div>
                        </td>
                        <td className="py-4 text-right pr-4 text-[13px] font-semibold">
                          {aiChance}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="w-full py-10 flex flex-col items-center justify-center text-[#8b9cb6] text-[13px]">
              <p>No recent scans found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
