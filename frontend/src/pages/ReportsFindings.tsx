import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchApi, API_BASE } from "../services/api";
import { 
  Loader2, 
  Share2,
  Download,
  Printer,
  ChevronDown
} from "lucide-react";

export function ReportsFindings() {
  const { id: routeId } = useParams<{ id?: string }>();
  
  const [investigationsList, setInvestigationsList] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(routeId || "");
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    const loadList = async () => {
      try {
        setLoading(true);
        const data = await fetchApi("/api/v2/investigations/");
        setInvestigationsList(data || []);
        if (!selectedCaseId && data && data.length > 0) {
          setSelectedCaseId(data[0].id);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load investigations archive";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    loadList();
  }, []);

  useEffect(() => {
    if (!selectedCaseId) return;

    const loadDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchApi(`/api/v2/investigations/${selectedCaseId}`);
        setCaseData(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load case data";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [selectedCaseId]);

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
      a.download = `Report_${selectedCaseId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!caseData || !caseData.evidence_items) return;
    
    const headers = ["ID", "Filename", "Status", "AI_Probability", "Verdict"];
    const rows = caseData.evidence_items.map((item: any) => {
      const authScore = item.analysis_results?.[0]?.ensemble_score || 0;
      const aiChance = Math.round((1 - authScore) * 100);
      let verdict = "Real";
      if (aiChance >= 60) verdict = "AI-made";
      else if (aiChance >= 40) verdict = "Not Sure";
      
      const filename = item.original_filename || `Image_${item.id.slice(0,8)}`;
      // Escape filename in case it has commas
      const escapedFilename = `"${filename.replace(/"/g, '""')}"`;
      
      return [
        item.id,
        escapedFilename,
        item.status,
        `${aiChance}%`,
        verdict
      ];
    });
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Report_${selectedCaseId.slice(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  if (loading && !caseData) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px] bg-[#0B0F19]">
        <Loader2 className="h-8 w-8 text-[#38BDF8] animate-spin" />
      </div>
    );
  }

  const items = caseData?.evidence_items || [];
  
  // Only include items that have been fully analyzed
  const completedItems = items.filter((item: any) => item.status === "COMPLETED");

  // Calculate metrics
  const totalPhotos = completedItems.length;
  let aiMadeCount = 0;
  let notSureCount = 0;
  let lookRealCount = 0;
  
  const processedItems = completedItems.map((item: any) => {
    const authScore = item.analysis_results?.[0]?.ensemble_score || 0;
    // ensemble_score is authenticity (higher is more real). We want AI chance (higher is more AI).
    const aiChance = Math.round((1 - authScore) * 100);
    const name = item.original_filename || `Image (${item.id.slice(0,8)})`;

    if (aiChance >= 60) aiMadeCount++;
    else if (aiChance >= 40) notSureCount++;
    else lookRealCount++;

    return { id: item.id, name, percentage: aiChance, originalStatus: item.status };
  }).sort((a: any, b: any) => b.percentage - a.percentage); // Sort descending by AI chance

  const mostSuspicious = processedItems.length > 0 ? processedItems[0] : null;

  const realPct = totalPhotos ? (lookRealCount / totalPhotos) * 100 : 0;
  const notSurePct = totalPhotos ? (notSureCount / totalPhotos) * 100 : 0;

  // Donut chart CSS conic-gradient string
  const conicGradient = `conic-gradient(
    #22C55E 0% ${realPct}%, 
    #F59E0B ${realPct}% ${realPct + notSurePct}%, 
    #EF4444 ${realPct + notSurePct}% 100%
  )`;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-6 md:p-10 font-sans">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        {/* Main Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-gray-400 text-sm mb-1 font-medium tracking-wide">Reports</div>
            <h1 className="text-4xl font-bold text-[#38BDF8] tracking-tight mb-2">Reports</h1>
            <p className="text-gray-400 text-base max-w-2xl">
              A tidy summary of a case that you can print, save as a PDF, or share with your teacher or friends.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-[#111827] border border-[#1E293B] px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              <span className="text-sm font-medium text-gray-300">Scanner ready</span>
            </div>
            <Link to="/dashboard" className="bg-[#00F0FF] hover:bg-[#00D0E0] text-black font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              ↑ Check a photo
            </Link>
          </div>
        </div>

        {/* Case Selector & Export Toolbar Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111827] border border-[#1E293B] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 font-medium whitespace-nowrap">Report for case:</span>
            <div className="relative">
              <select 
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="appearance-none bg-[#0B0F19] border border-[#1E293B] text-white px-4 py-2 pr-10 rounded-lg focus:outline-none focus:border-[#38BDF8] font-medium"
              >
                {investigationsList.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.title}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleShareLink} className="flex items-center gap-2 bg-transparent border border-[#1E293B] hover:bg-[#1E293B] text-white px-4 py-2 rounded-lg font-medium transition-colors">
              <Share2 className="w-4 h-4" />
              {copiedShare ? "Copied" : "Copy summary"}
            </button>
            <button onClick={handleDownloadCSV} className="flex items-center gap-2 bg-transparent border border-[#1E293B] hover:bg-[#1E293B] text-white px-4 py-2 rounded-lg font-medium transition-colors">
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <button onClick={handleDownloadPdf} disabled={downloadingPdf} className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg font-medium transition-colors">
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Print / Save as PDF
            </button>
          </div>
        </div>

        {/* Main Case Summary Card Container */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle blue top border accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent opacity-30"></div>

          {/* Case Title & Metadata Header */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
            <div>
              <div className="inline-block px-3 py-1 bg-[#1E293B] border border-[#38BDF8]/30 rounded-lg text-xs font-bold text-[#38BDF8] tracking-widest uppercase mb-4">
                DeepVerify Report
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">{caseData?.title || "Investigation Case"}</h2>
              <p className="text-gray-400 text-lg">{caseData?.description || "Photos for my college project."}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-right bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4">
              <div className="text-gray-500">Prepared by:</div>
              <div className="text-white font-medium">Faizan</div>
              
              <div className="text-gray-500">Generated:</div>
              <div className="text-white font-medium">{new Date().toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'numeric' })}</div>
              
              <div className="text-gray-500">Case started:</div>
              <div className="text-white font-medium">{caseData ? new Date(caseData.created_at).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : "N/A"}</div>
            </div>
          </div>

          {/* Executive Summary Banner */}
          <div className="bg-[#0B0F19] border border-[#7F1D1D] rounded-2xl p-6 mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#EF4444]"></div>
            <div className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">The Short Version</div>
            <div className="text-2xl md:text-3xl font-bold text-[#F87171] mb-2">
              {aiMadeCount} of {totalPhotos} photos look AI-made.
            </div>
            <div className="text-gray-300">
              Most suspicious photo: <span className="font-bold text-white">{mostSuspicious?.name || "None"}</span> {mostSuspicious ? `(${mostSuspicious.percentage}% chance of AI).` : ""}
            </div>
          </div>

          {/* 4 KPI Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-5 flex flex-col justify-between">
              <div className="text-gray-400 font-medium mb-3">Photos checked</div>
              <div className="text-4xl font-bold text-white">{totalPhotos}</div>
            </div>
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#22C55E]"></div>
              <div className="text-gray-400 font-medium mb-3">Look real</div>
              <div className="text-4xl font-bold text-white">{lookRealCount}</div>
            </div>
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#F59E0B]"></div>
              <div className="text-gray-400 font-medium mb-3">Not sure</div>
              <div className="text-4xl font-bold text-white">{notSureCount}</div>
            </div>
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#EF4444]"></div>
              <div className="text-gray-400 font-medium mb-3">AI-made</div>
              <div className="text-4xl font-bold text-white">{aiMadeCount}</div>
            </div>
          </div>

          {/* Detailed Breakdown Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-6">
            
            {/* Left: Progress Bars */}
            <div>
              <h3 className="text-lg font-bold text-white mb-6">AI chance for each photo</h3>
              <div className="space-y-6">
                {processedItems.length > 0 ? processedItems.map((item: any) => {
                  let barColor = "bg-[#22C55E]";
                  if (item.percentage >= 60) barColor = "bg-[#F43F5E]";
                  else if (item.percentage >= 40) barColor = "bg-[#F59E0B]";

                  return (
                    <div key={item.id}>
                      <div className="flex justify-between items-end mb-2">
                        <span className="font-medium text-gray-200 truncate pr-4">{item.name}</span>
                        <span className="font-bold text-white">{item.percentage}</span>
                      </div>
                      <div className="h-2 w-full bg-[#1E293B] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${item.percentage}%` }}></div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-gray-500 italic">No photos to display.</div>
                )}
              </div>
            </div>

            {/* Right: Donut Chart */}
            <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-[#1E293B] pt-6 md:pt-0 md:pl-8">
              <h3 className="text-lg font-bold text-white mb-6 w-full text-left">Overall mix</h3>
              <div className="relative w-48 h-48 flex items-center justify-center mb-6">
                {/* CSS Conic Gradient Donut */}
                <div 
                  className="absolute inset-0 rounded-full"
                  style={{ background: conicGradient }}
                ></div>
                {/* Inner cutout */}
                <div className="absolute inset-0 m-4 rounded-full bg-[#0B0F19] flex flex-col items-center justify-center shadow-inner">
                  <span className="text-5xl font-bold text-white">{totalPhotos}</span>
                  <span className="text-sm font-medium text-gray-400">photos</span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm font-medium text-gray-300">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#22C55E]"></span> Real</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#F59E0B]"></span> Not sure</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#EF4444]"></span> AI-made</div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
