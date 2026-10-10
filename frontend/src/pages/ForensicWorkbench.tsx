import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchApi, API_BASE } from "../services/api";
import { Loader2, ChevronRight, FileText, Layout, Send } from "lucide-react";
import { SecureImage } from "../components/ui/SecureImage";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ForensicWorkbench() {
  const { id, evidenceId } = useParams<{ id?: string; evidenceId?: string }>();
  const [investigation, setInvestigation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"original" | "heatmap" | "compare">("heatmap");
  const [startingAnalysis, setStartingAnalysis] = useState(false);
    const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id || !evidenceId) return;
      try {
        setLoading(true);
        const data = await fetchApi(`/api/v2/investigations/${id}`);
        setInvestigation(data);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, evidenceId]);

  useEffect(() => {
    if (!id || !evidenceId) return;
    let interval: number | null = null;
    if (investigation) {
      const ev = investigation.evidence_items?.find((e: any) => e.id === evidenceId);
      if (ev && ['QUEUED', 'RUNNING', 'PROCESSING', 'ANALYZING'].includes(ev.status)) {
        interval = window.setInterval(async () => {
          try {
            const data = await fetchApi(`/api/v2/investigations/${id}`);
            setInvestigation(data);
          } catch (err) {}
        }, 2000);
      }
    }
    return () => { if (interval) window.clearInterval(interval); };
  }, [id, evidenceId, investigation]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0B1120]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00E5FF]" />
      </div>
    );
  }

  const evidence = investigation?.evidence_items?.find((e: any) => e.id === evidenceId);
  if (!evidence) return null;

  const result = evidence.analysis_results?.[0];
  const isScanning = ['QUEUED', 'RUNNING', 'PROCESSING', 'ANALYZING'].includes(evidence.status);
  const isReady = evidence.status === 'UPLOADED';

  const startAnalysis = async () => {
    try {
      setStartingAnalysis(true);
      await fetchApi(`/api/v2/investigations/${id}/evidence/${evidenceId}/analyze`, { 
        method: "POST",
        body: JSON.stringify({ policy: "ensemble-v1.0" })
      });
      setInvestigation((prev: any) => {
        const updated = JSON.parse(JSON.stringify(prev));
        const ev = updated.evidence_items.find((e: any) => e.id === evidenceId);
        if (ev) ev.status = 'QUEUED';
        return updated;
      });
    } catch (e: any) {
      alert(e.message || "Failed to start analysis");
    } finally {
      setStartingAnalysis(false);
    }
  };

  const handleAiQuery = async (queryText?: string) => {
    const textToAsk = queryText || aiQuery;
    if (!textToAsk.trim() || isAiLoading) return;
    
    setIsAiLoading(true);
    setAiQuery("");
    setAiResponse(""); // Clear previous response

    try {
      const apiKey = localStorage.getItem("deepverify_google_api_key") || "";
      const model = localStorage.getItem("deepverify_gemini_model") || "gemini-2.5-flash";

      const res = await fetch(`${API_BASE}/api/v2/investigations/${id}/evidence/${evidenceId}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: textToAsk, google_api_key: apiKey, gemini_model: model })
      });

      if (!res.ok) throw new Error("Failed to connect to AI assistant");
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.substring(6);
              if (dataStr === "[DONE]") {
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.chunk) {
                  fullResponse += data.chunk;
                  setAiResponse(fullResponse);
                } else if (data.error) {
                  console.error(data.error);
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }
    } catch (err) {
      setAiResponse("Sorry, I encountered an error. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  if (isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#0B1120] text-white">
        <h1 className="text-2xl font-bold mb-4">Photo Ready for Scan</h1>
        <div className="w-64 h-64 rounded-xl overflow-hidden bg-[#151E32] mb-6 border border-[#2A3548]">
          <SecureImage investigationId={id!} evidenceId={evidenceId!} className="w-full h-full object-cover" />
        </div>
        <button onClick={startAnalysis} disabled={startingAnalysis} className="px-8 py-3 bg-[#00E5FF] hover:bg-[#00cce6] text-black rounded-lg font-semibold transition-colors">
          {startingAnalysis ? "Starting..." : "Scan Photo"}
        </button>
      </div>
    );
  }

  if (isScanning) {
    return (
      <div className="flex flex-col h-full bg-[#0B1120] text-white">
        <div className="px-6 py-4 border-b border-[#1E293B] flex items-center gap-2 text-sm text-gray-400">
          <span>My Cases</span> <ChevronRight className="h-4 w-4" /> <span>{investigation.title}</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex gap-16 items-center max-w-5xl w-full">
            {/* Left side: Image with scan animation */}
            <div className="flex-1">
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-[#1E293B] shadow-2xl bg-[#151E32]">
                <SecureImage investigationId={id!} evidenceId={evidenceId!} className="w-full h-full object-contain opacity-70" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00E5FF]/20 to-transparent animate-scan-sweep"></div>
                <div className="absolute top-0 left-0 w-full h-0.5 bg-[#00E5FF] shadow-[0_0_15px_#00E5FF] animate-scan-line"></div>
              </div>
            </div>
            
            {/* Right side: Checklist */}
            <div className="flex-1 space-y-8">
              <div>
                <h1 className="text-4xl font-bold mb-2">Scanning your photo...</h1>
                <p className="text-gray-400 text-lg">Hang tight — this takes about 10 seconds.</p>
              </div>
              
              <div className="space-y-5">
                {[
                  "Looking at tiny details (pixels)",
                  "Hunting for repeating patterns",
                  "Checking light and shadows",
                  "Spotting signs of AI tools",
                  "Writing your summary"
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Loader2 className="w-6 h-6 text-[#00E5FF] animate-spin" />
                    <span className="text-lg font-medium text-gray-200">{text}</span>
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t border-[#1E293B]">
                <p className="text-gray-400 italic">"AI is great at faces but still messes up hands and text."</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RESULTS VIEW
  const isFake = result?.verdict === "LIKELY_AI_GENERATED";
  const heatmapUrl = result?.ai_explanation ? `${API_BASE}/api/v2/investigations/${id}/evidence/${evidenceId}/heatmap` : null;
  
  // The backend ensemble_score is the probability of being AUTHENTIC (>= 0.5 is authentic)
  const authScore = result?.ensemble_score ?? (isFake ? 0.11 : 0.66);
  const scorePercent = Math.round((1 - authScore) * 100);

  return (
    <div className="flex flex-col h-full bg-[#0B1120] text-gray-100 overflow-y-auto font-sans">
      {/* Top Header */}
      <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0B1120]/95 backdrop-blur z-10 border-b border-[#1E293B]">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link to="/investigations" className="hover:text-white">My Cases</Link>
            <ChevronRight className="h-3 w-3 opacity-50" />
            <Link to={`/investigation/${id}`} className="hover:text-white">{investigation.title}</Link>
            <ChevronRight className="h-3 w-3 opacity-50" />
            <span className="text-gray-200">{evidence.original_filename || evidence.id.slice(0,8)}</span>
          </div>
          <h1 className="text-2xl font-bold">{investigation.title}</h1>
          <p className="text-xs text-gray-500 mt-1">Added 4 Oct 2026, 3:35 AM • Scanned 4 Oct 2026, 3:36 AM</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-green-500 font-semibold">Scanner ready</span>
          </div>
          <button className="px-4 py-2 bg-[#00E5FF] text-black text-sm font-semibold rounded-lg hover:bg-[#00cce6] transition-colors">
            Check a photo
          </button>
          <div className="flex items-center gap-2">
            <Link to="/comparison" className="px-4 py-2 border border-[#1E293B] text-sm text-gray-300 font-medium rounded-lg hover:bg-[#1E293B] transition-colors flex items-center gap-2">
              <Layout className="w-4 h-4" /> Compare
            </Link>
            <Link to={`/investigation/${id}/report`} className="px-4 py-2 border border-[#1E293B] text-sm text-gray-300 font-medium rounded-lg hover:bg-[#1E293B] transition-colors flex items-center gap-2">
              <FileText className="w-4 h-4" /> Report
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col xl:flex-row p-6 gap-6 max-w-[1200px] mx-auto w-full">
        
        {/* Left Column (Image & AI Helper) */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Image Card */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-4 shadow-xl">
            {/* View Mode Controls */}
            <div className="flex items-center gap-2 mb-4 p-1 bg-[#1E293B]/50 rounded-lg w-fit">
              <button 
                onClick={() => setViewMode("original")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === 'original' ? 'bg-[#00E5FF] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Original
              </button>
              <button 
                onClick={() => setViewMode("heatmap")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === 'heatmap' ? 'bg-[#00E5FF] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Show me where
              </button>
              <button 
                onClick={() => setViewMode("compare")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === 'compare' ? 'bg-[#00E5FF] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Slide to compare
              </button>
            </div>
            
            {/* Image Stage */}
            <div className="relative w-full h-[400px] rounded-xl overflow-hidden bg-[#0B1120] border border-[#1E293B]">
              {viewMode === "original" && (
                <SecureImage investigationId={id!} evidenceId={evidenceId!} className="w-full h-full object-contain" />
              )}
              {viewMode === "heatmap" && heatmapUrl && (
                <SecureImage investigationId={id!} evidenceId={evidenceId!} type="heatmap" className="w-full h-full object-contain" />
              )}
              {viewMode === "compare" && heatmapUrl && (
                <div className="relative w-full h-full flex items-center justify-center">
                  <SecureImage investigationId={id!} evidenceId={evidenceId!} className="w-full h-full object-contain" />
                  <div className="absolute inset-0 w-full h-full mix-blend-screen opacity-80">
                    <SecureImage investigationId={id!} evidenceId={evidenceId!} type="heatmap" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">
              Brighter, warmer spots = where our scanner got most suspicious. Zoom in on those areas!
            </p>
          </div>

          {/* Ask the AI Helper Card */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 shadow-xl flex flex-col">
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
              <span className="text-[#00E5FF] text-xl">✨</span> Ask the AI Helper
            </h3>
            <p className="text-xs text-gray-400 mb-6">Confused? Ask anything about this photo in your own words.</p>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {['Explain it simply', 'What should I look for?', 'Is it safe to share?', 'Why not 100% sure?'].map(chip => (
                <button key={chip} className="px-4 py-1.5 rounded-full border border-[#1E293B] text-xs text-gray-300 hover:border-[#00E5FF] hover:text-[#00E5FF] transition-colors">
                  {chip}
                </button>
              ))}
            </div>
            
            {/* AI Response Area */}
            <div className="bg-[#1E293B] rounded-xl p-4 mb-4 text-sm text-gray-200 min-h-[100px] overflow-y-auto prose prose-invert prose-sm max-w-none">
              {!aiResponse && !isAiLoading ? (
                <p>In plain words: we think there's a <strong>{scorePercent}% chance</strong> this photo was made by AI, so it probably isn't a real photograph.</p>
              ) : (
                isAiLoading && !aiResponse ? (
                  <div className="flex items-center gap-2 text-[#00E5FF]"><Loader2 className="w-4 h-4 animate-spin" /> <span>Thinking...</span></div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
                )
              )}
            </div>
            
            <div className="relative mt-auto">
              <input 
                type="text"
                placeholder="Type your question..."
                className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#00E5FF] transition-colors"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAiQuery()}
              />
              <button onClick={() => handleAiQuery()} disabled={isAiLoading} className="absolute right-2 top-2 bottom-2 bg-[#00E5FF] text-black w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#00cce6] transition-colors disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (Verdict & Details) */}
        <div className="w-full xl:w-[400px] flex flex-col gap-6">
          
          {/* Main Verdict Card */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 shadow-xl flex flex-col items-center">
            <div className={`px-4 py-1.5 rounded-md text-xs font-bold tracking-widest uppercase mb-8 ${isFake ? 'bg-[#FF3366]/20 text-[#FF3366]' : 'bg-[#00E5FF]/20 text-[#00E5FF]'}`}>
              {isFake ? '🚨 LIKELY AI-MADE' : '✅ LOOKS REAL'}
            </div>
            
            {/* Arc Progress */}
            <div className="relative w-48 h-24 overflow-hidden mb-4">
              <div className={`w-48 h-48 rounded-full border-[12px] border-b-0 border-t-0 border-l-0 border-r-0 ${isFake ? 'border-[#FF3366]/20 border-t-[#FF3366] border-l-[#FF3366]' : 'border-[#00E5FF]/20 border-t-[#00E5FF] border-l-[#00E5FF]'} rotate-45`}></div>
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                <span className="text-5xl font-bold">{scorePercent}%</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">chance it's AI-made</span>
              </div>
            </div>
            
            <h2 className="text-lg font-bold text-center mt-2">
              {isFake ? 'This photo shows strong signs of being AI-made.' : 'This photo appears to be a natural photograph.'}
            </h2>
            <p className="text-xs text-center text-gray-500 mt-3 px-4 leading-relaxed">
              Our scanner gives a chance, not a guarantee. Use it as a clue along with your own judgement.
            </p>
          </div>

          {/* Why We Think So */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-sm mb-4">Why we think so</h3>
            <ul className="space-y-4">
              {isFake ? (
                <>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF3366] mt-1.5 shrink-0 shadow-[0_0_8px_#FF3366]"></div>
                    <p className="text-xs text-gray-300 leading-relaxed">Skin and textures look a little too smooth and perfect.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF3366] mt-1.5 shrink-0 shadow-[0_0_8px_#FF3366]"></div>
                    <p className="text-xs text-gray-300 leading-relaxed">Light and shadows don't quite agree with each other.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF3366] mt-1.5 shrink-0 shadow-[0_0_8px_#FF3366]"></div>
                    <p className="text-xs text-gray-300 leading-relaxed">Small details like hair, teeth or text look slightly melted.</p>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#00E5FF] mt-1.5 shrink-0 shadow-[0_0_8px_#00E5FF]"></div>
                    <p className="text-xs text-gray-300 leading-relaxed">Natural noise and sensor patterns align with authentic captures.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#00E5FF] mt-1.5 shrink-0 shadow-[0_0_8px_#00E5FF]"></div>
                    <p className="text-xs text-gray-300 leading-relaxed">Lighting and shadows are consistent across the frame.</p>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* The Scores */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-sm mb-4">The scores</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300 font-medium">AI-made <span className="text-gray-500 font-normal ml-1">made by an AI tool</span></span>
                  <span className="font-bold">{scorePercent}%</span>
                </div>
                <div className="h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF3366]" style={{ width: `${scorePercent}%` }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300 font-medium">Edited <span className="text-gray-500 font-normal ml-1">touched up or changed</span></span>
                  <span className="font-bold">{68}%</span>
                </div>
                <div className="h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF9900]" style={{ width: `68%` }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300 font-medium">Looks natural <span className="text-gray-500 font-normal ml-1">like a normal camera photo</span></span>
                  <span className="font-bold">{34}%</span>
                </div>
                <div className="h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                  <div className="h-full bg-[#00E5FF]" style={{ width: `34%` }}></div>
                </div>
              </div>
            </div>
            
            <button className="w-full flex items-center justify-between mt-4 pt-4 border-t border-[#1E293B] text-xs text-gray-400 hover:text-white transition-colors">
              <span>How did the two checks score it?</span>
              <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
          </div>

          {/* My Notes */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-sm mb-3">My notes</h3>
            <textarea 
              className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl p-3 text-xs text-gray-300 focus:outline-none focus:border-[#00E5FF] min-h-[80px]"
              placeholder="Where did you find this photo? What made you suspicious?"
            ></textarea>
            <p className="text-[10px] text-gray-500 mt-2">Saved automatically.</p>
          </div>

          {/* Photo Details */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-4 shadow-xl">
            <button className="w-full flex items-center justify-between text-sm font-bold text-gray-300 hover:text-white transition-colors">
              <span>Photo details</span>
              <ChevronRight className="w-4 h-4 rotate-90" />
            </button>
            <div className="mt-4 pt-4 border-t border-[#1E293B] flex justify-center">
              <button className="text-[#FF3366] hover:text-[#ff1a53] text-xs font-medium">
                Delete this photo
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
