import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Investigations } from "./pages/Investigations";
import { Vault } from "./pages/Vault";
import { ForensicWorkbench } from "./pages/ForensicWorkbench";
import { InvestigationComparison } from "./pages/InvestigationComparison";
import { ReportsFindings } from "./pages/ReportsFindings";
import { InvestigationResult } from "./pages/InvestigationResult";
import { Settings } from "./pages/Settings";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            
            {/* Authenticated Workstation Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="investigations" element={<Investigations />} />
              <Route path="cases" element={<Investigations />} />
              <Route path="vault" element={<Vault />} />

              <Route path="comparison" element={<InvestigationComparison />} />
              <Route path="compare" element={<InvestigationComparison />} />
              <Route path="reports" element={<ReportsFindings />} />
              <Route path="settings" element={<Settings />} />

              {/* Case-specific routes */}
              <Route path="investigation/:id" element={<InvestigationResult />} />
              <Route path="case/:id" element={<InvestigationResult />} />
              <Route path="investigation/:id/compare" element={<InvestigationComparison />} />
              <Route path="investigation/:id/evidence/:evidenceId" element={<ForensicWorkbench />} />
              <Route path="investigation/:id/report" element={<ReportsFindings />} />
            </Route>

            <Route path="*" element={
              <div className="container mx-auto py-24 text-center">
                <h1 className="text-4xl font-bold mb-4">404</h1>
                <p className="text-on-surface-variant">Page not found.</p>
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
