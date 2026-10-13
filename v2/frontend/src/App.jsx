import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import AdminPortal from './components/AdminPortal';
import ScanVerifier from './components/ScanVerifier';
import CustomerMenuApp from './components/CustomerMenuApp';
import LandingPage from './pages/LandingPage';
import Login from './pages/Auth/login';
import SignUp from './pages/Auth/Signup';

function ScanRoute({ setSession }) {
  const { token } = useParams();
  return <ScanVerifier token={token} setSession={setSession} />;
}

function TableRoute({ setSession }) {
  const { code } = useParams();
  return <ScanVerifier code={code} setSession={setSession} />;
}

function CustomerMenuRoute({ session, settings }) {
  if (session) return <CustomerMenuApp session={session} settings={settings} />;
  return (
    <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center font-mono text-amber-400 p-6 text-center">
      <ShieldAlert className="w-12 h-12 mb-4 text-amber-400 animate-bounce" />
      <h2 className="text-xl font-bold font-display uppercase text-white mb-2">NO ACTIVE DINING SESSION</h2>
      <p className="text-sm text-zinc-400 mb-6 max-w-md">Please scan a table QR code or sign in to start your dining session.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="/" className="px-6 py-3 rounded-full bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider shadow-lg hover:brightness-110 transition-all">
          Return to Landing Page
        </a>
        <a href="/signin" className="px-6 py-3 rounded-full border border-amber-400/40 text-amber-400 font-mono font-bold text-xs uppercase tracking-wider hover:bg-amber-400/10 transition-all">
          Sign In
        </a>
      </div>
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem('acid_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_settings_cache');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    fetch('/api/settings')
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => {
        if (data && typeof data === 'object') {
          setSettings(data);
          try {
            localStorage.setItem('smart_menu_settings_cache', JSON.stringify(data));
          } catch {}
        }
      })
      .catch(() => {/* safe fallback */});

    const handleSettingsUpdated = (e) => {
      if (e?.detail) {
        setSettings(e.detail);
        try {
          localStorage.setItem('smart_menu_settings_cache', JSON.stringify(e.detail));
        } catch {}
      }
    };
    window.addEventListener('smart_menu_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('smart_menu_settings_updated', handleSettingsUpdated);
  }, []);

  const navigateToSignIn = () => {
    navigate('/signin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToDashboard = () => {
    navigate('/admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Routes>
      {/* Landing Page: routes to Signin when landing page CTA buttons are clicked */}
      <Route
        path="/"
        element={<LandingPage onOpenDemo={navigateToSignIn} onOpenSignIn={navigateToSignIn} />}
      />

      {/* Auth Routes */}
      <Route path="/signin" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Admin / Dashboard Routes */}
      <Route path="/admin/*" element={<AdminPortal />} />
      <Route path="/dashboard/*" element={<Navigate to="/admin" replace />} />

      {/* Customer Menu Routes */}
      <Route path="/menu/*" element={<CustomerMenuRoute session={session} settings={settings} />} />
      <Route path="/customer-dashboard/*" element={<Navigate to="/menu" replace />} />

      {/* Dynamic Table Proxy Route */}
      <Route path="/t/:code" element={<TableRoute setSession={setSession} />} />

      {/* QR Scan Verification Route */}
      <Route path="/scan/:token" element={<ScanRoute setSession={setSession} />} />

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
