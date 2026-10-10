import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchApi } from "../../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, LogOut, Home, Folder, Columns, Image as ImageIcon, FileText } from "lucide-react";

export function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const [caseCount, setCaseCount] = useState<number>(0);
  const [photoCount, setPhotoCount] = useState<number>(0);

  useEffect(() => {
    if (user) {
      fetchApi("/api/v2/investigations/")
        .then(async (data: any[]) => {
          if (!data) return;
          setCaseCount(data.length);
          
          // Since the list endpoint might not include full evidence items with the current backend,
          // we fetch the details just like Dashboard and Vault do.
          const detailedPromises = data.map((inv: any) =>
            fetchApi(`/api/v2/investigations/${inv.id}`).catch(() => null)
          );
          const detailedInvs = await Promise.all(detailedPromises);
          
          const totalPhotos = detailedInvs.reduce((acc, inv) => {
            if (!inv || !inv.evidence_items) return acc;
            return acc + inv.evidence_items.length;
          }, 0);
          
          setPhotoCount(totalPhotos);
        })
        .catch(console.error);
    }
  }, [user, location.pathname]);

  const TopNavbar = () => (
    <header className="fixed top-0 left-0 right-0 z-[60] bg-surface/90 backdrop-blur-md border-b border-white/[0.02]">
      <div className="max-w-[1440px] mx-auto px-10 h-[90px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 focus-visible:outline-none group">
          <div className="flex items-center gap-2">
            <img src="/images/dv_logo_final.png" alt="DV Logo" className="h-[42px] w-auto object-contain pr-1 group-hover:scale-105 transition-transform duration-300" />
            <span className="font-bold text-[26px] leading-none tracking-tight">
              <span className="text-white">Deep</span>
              <span className="text-[#00C2FF]">Verify</span>
            </span>
          </div>
        </Link>
        <div className="hidden lg:flex items-center gap-10">
          <a href="#how-it-works" className="text-[13px] font-medium text-white/70 hover:text-white transition-colors tracking-wide">How it Works</a>
          <a href="#under-the-hood" className="text-[13px] font-medium text-white/70 hover:text-white transition-colors tracking-wide">Under the Hood</a>
          <a href="#principles" className="text-[13px] font-medium text-white/70 hover:text-white transition-colors tracking-wide">Principles</a>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] shadow-[0_0_8px_rgba(0,230,118,0.8)]"></span>
            <span className="text-[10px] tracking-[0.2em] font-bold text-[#00e676]">ENGINE ONLINE</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-[14px] font-semibold text-white hover:text-white/80 transition-colors">Log In</Link>
            <Link to="/login" className="h-[42px] px-6 rounded-full bg-[#00C2FF] text-[#020817] font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[#00d0ff] transition-colors shadow-[0_0_20px_rgba(0,194,255,0.2)]">
              Launch Workstation <span className="font-bold">→</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );

  const AuthenticatedLayout = () => {
    return (
      <div className="flex w-full min-h-screen bg-[#0b0f19] font-['Inter',sans-serif] text-white antialiased">
        <aside className="fixed top-0 left-0 h-screen z-50 bg-[#090e17] flex flex-col w-[260px] hidden md:flex border-r border-[#1e293b]/50">
          <div className="h-[80px] flex items-center px-6">
            <Link to="/dashboard" className="flex items-center gap-2 focus-visible:outline-none group">
              <span className="font-bold text-[22px] leading-none tracking-tight flex items-center gap-1.5">
                <span className="text-[#38bdf8] bg-[#111a31] px-1.5 py-0.5 rounded text-lg">DV</span>
                <span className="text-white">DeepVerify</span>
              </span>
            </Link>
          </div>
          
          <div className="flex-1 py-4 flex flex-col gap-1 px-4">
            <Link to="/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border border-transparent ${location.pathname.includes('/dashboard') ? 'bg-[#131b2f] text-white border-l-[3px] !border-l-[#38bdf8]' : 'text-[#8b9cb6] hover:bg-white/5 hover:text-white'}`}>
              <Home className="w-[18px] h-[18px]" />
              <span className="text-[14px] font-medium flex-1">Home</span>
            </Link>
            
            <Link to="/investigations" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border border-transparent ${location.pathname.includes('/investigation') ? 'bg-[#131b2f] text-white border-l-[3px] !border-l-[#38bdf8]' : 'text-[#8b9cb6] hover:bg-white/5 hover:text-white'}`}>
              <Folder className="w-[18px] h-[18px]" />
              <span className="text-[14px] font-medium flex-1">My Cases</span>
              <span className="bg-[#102a43] text-[#38bdf8] text-[11px] font-bold px-2 py-0.5 rounded-full">{caseCount}</span>
            </Link>

            <Link to="/comparison" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border border-transparent ${location.pathname.includes('/compare') || location.pathname.includes('/comparison') ? 'bg-[#131b2f] text-white border-l-[3px] !border-l-[#38bdf8]' : 'text-[#8b9cb6] hover:bg-white/5 hover:text-white'}`}>
              <Columns className="w-[18px] h-[18px]" />
              <span className="text-[14px] font-medium flex-1">Compare</span>
            </Link>
            
            <Link to="/vault" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border border-transparent ${location.pathname.includes('/vault') ? 'bg-[#131b2f] text-white border-l-[3px] !border-l-[#38bdf8]' : 'text-[#8b9cb6] hover:bg-white/5 hover:text-white'}`}>
              <ImageIcon className="w-[18px] h-[18px]" />
              <span className="text-[14px] font-medium flex-1">Photo Vault</span>
              <span className="bg-[#102a43] text-[#38bdf8] text-[11px] font-bold px-2 py-0.5 rounded-full">{photoCount}</span>
            </Link>
            
            <Link to="/reports" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border border-transparent ${location.pathname.includes('/reports') ? 'bg-[#131b2f] text-white border-l-[3px] !border-l-[#38bdf8]' : 'text-[#8b9cb6] hover:bg-white/5 hover:text-white'}`}>
              <FileText className="w-[18px] h-[18px]" />
              <span className="text-[14px] font-medium flex-1">Reports</span>
            </Link>
          </div>
          
          <div className="mt-auto px-4 pb-6 flex flex-col gap-2">
            <Link to="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border border-transparent ${location.pathname.includes('/settings') ? 'bg-[#131b2f] text-white border-l-[3px] !border-l-[#38bdf8]' : 'text-[#8b9cb6] hover:bg-white/5 hover:text-white'}`}>
              <Settings className="w-[18px] h-[18px]" />
              <span className="text-[14px] font-medium flex-1">Settings</span>
            </Link>
            
            <div className="mt-2 p-2 rounded-xl bg-[#090e17] flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors border border-white/5" onClick={handleLogout}>
              <div className="w-8 h-8 rounded-full bg-[#38bdf8] flex items-center justify-center text-[#090e17] font-bold text-sm">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'F'}
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-white leading-tight">{user?.email?.split('@')[0] || 'Faizan'}</span>
                <span className="text-[11px] text-[#8b9cb6]">Student account</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Topbar */}
        <header className="md:hidden fixed top-0 left-0 right-0 h-[64px] z-50 bg-[#090e17] border-b border-white/10 flex items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="font-bold text-[18px] leading-none tracking-tight flex items-center gap-1.5">
              <span className="text-[#38bdf8] bg-[#111a31] px-1.5 py-0.5 rounded text-sm">DV</span>
              <span className="text-white">DeepVerify</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/settings" className="text-[#8b9cb6]"><Settings className="w-5 h-5" /></Link>
            <button onClick={handleLogout} className="text-error"><LogOut className="w-5 h-5" /></button>
          </div>
        </header>

        <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 md:ml-0 md:pl-[260px] pt-[64px] md:pt-0`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex-1 w-full flex flex-col p-6 lg:p-8"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    );
  };

  return (
    <>
      {!user ? (
        <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col">
          <TopNavbar />
          <main className="w-full pt-28 md:pt-32 bg-surface flex-1 flex flex-col">
            <Outlet />
          </main>
        </div>
      ) : (
        <AuthenticatedLayout />
      )}
    </>
  );
}
