import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { ArrowRight, Fingerprint, Layers, FileSearch, FileText, Settings, Shield, Video } from "lucide-react";

// Generate wave SVGs using the same logic provided in the HTML script
function WaveGenerator() {
  const n = 90, w = 400 / n;
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const rects = [];
  
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-Math.pow((i - n * 0.55) / (n * 0.22), 2));
    const h = 6 + env * 150 * (0.35 + rnd() * 0.65);
    rects.push(
      <rect 
        key={i} 
        x={(i * w).toFixed(1)} 
        y={(150 - h / 2).toFixed(1)} 
        width={(w * 0.55).toFixed(1)} 
        height={h.toFixed(1)} 
        fill="#38bdf8" 
        opacity={(0.45 + env * 0.5).toFixed(2)} 
      />
    );
  }
  return <svg id="wave" viewBox="0 0 400 300" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">{rects}</svg>;
}

export function Home() {
  const { user } = useAuth();

  // Reusable animation variants for scroll reveals
  const fadeUpVariant: any = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const staggerContainer: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  return (
    <div className="flex flex-col w-full bg-surface min-h-screen text-on-surface relative">
      {/* Global Background Atmospheric Grid */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      {/* Custom Hero Section */}
      <div className="bg-surface text-on-surface font-['Inter',sans-serif] w-full pt-[90px] selection:bg-[#38bdf8]/30 selection:text-white pb-[20px] relative">
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] px-[6vw] min-h-[600px] items-center relative">
        <div className="pt-8 lg:pt-0 pb-12 lg:pb-0">
          <div className="inline-flex items-center gap-[12px] px-[18px] py-[12px] rounded-full text-[13.5px] tracking-[1.4px] font-medium text-[#b9c8e6] bg-[#142450]/70 border border-[#648cff]/20">
            <i className="w-[9px] h-[9px] rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]"></i>
            AI-POWERED MEDIA VERIFICATION PLATFORM
          </div>
          <h1 className="mt-[28px] text-[clamp(54px,6.2vw,92px)] leading-[1.02] tracking-[-2.5px] font-extrabold">
            Trust What You <span className="block bg-gradient-to-r from-[#38bdf8] to-[#22d3ee] bg-clip-text text-transparent">See Online.</span>
          </h1>
          <p className="mt-[28px] max-w-[590px] text-[21px] leading-[1.45] text-[#b3c0da]">
            DeepVerify is an investigative aid designed to help you examine suspicious media. Run image analysis today to spot potential signs of AI generation. Video verification capabilities are planned for the future.
          </p>
          <div className="mt-[40px] flex flex-wrap gap-[20px]">
            <Link to={user ? "/dashboard" : "/login"} className="inline-flex items-center gap-[14px] px-[32px] py-[20px] rounded-[10px] font-semibold text-[20px] text-[#04122b] bg-gradient-to-r from-[#38bdf8] to-[#22d3ee] shadow-[0_0_30px_rgba(56,189,248,0.35)] hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(56,189,248,0.5)] transition-all">
              Sign In to Check an Image <span>→</span>
            </Link>
            <a href="#how-it-works" className="inline-flex items-center gap-[14px] px-[32px] py-[20px] rounded-[10px] font-medium text-[20px] text-white border border-[#8caaff]/35 bg-[#0a1432]/50 hover:bg-[#0a1432]/80 transition-colors">
              <span className="w-[26px] h-[26px] rounded-full bg-[#3b82f6] flex items-center justify-center pl-[2px]">
                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-white"></div>
              </span>
              See How it Works
            </a>
          </div>
          <div className="mt-[56px] flex flex-col lg:flex-row gap-[22px] lg:gap-0 max-w-[780px]">
            <div className="flex gap-[16px] lg:pr-[28px] lg:mr-[28px] lg:border-r lg:border-[#78a0ff]/14">
              <svg viewBox="0 0 36 36" className="w-[36px] h-[36px] flex-none stroke-[#4f8bff] fill-none stroke-[1.8] stroke-linecap-[round] stroke-linejoin-[round]"><rect x="4" y="5" width="28" height="26" rx="3"/><circle cx="13" cy="14" r="3"/><path d="M4 27l9-8 7 6 5-4 7 6"/></svg>
              <div><b className="block text-[16.5px] font-semibold mb-[6px] text-white">Image Analysis</b><span className="block text-[14px] leading-[1.4] text-[#7f90b1] max-w-[160px]">Detect AI-generated and manipulated media</span></div>
            </div>
            <div className="flex gap-[16px] lg:pr-[28px] lg:mr-[28px] lg:border-r lg:border-[#78a0ff]/14">
              <svg viewBox="0 0 36 36" className="w-[36px] h-[36px] flex-none stroke-[#4f8bff] fill-none stroke-[1.8] stroke-linecap-[round] stroke-linejoin-[round]"><path d="M18 3l12 4v9c0 8-5 14-12 17C11 30 6 24 6 16V7z"/><path d="M12 17l5 5 8-9"/></svg>
              <div><b className="block text-[16.5px] font-semibold mb-[6px] text-white">Explainable Results</b><span className="block text-[14px] leading-[1.4] text-[#7f90b1] max-w-[160px]">Visualize what the model is seeing (e.g. heatmaps)</span></div>
            </div>
            <div className="flex gap-[16px]">
              <svg viewBox="0 0 36 36" className="w-[36px] h-[36px] flex-none stroke-[#4f8bff] fill-none stroke-[1.8] stroke-linecap-[round] stroke-linejoin-[round]"><rect x="4" y="4" width="28" height="28" rx="3"/><path d="M11 26V18M18 26V11M25 26V15"/></svg>
              <div><b className="block text-[16.5px] font-semibold mb-[6px] text-white">Research Driven</b><span className="block text-[14px] leading-[1.4] text-[#7f90b1] max-w-[160px]">Built on state-of-the-art forensic techniques</span></div>
            </div>
          </div>
        </div>

        <div className="relative h-[560px] lg:h-[600px] mt-10 lg:mt-0" style={{ perspective: '1700px' }}>
          <div className="absolute left-[6%] bottom-[3%] w-[82%] h-[160px]" style={{ transform: 'rotateX(70deg) rotateZ(-4deg)' }}>
            <i className="absolute inset-0 rounded-full border-[2px] border-[#38bdf8]/80 shadow-[0_0_30px_rgba(56,189,248,0.6),inset_0_0_30px_rgba(56,189,248,0.35)]"></i>
            <i className="absolute inset-[14px_40px] rounded-full border-[2px] border-[#3b82f6]/55 shadow-[0_0_30px_rgba(56,189,248,0.6),inset_0_0_30px_rgba(56,189,248,0.35)]"></i>
            <i className="absolute inset-[34px_90px] rounded-full border-[2px] border-[#22d3ee]/45 shadow-[0_0_30px_rgba(56,189,248,0.6),inset_0_0_30px_rgba(56,189,248,0.35)]"></i>
          </div>

          <div 
            className="absolute left-[38%] top-[6%] w-[34%] h-[62%] rounded-[6px] border border-[#5a96ff]/45 shadow-[0_0_40px_rgba(37,99,235,0.35),inset_0_0_40px_rgba(60,120,255,0.12)] opacity-[0.65]" 
            style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-22deg) rotateX(6deg) rotateZ(2deg)', background: 'linear-gradient(160deg, rgba(20, 45, 110, 0.55), rgba(8, 18, 50, 0.7))' }}></div>

          <div 
            className="absolute left-[52%] top-[2%] w-[44%] h-[50%] rounded-[6px] border border-[#5a96ff]/45 shadow-[0_0_40px_rgba(37,99,235,0.35),inset_0_0_40px_rgba(60,120,255,0.12)] opacity-[0.85] overflow-hidden" 
            style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-24deg) rotateX(6deg) rotateZ(3deg)', background: 'linear-gradient(160deg, rgba(20, 45, 110, 0.55), rgba(8, 18, 50, 0.7))' }}>
            <WaveGenerator />
          </div>

          <div 
            className="absolute left-0 top-[16%] w-[20%] h-[44%] rounded-[6px] border border-[#5a96ff]/45 shadow-[0_0_40px_rgba(37,99,235,0.35),inset_0_0_40px_rgba(60,120,255,0.12)] overflow-hidden" 
            style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-26deg) rotateZ(-3deg)', background: 'linear-gradient(160deg, rgba(20, 45, 110, 0.55), rgba(8, 18, 50, 0.7))' }}>
            <div className="absolute inset-[8%] blur-[6px] saturate-[1.2]" style={{
              background: `
                radial-gradient(circle at 70% 25%, #ff3b30 0 8%, transparent 22%),
                radial-gradient(circle at 55% 38%, #ffd60a 0 6%, transparent 24%),
                radial-gradient(circle at 70% 62%, #ff9f0a 0 6%, transparent 22%),
                radial-gradient(circle at 40% 70%, #34c759 0 8%, transparent 26%),
                radial-gradient(circle at 60% 85%, #ff3b30 0 6%, transparent 20%),
                radial-gradient(circle at 30% 30%, #0a84ff 0 18%, transparent 45%),
                linear-gradient(160deg, #0b2a7a, #0a1c55)
              `
            }}></div>
          </div>

          <div 
            className="absolute left-[12%] top-[9%] w-[42%] h-[66%] rounded-[8px] border border-[#78beff]/55 bg-[#081437]/70 shadow-[0_0_40px_rgba(37,99,235,0.35),inset_0_0_40px_rgba(60,120,255,0.12)]" 
            style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-14deg) rotateX(3deg) rotateZ(1deg)' }}>
            <div className="absolute inset-[8%_6%_18%_6%] rounded-[4px] bg-[#0b1630] overflow-hidden">
              <svg viewBox="0 0 400 420" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
                <defs>
                  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4b5565"/><stop offset="1" stopColor="#8d96a6"/></linearGradient>
                  <linearGradient id="rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2b323d"/><stop offset="1" stopColor="#0f141c"/></linearGradient>
                </defs>
                <rect width="400" height="420" fill="url(#sky)"/>
                <path d="M-10 420 L60 250 L110 280 L190 70 L230 130 L270 90 L330 220 L410 170 L410 420Z" fill="url(#rock)"/>
                <path d="M190 70 L160 190 L190 160 L215 215 L230 130Z" fill="#e9edf3"/>
                <path d="M270 90 L250 170 L275 150 L300 200 L330 220 L295 140Z" fill="#d6dce6" opacity=".9"/>
                <path d="M60 250 L90 270 L110 280 L80 330 Z" fill="#cfd6e1" opacity=".7"/>
                <path d="M-10 420 L120 330 L220 390 L320 320 L410 380 L410 420Z" fill="#161b24"/>
              </svg>
              <div 
                className="absolute inset-0 filter hue-rotate-[5deg] saturate-[2.4] brightness-[1.1]" 
                style={{ clipPath: 'inset(0 0 0 50%)' }}>
                <svg viewBox="0 0 400 420" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
                  <rect width="400" height="420" fill="#07235e"/>
                  <path d="M-10 420 L60 250 L110 280 L190 70 L230 130 L270 90 L330 220 L410 170 L410 420Z" fill="#0b3fa8"/>
                  <path d="M190 70 L160 190 L190 160 L215 215 L230 130Z" fill="#8fd0ff"/>
                  <path d="M270 90 L250 170 L275 150 L300 200 L330 220 L295 140Z" fill="#5fb4ff"/>
                </svg>
                <div 
                  className="absolute inset-0 mix-blend-screen"
                  style={{
                    background: `
                      linear-gradient(rgba(30,120,255,.35) 1px, transparent 1px) 0 0 / 14px 14px,
                      linear-gradient(90deg, rgba(30,120,255,.35) 1px, transparent 1px) 0 0 / 14px 14px,
                      radial-gradient(circle at 70% 55%, rgba(0,150,255,.55), transparent 55%)
                    `
                  }}></div>
              </div>
              <div className="absolute left-[50%] top-0 bottom-0 w-[3px] bg-[#6fe3ff] shadow-[0_0_14px_#38bdf8,0_0_28px_#38bdf8] -translate-x-1/2"></div>
              <div className="absolute left-[50%] top-[50%] w-[44px] h-[44px] rounded-full -translate-x-1/2 -translate-y-1/2 bg-[#0a1840]/90 border-[2px] border-[#8fdcff] flex items-center justify-center text-[15px] text-white tracking-[-2px] font-bold shadow-[0_0_18px_#38bdf8]">&lt;&gt;</div>
              <div className="absolute w-[36px] h-[36px] border-[4px] border-[#e9f6ff] drop-shadow-[0_0_6px_#38bdf8] left-[4%] top-[6%] border-r-0 border-b-0"></div>
              <div className="absolute w-[36px] h-[36px] border-[4px] border-[#38bdf8] drop-shadow-[0_0_6px_#38bdf8] right-[4%] top-[14%] border-l-0 border-b-0"></div>
              <div className="absolute w-[36px] h-[36px] border-[4px] border-[#e9f6ff] drop-shadow-[0_0_6px_#38bdf8] left-[4%] bottom-[20%] border-r-0 border-t-0"></div>
              <div className="absolute w-[36px] h-[36px] border-[4px] border-[#e9f6ff] drop-shadow-[0_0_6px_#38bdf8] right-[4%] bottom-[20%] border-l-0 border-t-0"></div>
            </div>
            <div className="absolute left-[6%] right-[6%] bottom-[6%]">
              <small className="block text-[15px] tracking-[1px] font-semibold text-[#dbe9ff] mb-[10px]">ANALYZING MEDIA...</small>
              <div className="h-[10px] rounded-[99px] bg-[#3c6ec8]/35 overflow-hidden">
                <motion.i 
                  className="block h-full bg-gradient-to-r from-[#22d3ee] to-[#38bdf8] shadow-[0_0_12px_#22d3ee]"
                  animate={{ width: ["40%", "90%"] }}
                  transition={{
                    repeat: Infinity,
                    repeatType: "reverse",
                    duration: 2,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </div>
            <div className="absolute inset-0 pointer-events-none">
              <i className="absolute bg-[#1e9bff] opacity-90 shadow-[0_0_10px_#1e9bff]" style={{ right: '-6%', bottom: '14%', width: '26px', height: '26px' }}></i>
              <i className="absolute bg-[#1e9bff] opacity-90 shadow-[0_0_10px_#1e9bff]" style={{ right: '-12%', bottom: '22%', width: '18px', height: '18px' }}></i>
              <i className="absolute bg-[#1e9bff] opacity-90 shadow-[0_0_10px_#1e9bff]" style={{ right: '-3%', bottom: '30%', width: '14px', height: '14px' }}></i>
              <i className="absolute bg-[#1e9bff] opacity-90 shadow-[0_0_10px_#1e9bff]" style={{ right: '-16%', bottom: '8%', width: '34px', height: '34px' }}></i>
              <i className="absolute bg-[#1e9bff] opacity-90 shadow-[0_0_10px_#1e9bff]" style={{ right: '-9%', bottom: '3%', width: '20px', height: '20px' }}></i>
            </div>
          </div>

          <div className="absolute right-0 top-[41%] w-[28%] flex flex-col gap-[12px]" style={{ transform: 'rotateY(-16deg) rotateZ(3deg)' }}>
            <div className="border border-[#64a0ff]/40 bg-[#0a1941]/85 rounded-[10px] p-[12px_18px_12px_12px] grid grid-cols-[22px_1fr_auto] gap-[12px] items-center shadow-[0_0_20px_rgba(37,99,235,0.25)] text-white">
              <span className="w-[20px] h-[20px] rounded-full bg-[#e8f1ff]"></span>
              <div><small className="block text-[11px] tracking-[0.6px] text-[#9db4de] mb-[6px]">AI GENERATED</small><div className="h-[6px] rounded-[9px] bg-[#5078c8]/30 overflow-hidden"><i className="block h-full bg-gradient-to-r from-[#38bdf8] to-[#6aa5ff]" style={{ width: '87%' }}></i></div></div><b className="text-[14px] font-semibold">87%</b>
            </div>
            <div className="border border-[#64a0ff]/40 bg-[#0a1941]/85 rounded-[10px] p-[12px_18px_12px_12px] grid grid-cols-[22px_1fr_auto] gap-[12px] items-center shadow-[0_0_20px_rgba(37,99,235,0.25)] text-white">
              <span className="w-[20px] h-[20px] rounded-full bg-[#e8f1ff]"></span>
              <div><small className="block text-[11px] tracking-[0.6px] text-[#9db4de] mb-[6px]">MANIPULATION</small><div className="h-[6px] rounded-[9px] bg-[#5078c8]/30 overflow-hidden"><i className="block h-full bg-gradient-to-r from-[#38bdf8] to-[#6aa5ff]" style={{ width: '64%' }}></i></div></div><b className="text-[14px] font-semibold">64%</b>
            </div>
            <div className="border border-[#64a0ff]/40 bg-[#0a1941]/85 rounded-[10px] p-[12px_18px_12px_12px] grid grid-cols-[22px_1fr_auto] gap-[12px] items-center shadow-[0_0_20px_rgba(37,99,235,0.25)] text-white">
              <span className="w-[20px] h-[20px] rounded-full bg-[#e8f1ff]"></span>
              <div><small className="block text-[11px] tracking-[0.6px] text-[#9db4de] mb-[6px]">CONSISTENCY</small><div className="h-[6px] rounded-[9px] bg-[#5078c8]/30 overflow-hidden"><i className="block h-full bg-gradient-to-r from-[#38bdf8] to-[#6aa5ff]" style={{ width: '22%' }}></i></div></div><b className="text-[14px] font-semibold">22%</b>
            </div>
            <div className="border border-[#64a0ff]/40 bg-[#0a1941]/85 rounded-[10px] p-[12px_18px_12px_12px] grid grid-cols-[22px_1fr_auto] gap-[12px] items-center shadow-[0_0_20px_rgba(37,99,235,0.25)] text-white">
              <span className="w-[20px] h-[20px] rounded-full bg-[#e8f1ff]"></span>
              <div><small className="block text-[11px] tracking-[0.6px] text-[#9db4de] mb-[6px]">AUTHENTICITY</small><div className="h-[6px] rounded-[9px] bg-[#5078c8]/30 overflow-hidden"><i className="block h-full bg-gradient-to-r from-[#38bdf8] to-[#6aa5ff]" style={{ width: '13%' }}></i></div></div><b className="text-[14px] font-semibold">13%</b>
            </div>
          </div>

          <div className="absolute right-[-2%] bottom-[10%] text-[14px] font-semibold tracking-[1.1px] leading-[1.7] text-[#22d3ee]" style={{ transform: 'rotateZ(4deg)' }}>
            FREQUENCY ANALYSIS<br/>PATTERN DETECTION<br/>DEEP LEARNING MODELS<br/>FORENSIC INSIGHTS
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_repeat(4,1fr)] gap-[24px] lg:gap-0 items-center p-[34px_6vw] border-t border-[#78a0ff]/14 bg-surface-variant/40">
        <div className="text-[14px] tracking-[1.6px] leading-[1.7] text-[#8da0c4]">TRUSTED BY RESEARCHERS,<br/>STUDENTS AND BUILDERS</div>
        <div className="flex items-center gap-[16px] lg:pl-[28px] lg:border-l lg:border-[#78a0ff]/14">
          <svg viewBox="0 0 40 40" className="w-[40px] h-[40px] stroke-[#5b8fff] fill-none stroke-[1.7] stroke-linecap-round stroke-linejoin-round flex-none"><path d="M20 6L3 14l17 8 17-8z"/><path d="M9 18v9c0 3 5 6 11 6s11-3 11-6v-9"/></svg>
          <div><b className="block text-[16.5px] font-semibold mb-[4px] text-white">Students</b><span className="text-[15px] text-[#7f90b1]">Academic Research</span></div>
        </div>
        <div className="flex items-center gap-[16px] lg:pl-[28px] lg:border-l lg:border-[#78a0ff]/14">
          <svg viewBox="0 0 40 40" className="w-[40px] h-[40px] stroke-[#5b8fff] fill-none stroke-[1.7] stroke-linecap-round stroke-linejoin-round flex-none"><path d="M13 12L4 20l9 8M27 12l9 8-9 8M23 8l-6 24"/></svg>
          <div><b className="block text-[16.5px] font-semibold mb-[4px] text-white">Developers</b><span className="text-[15px] text-[#7f90b1]">Open Source Projects</span></div>
        </div>
        <div className="flex items-center gap-[16px] lg:pl-[28px] lg:border-l lg:border-[#78a0ff]/14">
          <svg viewBox="0 0 40 40" className="w-[40px] h-[40px] stroke-[#5b8fff] fill-none stroke-[1.7] stroke-linecap-round stroke-linejoin-round flex-none"><path d="M10 4h14l8 8v24H10z"/><path d="M24 4v8h8M15 20h12M15 26h12"/></svg>
          <div><b className="block text-[16.5px] font-semibold mb-[4px] text-white">Researchers</b><span className="text-[15px] text-[#7f90b1]">Forensic Analysis</span></div>
        </div>
        <div className="flex items-center gap-[16px] lg:pl-[28px] lg:border-l lg:border-[#78a0ff]/14">
          <svg viewBox="0 0 40 40" className="w-[40px] h-[40px] stroke-[#5b8fff] fill-none stroke-[1.7] stroke-linecap-round stroke-linejoin-round flex-none"><path d="M20 4l14 5v10c0 9-6 15-14 18C12 34 6 28 6 19V9z"/><path d="M13 20l5 5 9-10"/></svg>
          <div><b className="block text-[16.5px] font-semibold mb-[4px] text-white">Organizations</b><span className="text-[15px] text-[#7f90b1]">Media Verification</span></div>
        </div>
      </section>
      </div>

      {/* Gradient Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-outline-variant/30 to-transparent"></div>

      {/* 2. Demonstration Section */}
      <section className="relative w-full py-24 z-10">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.02)_0%,transparent_70%)] pointer-events-none"></div>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-[1200px] mx-auto px-margin-mobile md:px-margin flex flex-col gap-space-xl items-center relative"
        >
          <motion.div variants={fadeUpVariant} className="flex flex-col items-center text-center max-w-3xl gap-space-md">
            <h2 className="font-headline-lg text-3xl sm:text-5xl text-on-surface font-bold tracking-tight">
              Visualize Model Attention
            </h2>
            <p className="font-body-md text-on-surface-variant text-base sm:text-lg leading-relaxed">
              When you analyze an image, DeepVerify generates heatmaps (like Grad-CAM) that show which areas of the image most strongly influenced the model's output. These are clues for your investigation, not guaranteed boundaries of manipulation.
            </p>
          </motion.div>
          
          <motion.div variants={fadeUpVariant} className="w-full bg-surface-container-low/80 backdrop-blur-md border border-outline-variant/30 rounded-[2rem] p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)] relative group overflow-hidden">
            {/* Disclaimer Label */}
            <div className="absolute top-8 left-8 z-20 bg-surface-container-high/90 backdrop-blur-md border border-outline-variant/40 rounded-lg px-4 py-2 shadow-xl">
              <span className="font-label-mono text-[11px] uppercase tracking-widest text-error font-bold flex items-center gap-2">
                <span className="text-[16px]">⚠️</span> Illustrative Example: Simulated Analysis Output
              </span>
            </div>
            
            {/* Interactive Image Display */}
            <div className="relative w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden bg-surface-container-highest flex border border-surface-container-highest shadow-inner">
              <div className="w-1/2 h-full bg-surface-container flex items-center justify-center border-r border-outline-variant/30 relative overflow-hidden group/left">
                <img 
                  src="/images/showcase.jpg" 
                  alt="Original Source Image"
                  className="absolute inset-0 w-full h-full object-cover opacity-80" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-highest/90 via-transparent to-transparent"></div>
                <div className="absolute bottom-6 left-6 flex flex-col gap-1">
                  <span className="font-label-mono text-[11px] text-primary uppercase tracking-widest font-bold">Input Media</span>
                  <span className="font-headline-sm text-[15px] sm:text-[17px] text-on-surface font-bold drop-shadow-md">Original Source</span>
                </div>
              </div>
              
              <div className="w-1/2 h-full relative flex items-center justify-center bg-surface-container overflow-hidden">
                <img 
                  src="/images/showcase.jpg" 
                  alt="Grad-CAM Visualization"
                  className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale" 
                />
                
                {/* Simulated Heatmap Layers (Clearly labeled as illustrative above) */}
                <div className="absolute inset-0 opacity-70 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-error via-error/20 to-transparent scale-125 blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-warning via-transparent to-transparent scale-150 blur-2xl group-hover:opacity-60 transition-opacity duration-1000"></div>
                
                {/* Scanning Line Animation */}
                <motion.div 
                  animate={{ y: ["-100%", "300%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-x-0 top-0 h-1.5 bg-error/40 shadow-[0_0_20px_rgba(255,84,73,0.7)] z-10"
                />

                <div className="absolute bottom-6 left-6 flex flex-col gap-1 z-20">
                  <span className="font-label-mono text-[11px] text-error uppercase tracking-widest font-bold">Model Attention</span>
                  <span className="font-headline-sm text-[15px] sm:text-[17px] text-on-surface font-bold drop-shadow-md">Grad-CAM Activation</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Gradient Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-outline-variant/30 to-transparent"></div>

      {/* 2.5 Real-World Use Cases */}
      <section className="w-full py-24 relative z-10">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col gap-space-xl"
        >
          <motion.div variants={fadeUpVariant} className="flex flex-col items-center text-center max-w-3xl mx-auto gap-space-xs">
            <h2 className="font-headline-lg text-3xl sm:text-4xl text-on-surface font-bold tracking-tight">
              Investigate the Media That Matters
            </h2>
            <p className="font-body-md text-on-surface-variant max-w-2xl text-base sm:text-lg">
              DeepVerify is designed to help you analyze high-stakes visual content across the internet. Here are examples of media you might examine.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg lg:gap-space-xl">
            {/* Social Media Card */}
            <motion.div variants={fadeUpVariant} className="flex flex-col group cursor-default relative rounded-[2rem] overflow-hidden border border-outline-variant/30 shadow-2xl aspect-[3/4]">
              <img 
                src="/images/social.jpg" 
                alt="Influencer social media portrait example"
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                <span className="font-label-mono text-[11px] uppercase text-primary tracking-widest font-bold">Example Use Case</span>
                <h3 className="font-headline-sm text-2xl text-on-surface font-extrabold leading-tight">Social Media Imagery</h3>
              </div>
            </motion.div>

            {/* Public Figure Card */}
            <motion.div variants={fadeUpVariant} className="flex flex-col group cursor-default relative rounded-[2rem] overflow-hidden border border-outline-variant/30 shadow-2xl aspect-[3/4]">
              <img 
                src="/images/public.jpg" 
                alt="Public figure press conference example"
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                <span className="font-label-mono text-[11px] uppercase text-primary tracking-widest font-bold">Example Use Case</span>
                <h3 className="font-headline-sm text-2xl text-on-surface font-extrabold leading-tight">Public Statements</h3>
              </div>
            </motion.div>

            {/* Financial Card */}
            <motion.div variants={fadeUpVariant} className="flex flex-col group cursor-default relative rounded-[2rem] overflow-hidden border border-outline-variant/30 shadow-2xl aspect-[3/4]">
              <img 
                src="/images/financial.jpg" 
                alt="Financial news or executive portrait example"
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                <span className="font-label-mono text-[11px] uppercase text-primary tracking-widest font-bold">Example Use Case</span>
                <h3 className="font-headline-sm text-2xl text-on-surface font-extrabold leading-tight">Financial Claims</h3>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Gradient Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-outline-variant/30 to-transparent"></div>

      {/* 3. Workflow Section */}
      <section id="how-it-works" className="relative w-full py-24 bg-surface-container-lowest/40 z-10">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col gap-space-xl relative"
        >
          <motion.div variants={fadeUpVariant} className="flex flex-col items-center text-center max-w-3xl mx-auto gap-space-xs">
            <h2 className="font-headline-lg text-3xl sm:text-4xl text-on-surface font-bold tracking-tight">
              A Transparent Investigative Process
            </h2>
            <p className="font-body-md text-on-surface-variant max-w-2xl text-base sm:text-lg">
              From uploading your media to exporting findings, we make every step clear and verifiable.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg relative mt-12">
            {/* Connecting line for desktop */}
            <div className="hidden lg:block absolute top-1/2 left-8 w-[calc(100%-4rem)] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2 z-0"></div>

            {[
              { num: "01", icon: Fingerprint, title: "Upload Your Media", desc: "Upload an image for analysis. We generate a unique fingerprint (SHA-256 hash) for your file, making it easy to identify and match against future analyses." },
              { num: "02", icon: Layers, title: "Run the Analysis", desc: "Our engine evaluates the image using spatial and frequency patterns. While it doesn't guarantee universal detection, it provides a valuable baseline check." },
              { num: "03", icon: FileSearch, title: "Examine Evidence", desc: "Review the generated heatmaps and consult the AI Assistant for help interpreting the model outputs in plain English." },
              { num: "04", icon: FileText, title: "Export Your Report", desc: "Download a clean PDF report containing the model outputs and your personal investigation notes to share with others." }
            ].map((step, i) => (
              <motion.div key={i} variants={fadeUpVariant} className="p-8 rounded-3xl bg-surface-container/90 backdrop-blur-xl border border-outline-variant/30 flex flex-col gap-4 shadow-xl relative group hover:bg-surface-container-high hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 z-10 overflow-hidden">
                <span className="absolute -bottom-6 -right-4 text-[120px] leading-none font-black text-on-surface/5 select-none group-hover:text-primary/10 transition-colors duration-500">{step.num}</span>
                <div className="w-14 h-14 rounded-2xl bg-surface-container-highest border border-outline-variant/20 flex items-center justify-center text-primary shadow-sm group-hover:scale-110 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-300 relative z-10">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="font-headline-sm text-xl text-on-surface font-extrabold relative z-10">{step.title}</h3>
                <p className="font-body-sm text-[15px] text-on-surface-variant leading-relaxed relative z-10">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Gradient Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-outline-variant/30 to-transparent"></div>

      {/* 4. Advanced Capabilities & Roadmap */}
      <section id="under-the-hood" className="w-full py-24 z-10">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col gap-space-xl"
        >
          <motion.div variants={fadeUpVariant} className="flex flex-col items-center text-center max-w-3xl mx-auto gap-space-xs">
             <span className="font-label-mono text-label-mono text-primary uppercase tracking-widest text-[11px] bg-primary/10 px-3 py-1 rounded-full">
              Advanced Details
            </span>
            <h2 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight mt-2">
              Under the Hood &amp; Roadmap
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {[
              { icon: Settings, title: "Current Model Weighting", desc: "DeepVerify currently uses a 60/40 weighted ensemble of Spatial (EfficientNet-B0) and Frequency (2D-FFT) models. This represents our current evaluation configuration, not a definitive indication of truth." },
              { icon: Shield, title: "System Boundaries", desc: "DeepVerify provides isolated workspaces for your sessions, ensuring your current uploads are separated from public view." },
              { icon: Video, title: "Roadmap: Video Verification", desc: "Currently, DeepVerify exclusively analyzes still images. Frame-by-frame video verification is actively planned for future development.", opacity: "opacity-70" }
            ].map((item, i) => (
              <motion.div key={i} variants={fadeUpVariant} className={`p-space-lg rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-space-sm shadow-sm hover:shadow-md transition-shadow ${item.opacity || ''}`}>
                <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-on-surface-variant">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-headline-sm text-base text-on-surface font-semibold mt-2">{item.title}</h3>
                <p className="font-body-sm text-sm text-on-surface-variant leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 5. Epistemic Principles */}
      <section id="principles" className="w-full py-40 bg-surface-container-lowest/20 border-t border-outline-variant/20 z-10 relative overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(77,142,255,0.08)_0%,transparent_50%)] pointer-events-none"></div>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUpVariant}
          className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col items-center text-center gap-space-xl relative z-10"
        >
          <div className="flex flex-col items-center gap-space-md max-w-4xl">
            <h2 className="font-headline-lg text-4xl sm:text-6xl text-on-surface font-extrabold tracking-tight leading-[1.1]">
              Investigate with Confidence
            </h2>
            <p className="font-body-md text-on-surface-variant text-base sm:text-xl leading-relaxed max-w-3xl">
              We build tools to aid human investigation, not automated judges that determine truth. DeepVerify provides the signals and visualizations you need to examine the evidence and make your own informed decisions.
            </p>
          </div>
          
          <div className="pt-space-sm">
            <Link 
              to={user ? "/dashboard" : "/login"} 
              className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-primary text-on-primary font-label-lg font-bold shadow-[0_0_32px_rgba(77,142,255,0.3)] hover:shadow-[0_0_48px_rgba(77,142,255,0.5)] hover:bg-primary-fixed hover:text-on-primary-fixed hover:-translate-y-1 transition-all duration-300 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span className="text-lg">{user ? "Open Your Dashboard" : "Launch the Workstation"}</span>
              <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Meaningful Footer */}
      <footer className="w-full bg-surface-container-lowest py-space-xl border-t border-surface-container-highest/60 relative z-10">
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col gap-space-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg text-on-surface-variant">
            {/* Col 1: Platform Brand */}
            <div className="lg:col-span-2 flex flex-col gap-space-sm">
              <div className="flex items-center gap-2">
                <img src="/images/dv_logo_final.png" alt="DV Logo" className="h-[32px] w-auto object-contain pr-1" />
                <span className="font-headline-sm text-lg font-bold">
                  <span className="text-on-surface">Deep</span>
                  <span className="text-[#00C2FF]">Verify</span>
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant max-w-sm leading-relaxed mt-2">
                An advanced AI-powered forensic media verification platform designed for investigators, journalists, and truth-seekers to accurately identify synthetic manipulation and deepfakes.
              </p>
            </div>

            {/* Col 2: Core Capabilities */}
            <div className="flex flex-col gap-space-xs text-xs">
              <span className="font-label-mono text-on-surface font-semibold uppercase text-[11px] tracking-wider mb-2">
                Core Capabilities
              </span>
              <span className="text-on-surface-variant">Spatial EfficientNet Analysis</span>
              <span className="text-on-surface-variant">2D-FFT Frequency Checks</span>
              <span className="text-on-surface-variant">Deterministic Provenance</span>
              <span className="text-on-surface-variant">Secure Vault Enclave</span>
            </div>

            {/* Col 3: Research & Support */}
            <div className="flex flex-col gap-space-xs text-xs">
              <span className="font-label-mono text-on-surface font-semibold uppercase text-[11px] tracking-wider mb-2">
                Initiative
              </span>
              <span className="text-on-surface-variant">Methodology Docs</span>
              <span className="text-on-surface-variant">Research Publications</span>
              <span className="text-on-surface-variant">API Documentation</span>
              <span className="text-on-surface-variant">Contact Support</span>
            </div>
          </div>

          {/* Copyright Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-lg border-t border-outline-variant/20 text-label-mono text-[11px] text-on-surface-variant/60">
            <span>&copy; {new Date().getFullYear()} Computational Forensics Research Initiative. All rights reserved.</span>
            <div className="flex gap-4">
              <span className="hover:text-primary cursor-pointer transition-colors">Privacy Policy</span>
              <span className="hover:text-primary cursor-pointer transition-colors">Terms of Service</span>
              <span className="hover:text-primary cursor-pointer transition-colors">Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
