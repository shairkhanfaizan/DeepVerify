import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { fetchApi } from "../services/api";
import { Loader2, ArrowLeftRight } from "lucide-react";
import { SecureImage } from "../components/ui/SecureImage";

export function InvestigationComparison() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const qEvA = searchParams.get("evA");

  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [leftInvId, setLeftInvId] = useState(id || "");
  const [leftEvId, setLeftEvId] = useState(qEvA || "");
  
  const [rightInvId, setRightInvId] = useState("");
  const [rightEvId, setRightEvId] = useState("");

  

  useEffect(() => {
    const load = async () => {
      try {
        const list = await fetchApi("/api/v2/investigations/");
        setInvestigations(list || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getResult = (invId: string, evId: string) => {
    const inv = investigations.find(i => i.id === invId);
    if (!inv) return null;
    const ev = inv.evidence_items?.find((e: any) => e.id === evId);
    if (!ev) return null;
    return { inv, ev, res: ev.analysis_results?.[0] };
  };

  const leftData = getResult(leftInvId, leftEvId);
  const rightData = getResult(rightInvId, rightEvId);
  
  const getScore = (res: any) => {
    if (!res) return 0;
    const authScore = res.ensemble_score ?? (res.verdict === "LIKELY_AI_GENERATED" ? 0.11 : 0.66);
    return Math.round((1 - authScore) * 100);
  };

  const leftScore = leftData?.res ? getScore(leftData.res) : null;
  const rightScore = rightData?.res ? getScore(rightData.res) : null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0B1120]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
      </div>
    );
  }

  
  const renderPhotoCard = (data: any, invId: string, evId: string, setInv: any, setEv: any) => {
    return (
      <div className="flex-1 bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden shadow-xl flex flex-col">
        <div className="p-4 border-b border-[#1E293B] space-y-3 bg-[#0B1120]">
          <div className="relative">
            <select 
              className="w-full bg-[#111827] border border-[#1E293B] rounded-lg p-2.5 text-sm text-white appearance-none focus:outline-none focus:border-[#00E5FF] transition-colors"
              value={invId}
              onChange={e => { setInv(e.target.value); setEv(""); }}
            >
              <option value="">-- Choose a Case --</option>
              {investigations.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.title}</option>
              ))}
            </select>
            <div className="absolute right-3 top-3 w-4 h-4 text-gray-500 pointer-events-none">▼</div>
          </div>
          <div className="relative">
            <select 
              className="w-full bg-[#111827] border border-[#1E293B] rounded-lg p-2.5 text-sm text-white appearance-none focus:outline-none focus:border-[#00E5FF] transition-colors"
              value={evId}
              onChange={e => setEv(e.target.value)}
              disabled={!invId}
            >
              <option value="">-- Choose a Photo --</option>
              {invId && investigations.find(i => i.id === invId)?.evidence_items?.map((ev: any) => (
                <option key={ev.id} value={ev.id}>{ev.original_filename || `Image (${ev.id.slice(0,8)})`}</option>
              ))}
            </select>
            <div className="absolute right-3 top-3 w-4 h-4 text-gray-500 pointer-events-none">▼</div>
          </div>
        </div>
        
        {data ? (
          <>
            <div className="flex-1 min-h-[300px] bg-[#0B1120] relative">
              <SecureImage investigationId={data.inv.id} evidenceId={data.ev.id} className="w-full h-full object-contain absolute inset-0" />
            </div>
            
            {/* Extended Results Information */}
            <div className="p-4 bg-[#1E293B]/30 border-t border-[#1E293B]">
              <h4 className="text-sm font-semibold text-white mb-3">Analysis Results</h4>
              {data.res ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Verdict</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${data.res.verdict === 'LIKELY_AI_GENERATED' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      {data.res.verdict.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">AI Probability Score</span>
                    <span className="text-sm text-white font-mono">{((data.res.ensemble_score ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  
                  {data.ev.signals && data.ev.signals.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs text-gray-400 block mb-2">Detected Signals:</span>
                      <div className="space-y-2">
                        {data.ev.signals.map((sig: any) => (
                          <div key={sig.id} className="flex justify-between items-center bg-[#0B1120] p-2 rounded border border-[#1E293B]">
                            <span className="text-xs text-gray-300 truncate w-3/4">{sig.signal_type}</span>
                            <span className="text-xs text-[#00E5FF] font-mono">{parseFloat(sig.value).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {data.ev.observations && data.ev.observations.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs text-gray-400 block mb-2">File Observations:</span>
                      <div className="space-y-2">
                        {data.ev.observations.map((obs: any) => (
                          <div key={obs.id} className="flex justify-between items-center bg-[#0B1120] p-2 rounded border border-[#1E293B]">
                            <span className="text-xs text-gray-300">{obs.signal_type}</span>
                            <span className="text-xs text-gray-400">{obs.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">No analysis results available for this photo.</div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[380px] bg-[#0B1120]">
            <span className="text-sm text-gray-400 font-medium">Select a case and photo to view</span>
          </div>
        )}
      </div>
    );
  };

  // Determine result text
  let resultTitle = "";
  let resultSub = "";
  if (leftScore !== null && rightScore !== null) {
    if (leftScore > rightScore) {
      resultTitle = `Photo A looks more AI-made - ${leftScore}% vs ${rightScore}%.`;
    } else if (rightScore > leftScore) {
      resultTitle = `Photo B looks more AI-made - ${rightScore}% vs ${leftScore}%.`;
    } else {
      resultTitle = `Both photos have similar AI scores (${leftScore}%).`;
    }
    resultSub = "A bigger gap means a clearer difference.";
  }

  return (
    <div className="flex flex-col h-full bg-[#0B1120] text-gray-100 overflow-y-auto font-sans p-8">
      {/* Top Header */}
      <div className="px-6 py-4 flex items-center justify-between absolute top-0 right-0 left-0 bg-[#0B1120]/95 backdrop-blur z-10 border-b border-[#1E293B]">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Link to="/investigations" className="hover:text-white">Compare</Link>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-green-500 font-semibold">Scanner ready</span>
          </div>
          <button className="px-4 py-2 bg-[#00E5FF] text-black text-sm font-semibold rounded-lg hover:bg-[#00cce6] transition-colors">
            Check a photo
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto w-full mt-16 pb-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-3 tracking-tight">Compare Photos</h1>
          <p className="text-gray-400 max-w-2xl text-[15px] leading-relaxed">
            Put two photos side by side to see which one looks more AI-made - great for checking a suspicious photo against a real one.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          
          {/* Images Row */}
          <div className="flex flex-col md:flex-row gap-6">
            {renderPhotoCard(leftData, leftInvId, leftEvId, setLeftInvId, setLeftEvId)}
            {renderPhotoCard(rightData, rightInvId, rightEvId, setRightInvId, setRightEvId)}
          </div>

          {/* Result Banner */}
          {leftScore !== null && rightScore !== null && (
            <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-8 shadow-xl flex flex-col items-center text-center mt-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-[#00E5FF] to-purple-500"></div>
              <div className="bg-[#1E293B] text-blue-400 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4 inline-flex items-center gap-1.5 border border-[#334155]">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                RESULT
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{resultTitle}</h2>
              <p className="text-gray-400 text-sm">{resultSub}</p>
            </div>
          )}

          {/* Slide to compare */}
          {leftScore !== null && rightScore !== null && (
            <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 shadow-xl flex items-center justify-between mt-2">
              <span className="font-semibold text-white">Slide to compare</span>
              <button 
                className="px-4 py-2 bg-[#1E293B] hover:bg-[#2A3548] text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors border border-[#334155]"
                onClick={() => {
                  setLeftInvId(rightInvId);
                  setLeftEvId(rightEvId);
                  setRightInvId(leftInvId);
                  setRightEvId(leftEvId);
                }}
              >
                <ArrowLeftRight className="w-4 h-4" /> Swap A and B
              </button>
            </div>
          )}
          
        </div>
      </div>
      
    </div>
  );
}
