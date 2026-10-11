import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchApi } from "../../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

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

  // Sidebar collapse state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("deepverify_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // Mobile menu drawer open state
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("deepverify_sidebar_collapsed", String(next));
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      fetchApi("/api/v2/investigations/")
        .then(async (data: any[]) => {
          if (!data) return;
          setCaseCount(data.length);

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

  const navItems = [
    {
      to: "/dashboard",
      label: "Home",
      match: "/dashboard",
      svg: (
        <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      )
    },
    {
      to: "/investigations",
      label: "My Cases",
      match: "/investigation",
      count: caseCount,
      svg: (
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      )
    },
    {
      to: "/compare",
      label: "Compare",
      match: "/compare",
      svg: (
        <>
          <rect x="3" y="4" width="8" height="16" rx="2" />
          <rect x="13" y="4" width="8" height="16" rx="2" />
        </>
      )
    },
    {
      to: "/vault",
      label: "Media Vault",
      match: "/vault",
      count: photoCount,
      svg: (
        <>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="9" cy="9" r="2" />
          <path d="M3 17l5-5 4 4 3-3 6 6" />
        </>
      )
    },
    {
      to: "/reports",
      label: "Reports",
      match: "/reports",
      svg: (
        <>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v4h4M9 13h7M9 17h7" />
        </>
      )
    }
  ];

  const TopNavbar = () => (
    <header className="fixed top-0 left-0 right-0 z-[60] bg-surface/90 backdrop-blur-md border-b border-white/[0.02]">
      <div className="max-w-[1440px] mx-auto px-10 h-[90px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 focus-visible:outline-none group">
          <div className="flex items-center gap-2">
            <img
              src="/images/dv_logo_final.png"
              alt="DV Logo"
              className="h-[42px] w-auto object-contain pr-1 group-hover:scale-105 transition-transform duration-300"
            />
            <span className="font-bold text-[26px] leading-none tracking-tight">
              <span className="text-white">Deep</span>
              <span className="text-[#00C2FF]">Verify</span>
            </span>
          </div>
        </Link>
        <div className="hidden lg:flex items-center gap-10">
          <a
            href="#how-it-works"
            className="text-[13px] font-medium text-white/70 hover:text-white transition-colors tracking-wide"
          >
            How it Works
          </a>
          <a
            href="#under-the-hood"
            className="text-[13px] font-medium text-white/70 hover:text-white transition-colors tracking-wide"
          >
            Under the Hood
          </a>
          <a
            href="#principles"
            className="text-[13px] font-medium text-white/70 hover:text-white transition-colors tracking-wide"
          >
            Principles
          </a>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] shadow-[0_0_8px_rgba(0,230,118,0.8)]"></span>
            <span className="text-[10px] tracking-[0.2em] font-bold text-[#00e676]">ENGINE ONLINE</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              to="/login"
              className="text-[14px] font-semibold text-white hover:text-white/80 transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/login"
              className="h-[42px] px-6 rounded-full bg-[#00C2FF] text-[#020817] font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[#00d0ff] transition-colors shadow-[0_0_20px_rgba(0,194,255,0.2)]"
            >
              Launch Workstation <span className="font-bold">→</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );

  if (!user) {
    return (
      <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col">
        <TopNavbar />
        <main className="w-full pt-[90px] bg-surface flex-1 flex flex-col">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-screen text-white antialiased">
      {/* Desktop Collapsible Sidebar with exact Theme Radiant */}
      <aside
        className={`side hidden md:flex fixed top-0 bottom-0 left-0 z-40 transition-all duration-150 ease-out ${
          isCollapsed ? "collapsed" : ""
        }`}
      >
        {/* Header with Logo and Hamburger Compress / Extend Toggle */}
        <div
          className={`flex items-center transition-all duration-150 pb-5 mb-2 border-b border-white/[0.06] ${
            isCollapsed ? "flex-col justify-center gap-2 px-1 pb-4" : "justify-between px-1"
          }`}
        >
          {!isCollapsed ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-2 focus-visible:outline-none group shrink-0"
              >
                <img
                  src="/images/dv_logo_final.png"
                  alt="DV Logo"
                  className="h-[30px] w-auto object-contain pr-0.5 group-hover:scale-105 transition-transform duration-150 shrink-0"
                />
                <span className="font-bold text-[20px] leading-none tracking-tight whitespace-nowrap shrink-0">
                  <span className="text-white">Deep</span>
                  <span className="text-[#00C2FF]">Verify</span>
                </span>
              </Link>
              <button
                id="sidebar-toggle-btn"
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-[#8b9cb6] hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-[#00C2FF]/50 shrink-0"
                title="Compress navbar"
                aria-label="Compress navbar"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 transition-transform duration-150"
                >
                  <line x1="3" y1="6" x2="15" y2="6" />
                  <line x1="3" y1="12" x2="13" y2="12" />
                  <line x1="3" y1="18" x2="15" y2="18" />
                  <polyline points="19 8 15 12 19 16" />
                </svg>
              </button>
            </>
          ) : (
            <>
              {/* Logo FIRST on top */}
              <Link
                to="/dashboard"
                title="DeepVerify Dashboard"
                className="flex items-center justify-center p-1 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none group mb-0.5"
              >
                <img
                  src="/images/dv_logo_final.png"
                  alt="DV Logo"
                  className="h-[28px] w-auto object-contain group-hover:scale-110 transition-transform duration-150"
                />
              </Link>
              {/* Hamburger Symbol strictly BELOW the logo */}
              <button
                id="sidebar-toggle-btn"
                type="button"
                onClick={toggleSidebar}
                className="p-2 rounded-lg text-[#8b9cb6] hover:text-[#00C2FF] hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-[#00C2FF]/50 group"
                title="Extend navbar"
                aria-label="Extend navbar"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 transition-transform duration-150"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="nav" id="nav">
          {navItems.map((item) => {
            const isActive = location.pathname.includes(item.match);
            if (isCollapsed) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={
                    item.count !== undefined && item.count > 0
                      ? `${item.label} (${item.count})`
                      : item.label
                  }
                  className={`relative flex items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                    isActive ? "on" : ""
                  }`}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    {item.svg}
                  </svg>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[rgba(56,189,248,.9)] text-[#04122b] text-[10px] font-extrabold flex items-center justify-center leading-none">
                      {item.count > 99 ? "99+" : item.count}
                    </span>
                  )}
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={isActive ? "on" : ""}
              >
                <svg className="ico" viewBox="0 0 24 24">
                  {item.svg}
                </svg>
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <em className="badge">{item.count}</em>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sp" />

        {/* Settings */}
        <nav className="nav">
          {isCollapsed ? (
            <Link
              to="/settings"
              title="Settings"
              className={`flex items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                location.pathname.includes("/settings") ? "on" : ""
              }`}
            >
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </Link>
          ) : (
            <Link
              to="/settings"
              className={location.pathname.includes("/settings") ? "on" : ""}
            >
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
              <span>Settings</span>
            </Link>
          )}
        </nav>

        {/* User Profile Card */}
        {isCollapsed ? (
          <div
            className="me justify-center p-2"
            onClick={handleLogout}
            title={`Logged in as ${user?.email || "Faizan"}. Click to log out.`}
          >
            <div className="av">
              {user?.email ? user.email.charAt(0).toUpperCase() : "F"}
            </div>
          </div>
        ) : (
          <div
            className="me"
            onClick={handleLogout}
            title={`Logged in as ${user?.email || "Faizan"}. Click to log out.`}
          >
            <div className="av">
              {user?.email ? user.email.charAt(0).toUpperCase() : "F"}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <b>{localStorage.getItem("deepverify_user_name") || user?.email?.split("@")[0] || "Faizan"}</b>
              <small>Student account</small>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Topbar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-[64px] z-40 bg-[rgba(6,13,31,0.9)] backdrop-blur-md border-b border-[var(--line)] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            id="mobile-menu-btn"
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-[#8b9cb6] hover:text-white hover:bg-white/5 transition-colors focus:outline-none"
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 focus-visible:outline-none group">
            <img
              src="/images/dv_logo_final.png"
              alt="DV Logo"
              className="h-[30px] w-auto object-contain pr-0.5 group-hover:scale-105 transition-transform duration-300"
            />
            <span className="font-bold text-[20px] leading-none tracking-tight">
              <span className="text-white">Deep</span>
              <span className="text-[#00C2FF]">Verify</span>
            </span>
          </Link>
        </div>
        <div
          className="av"
          style={{ width: "32px", height: "32px", fontSize: "12px", cursor: "pointer" }}
          onClick={handleLogout}
          title="Click to log out"
        >
          {user?.email ? user.email.charAt(0).toUpperCase() : "F"}
        </div>
      </header>

      {/* Mobile Slide-Over Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="side md:hidden fixed top-0 left-0 bottom-0 z-50 shadow-2xl"
              style={{ width: "260px" }}
            >
              <div className="flex items-center justify-between pb-4 mb-2 border-b border-white/[0.06]">
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 focus-visible:outline-none group"
                >
                  <img
                    src="/images/dv_logo_final.png"
                    alt="DV Logo"
                    className="h-[30px] w-auto object-contain pr-0.5 group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="font-bold text-[20px] leading-none tracking-tight">
                    <span className="text-white">Deep</span>
                    <span className="text-[#00C2FF]">Verify</span>
                  </span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg text-[#8b9cb6] hover:text-white hover:bg-white/5"
                  title="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="nav">
                {navItems.map((item) => {
                  const isActive = location.pathname.includes(item.match);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={isActive ? "on" : ""}
                    >
                      <svg className="ico" viewBox="0 0 24 24">
                        {item.svg}
                      </svg>
                      <span>{item.label}</span>
                      {item.count !== undefined && item.count > 0 && (
                        <em className="badge">{item.count}</em>
                      )}
                    </Link>
                  );
                })}
              </nav>

              <div className="sp" />

              <nav className="nav">
                <Link
                  to="/settings"
                  onClick={() => setMobileOpen(false)}
                  className={location.pathname.includes("/settings") ? "on" : ""}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                  </svg>
                  <span>Settings</span>
                </Link>
              </nav>

              <div
                className="me"
                onClick={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
                title="Click to log out"
              >
                <div className="av">
                  {user?.email ? user.email.charAt(0).toUpperCase() : "F"}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <b>{localStorage.getItem("deepverify_user_name") || user?.email?.split("@")[0] || "Faizan"}</b>
                  <small>Student account</small>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-150 ease-out md:ml-0 ${
          isCollapsed ? "md:pl-[76px]" : "md:pl-[260px]"
        } pt-[64px] md:pt-0`}
      >
        <div className="flex-1 w-full flex flex-col px-6 lg:px-10 pb-16 pt-2 md:pt-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
