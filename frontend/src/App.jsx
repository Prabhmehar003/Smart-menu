import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import AdminPortal from './components/AdminPortal';
import ScanVerifier from './components/ScanVerifier';
import CustomerMenuApp from './components/CustomerMenuApp';
import LandingPage from './pages/LandingPage';

export default function App() {
  const [session, setSession] = useState(null);
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) return 'admin';
    return 'landing';
  });

  const path = window.location.pathname;

  useEffect(() => {
    const saved = localStorage.getItem('acid_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (err) {
        localStorage.removeItem('acid_session');
      }
    }

    const handlePopState = () => {
      const p = window.location.pathname;
      if (p.startsWith('/admin')) {
        setCurrentView('admin');
      } else if (p === '/') {
        setCurrentView('landing');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToDashboard = () => {
    window.history.pushState({}, '', '/admin');
    setCurrentView('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (path.startsWith('/scan/')) {
    const token = path.split('/scan/')[1];
    return <ScanVerifier token={token} setSession={setSession} />;
  }

  if (path.startsWith('/menu')) {
    if (session) return <CustomerMenuApp session={session} />;
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center font-mono text-amber-400 p-6 text-center">
        <ShieldAlert className="w-12 h-12 mb-4 text-amber-400 animate-bounce" />
        <h2 className="text-xl font-bold font-display uppercase text-white mb-2">NO ACTIVE DINING SESSION</h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-md">Please scan a table QR code or launch a demo session from the landing page.</p>
        <a href="/" className="px-6 py-3 rounded-full bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider">
          Return to Smart Menu Landing Page
        </a>
      </div>
    );
  }

  if (currentView === 'admin' || path.startsWith('/admin')) {
    return <AdminPortal />;
  }

  return <LandingPage onOpenDemo={navigateToDashboard} />;
}