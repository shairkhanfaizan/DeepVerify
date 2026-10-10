import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, UserPlus, LogIn } from "lucide-react";
import { motion } from "framer-motion";

export function Login() {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (authMode === "register") {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (authMode === "login") {
        await login(email.trim(), password);
        navigate("/dashboard");
      } else {
        await register(email.trim(), password);
        setSuccessMsg("Account registered successfully. Redirecting to workstation...");
        setTimeout(() => navigate("/dashboard"), 1000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed. Please check your credentials.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center relative overflow-hidden py-4 px-4">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[140px]"></div>
      <div className="pointer-events-none absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[120px]"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md z-10 flex flex-col"
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6 text-center">
          <Link to="/" className="flex items-center justify-center group mb-2 focus-visible:outline-none">
            <img src="/images/dv_logo_final.png" alt="DV Logo" className="h-[48px] w-auto object-contain group-hover:scale-105 transition-transform duration-300" />
          </Link>
          <h1 className="font-headline-lg text-3xl font-extrabold tracking-tight">
            <span className="text-on-surface">Deep</span>
            <span className="text-[#00C2FF]">Verify</span>
          </h1>
          <p className="font-label-mono text-[10px] uppercase tracking-widest font-bold text-[#00C2FF] mt-1">
            See Beyond The Surface
          </p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="bg-surface-container rounded-xl p-1 mb-4 flex border border-outline-variant/30 shadow-inner">
          <button
            type="button"
            onClick={() => { setAuthMode("login"); setError(""); }}
            className={`flex-1 py-2 text-xs font-label-md font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              authMode === "login"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("register"); setError(""); }}
            className={`flex-1 py-2 text-xs font-label-md font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              authMode === "register"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Register Account</span>
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-space-lg sm:p-space-xl shadow-2xl backdrop-blur-sm flex flex-col gap-space-md">
          {error && (
            <div className="bg-error-container/20 border border-error/40 text-error p-3 rounded-lg flex items-start gap-2.5 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-secondary-container/20 border border-secondary/40 text-secondary p-3 rounded-lg flex items-center gap-2 text-xs">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-mono text-[11px] text-on-surface uppercase tracking-wider">
                Investigator Email / ID
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant material-symbols-outlined text-[18px]">
                  person
                </span>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="examiner@lab.org"
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg h-11 pl-10 pr-3 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-all font-body-sm" 
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-mono text-[11px] text-on-surface uppercase tracking-wider">
                  Passphrase / Key
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant material-symbols-outlined text-[18px]">
                  lock
                </span>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg h-11 pl-10 pr-10 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-all font-body-sm" 
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authMode === "register" && (
              <div className="flex flex-col gap-1.5">
                <label className="font-label-mono text-[11px] text-on-surface uppercase tracking-wider">
                  Confirm Passphrase
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant material-symbols-outlined text-[18px]">
                    lock
                  </span>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg h-11 pl-10 pr-3 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-all font-body-sm" 
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full mt-2 bg-primary text-on-primary h-11 rounded-lg font-label-md text-xs font-semibold hover:bg-primary-fixed hover:text-on-primary-fixed transition-colors flex items-center justify-center gap-2 disabled:opacity-70 shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : authMode === "login" ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>
                {isSubmitting 
                  ? "Authenticating Session..." 
                  : authMode === "login" 
                  ? "Initialize Examiner Session" 
                  : "Register & Initialize"}
              </span>
            </button>
          </form>


        </div>
        
        {/* Back Link */}
        <div className="mt-space-md text-center">
          <Link to="/" className="inline-flex items-center justify-center gap-1.5 text-xs font-label-md text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Return to Public Portal
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
