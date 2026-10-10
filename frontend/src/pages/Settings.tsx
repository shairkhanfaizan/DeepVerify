import { useState } from "react";
import { fetchApi } from "../services/api";
import { Loader2, Eye, EyeOff, Save, CheckCircle2, AlertCircle } from "lucide-react";

export function Settings() {
  const [googleApiKey, setGoogleApiKey] = useState(() => localStorage.getItem("deepverify_google_api_key") || "");
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("deepverify_gemini_model") || "gemini-2.5-flash");
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleValidateKey = async () => {
    if (!googleApiKey.trim()) {
      setValidationResult({ valid: false, message: "Please enter an API key to validate." });
      return;
    }
    try {
      setIsValidating(true);
      setValidationResult(null);
      const res = await fetchApi("/api/v2/investigations/assistant/validate-key", {
        method: "POST",
        body: JSON.stringify({ google_api_key: googleApiKey.trim(), gemini_model: selectedModel })
      });
      if (res && res.valid) {
        setValidationResult({ valid: true, message: res.message || "Key validated successfully with Google Gemini!" });
      } else {
        setValidationResult({ valid: false, message: res?.message || "Validation failed: Google rejected this API key." });
      }
    } catch (err: any) {
      setValidationResult({ valid: false, message: err.message || "Connection failed during key validation." });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveAll = () => {
    localStorage.setItem("deepverify_google_api_key", googleApiKey.trim());
    localStorage.setItem("deepverify_gemini_model", selectedModel);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0B1120] text-gray-100 overflow-y-auto font-sans">
      <div className="px-8 py-6 border-b border-[#1E293B]">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-sm text-gray-400">
          Make DeepVerify work the way you like. Everything saves automatically.
        </p>
      </div>

      <div className="p-8 max-w-2xl">
        {saveSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-sm flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5" />
            <span>Configuration saved successfully!</span>
          </div>
        )}

        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-2">Google Gemini API</h2>
          <p className="text-sm text-gray-400 mb-6">
            Connect your API key to enable live AI reasoning in the Forensic Workbench.
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">Google Gemini API Key</label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-3 pr-12 text-sm font-mono text-white focus:outline-none focus:border-[#00E5FF] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">Model Designation</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00E5FF] transition-colors appearance-none"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (Fast, recommended)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (Deep reasoning)</option>
              </select>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleValidateKey}
                disabled={isValidating || !googleApiKey.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1E293B] hover:bg-[#2A3548] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Validate Key
              </button>
              <button
                onClick={handleSaveAll}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#00E5FF] hover:bg-[#00cce6] text-black rounded-lg text-sm font-bold transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Settings
              </button>
            </div>

            {validationResult && (
              <div className={`p-4 rounded-xl text-sm flex items-center gap-3 mt-2 ${
                validationResult.valid ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                {validationResult.valid ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <span>{validationResult.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
