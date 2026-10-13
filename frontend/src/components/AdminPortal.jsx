import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Loader2, MapPin, ScanLine, Sparkles, CheckCircle2, RefreshCw,
  AlertTriangle, Download, PartyPopper, UtensilsCrossed, QrCode, Zap,
  LayoutDashboard, Settings, Users, Receipt, LogOut, Sun, Moon,
  TrendingUp, Table2, ChevronRight, Plus, Search, Bell, ImagePlus,
} from 'lucide-react';

const PRINT_STYLES = `
  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  @media print {
    body {
      background: #ffffff !important;
      color: #111111 !important;
    }

    .print-hide {
      display: none !important;
    }

    .print-shell {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 12mm !important;
    }

    .print-card {
      border: 1px solid #111111 !important;
      box-shadow: none !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .print-hero {
      background: linear-gradient(135deg, #D6FF00 0%, #FFFFFF 100%) !important;
      color: #111111 !important;
      border-color: #111111 !important;
    }

    .print-qr {
      background: #ffffff !important;
      padding: 10px !important;
      border-radius: 24px !important;
    }

    .print-badge {
      background: #111111 !important;
      color: #ffffff !important;
    }

    .print-muted {
      color: #444444 !important;
    }
  }
`;

const UPLOAD_STEPS = [
  { key: 'geo', label: 'Reading location', icon: MapPin },
  { key: 'scan', label: 'Scanning menu image', icon: ScanLine },
  { key: 'ai', label: 'AI parsing dishes', icon: Sparkles },
  { key: 'images', label: 'Sourcing dish photos', icon: ImagePlus },
  { key: 'done', label: 'Generating table QRs', icon: QrCode },
];

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'tables', label: 'Tables & QRs', icon: Table2 },
  { key: 'orders', label: 'Orders', icon: Receipt },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
];

// ---------------------------------------------------------------------------
// Theming: two modes only — "light" and "jet" (true black, not dark-gray).
// Every themed class below is resolved through this map so components stay
// declarative. Swapping THEME just swaps the token values, not the markup.
// ---------------------------------------------------------------------------
const THEMES = {
  light: {
    page: 'bg-[#F4F3EF] text-[#0a0a0a]',
    sidebar: 'bg-white/70 backdrop-blur-2xl border-white/60',
    sidebarActive: 'bg-[#0a0a0a] text-white',
    sidebarInactive: 'text-[#0a0a0a]/50 hover:bg-black/5 hover:text-[#0a0a0a]',
    topbar: 'bg-white/60 backdrop-blur-2xl border-black/5',
    card: 'bg-white/70 backdrop-blur-2xl border-black/5',
    cardHover: 'hover:border-black/15 hover:bg-white/90',
    input: 'bg-white/70 border-black/10 text-[#0a0a0a] placeholder:text-black/30 focus:border-[#0a0a0a]/40 focus:bg-white',
    textPrimary: 'text-[#0a0a0a]',
    textSecondary: 'text-black/50',
    textMuted: 'text-black/30',
    accentText: 'text-[#7A8F00]',
    accentBg: 'bg-[#D6FF00]',
    accentBorder: 'border-[#7A8F00]/30',
    glow1: 'bg-[#D6FF00]/25',
    glow2: 'bg-[#00A0CF]/15',
    glow3: 'bg-[#CF00A0]/10',
    divider: 'border-black/8',
    statIconBg: 'bg-[#0a0a0a]/5',
  },
  jet: {
    page: 'bg-[#000000] text-white',
    sidebar: 'bg-white/[0.03] backdrop-blur-2xl border-white/10',
    sidebarActive: 'bg-[#D6FF00] text-black',
    sidebarInactive: 'text-white/45 hover:bg-white/5 hover:text-white',
    topbar: 'bg-black/40 backdrop-blur-2xl border-white/10',
    card: 'bg-white/[0.04] backdrop-blur-2xl border-white/10',
    cardHover: 'hover:border-white/25 hover:bg-white/[0.07]',
    input: 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#D6FF00]/50 focus:bg-white/[0.08]',
    textPrimary: 'text-white',
    textSecondary: 'text-white/50',
    textMuted: 'text-white/25',
    accentText: 'text-[#D6FF00]',
    accentBg: 'bg-[#D6FF00]',
    accentBorder: 'border-[#D6FF00]/30',
    glow1: 'bg-[#D6FF00]/10',
    glow2: 'bg-[#00F0FF]/10',
    glow3: 'bg-[#FF00FF]/8',
    divider: 'border-white/10',
    statIconBg: 'bg-white/5',
  },
};

function ThemeToggle({ mode, setMode, t }) {
  return (
    <div className={`flex items-center gap-1 p-1 rounded-full border ${t.divider} ${mode === 'jet' ? 'bg-white/5' : 'bg-black/5'}`}>
      <button
        onClick={() => setMode('light')}
        aria-label="Light theme"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          mode === 'light' ? 'bg-[#0a0a0a] text-white' : `${t.textMuted} hover:${t.textPrimary}`
        }`}
      >
        <Sun size={14} />
      </button>
      <button
        onClick={() => setMode('jet')}
        aria-label="Jet black theme"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          mode === 'jet' ? 'bg-[#D6FF00] text-black' : `${t.textMuted} hover:${t.textPrimary}`
        }`}
      >
        <Moon size={14} />
      </button>
    </div>
  );
}

function UploadProgress({ stepIndex, t }) {
  return (
    <div className="max-w-sm mx-auto space-y-3">
      {UPLOAD_STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isDone = idx < stepIndex;
        const isActive = idx === stepIndex;
        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`flex items-center gap-3 text-left border rounded-xl px-4 py-3 ${t.divider} ${
              isActive ? t.card : 'bg-transparent'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors duration-300 ${
                isDone
                  ? `${t.accentBorder} ${t.accentText} bg-[#D6FF00]/10`
                  : isActive
                    ? 'border-[#00C2D6]/50 text-[#00C2D6] bg-[#00C2D6]/10'
                    : `${t.divider} ${t.textMuted}`
              }`}
            >
              {isDone ? <CheckCircle2 size={14} /> : isActive ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            </div>
            <span className={`font-mono text-xs ${isDone ? t.textSecondary : isActive ? t.textPrimary : t.textMuted}`}>
              {step.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

function SkeletonCard({ t }) {
  return (
    <div className={`border rounded-2xl p-4 flex flex-col items-center animate-pulse ${t.card}`}>
      <div className={`w-[110px] h-[110px] rounded-xl mb-3 ${t.statIconBg}`} />
      <div className={`w-16 h-3 rounded ${t.statIconBg}`} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, t }) {
  return (
    <div className={`border rounded-2xl p-5 flex items-start justify-between ${t.card} ${t.cardHover} transition-all`}>
      <div>
        <p className={`font-mono text-[10px] tracking-widest uppercase ${t.textSecondary} mb-2`}>{label}</p>
        <p className={`text-2xl font-black ${t.textPrimary}`}>{value}</p>
        {sub && <p className={`font-mono text-[10px] mt-1 ${t.textMuted}`}>{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.statIconBg}`}>
        <Icon size={18} className={t.accentText} />
      </div>
    </div>
  );
}

function AdminPortal() {
  const [mode, setMode] = useState('jet'); // 'light' | 'jet'
  const [activeNav, setActiveNav] = useState('tables');
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [numTables, setNumTables] = useState(5);
  const [qrData, setQrData] = useState(null);
  const [error, setError] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcStatus, setNfcStatus] = useState({ kind: 'idle', message: '' });
  const [writingTable, setWritingTable] = useState(null);

  const t = useMemo(() => THEMES[mode], [mode]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setNfcSupported(true);
    }
  }, []);

  const doUpload = useCallback(
    async (file) => {
      setLoading(true);
      setError(null);
      setStepIndex(0);

      const uploadMenu = async (lat, lon) => {
        setStepIndex(1);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('num_tables', String(numTables));
        if (lat != null && lon != null) {
          formData.append('admin_lat', lat);
          formData.append('admin_lon', lon);
        }

        const t1 = setTimeout(() => setStepIndex(2), 600);
        const t2 = setTimeout(() => setStepIndex(3), 1800);

        let res;
        try {
          res = await fetch('/api/process-menu', { method: 'POST', body: formData });
        } catch (networkErr) {
          clearTimeout(t1);
          clearTimeout(t2);
          setLoading(false);
          setError({ kind: 'network', message: 'Could not reach the server. Check your connection and that the backend is running.' });
          return;
        }
        clearTimeout(t1);
        clearTimeout(t2);

        if (!res.ok) {
          let detail = 'Menu processing failed. The image may be unclear or the AI parser hit an error.';
          try {
            const body = await res.json();
            if (body?.detail) detail = body.detail;
          } catch {}
          setLoading(false);
          setError({ kind: 'processing', message: detail });
          return;
        }

        setStepIndex(4);
        const data = await res.json();
        await new Promise((r) => setTimeout(r, 350));
        setQrData(data);
        setLoading(false);
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => uploadMenu(pos.coords.latitude, pos.coords.longitude),
        () => uploadMenu(null, null),
        { timeout: 8000 }
      );
    },
    [numTables]
  );

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    doUpload(file);
  };

  const handleRetry = () => {
    if (pendingFile) doUpload(pendingFile);
  };

  const resetToUpload = () => {
    setQrData(null);
    setError(null);
    setPendingFile(null);
    setNfcStatus({ kind: 'idle', message: '' });
    setWritingTable(null);
  };

  const writeNfcTag = useCallback(async (url, tableId) => {
    if (typeof window === 'undefined' || !('NDEFReader' in window)) {
      setNfcStatus({ kind: 'unsupported', message: 'This browser does not support NFC writing on this device yet.' });
      return;
    }

    setWritingTable(tableId);
    setNfcStatus({ kind: 'writing', message: `Hold your phone near a tag to write the link for Table ${tableId}...` });

    try {
      const ndef = new window.NDEFReader();
      await ndef.write({
        records: [{ recordType: 'url', data: url }],
      });
      setNfcStatus({ kind: 'success', message: `Table ${tableId} is now ready on the tag.` });
    } catch (err) {
      const detail = err?.message || 'NFC write failed. Make sure your device and browser support NFC writing.';
      setNfcStatus({ kind: 'error', message: detail });
    } finally {
      setWritingTable(null);
    }
  }, []);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${t.page}`}>
      <style>{PRINT_STYLES}</style>
      {/* Ambient glow — subtler in light mode, fuller in jet */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-32 left-1/4 w-[600px] h-[600px] rounded-full blur-[140px] ${t.glow1}`} />
        <div className={`absolute bottom-0 -right-32 w-[600px] h-[600px] rounded-full blur-[140px] ${t.glow2}`} />
        <div className={`absolute top-1/2 -left-32 w-[500px] h-[500px] rounded-full blur-[140px] ${t.glow3}`} />
      </div>

      <div className="relative z-10 flex">
        {/* ---------------- Sidebar ---------------- */}
        <aside className={`hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r ${t.sidebar} p-5`}>
          <div className="flex items-center gap-2.5 px-2 mb-8">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.accentBg}`}>
              <UtensilsCrossed size={18} className="text-black" />
            </div>
            <div>
              <p className={`font-black text-sm tracking-tight ${t.textPrimary}`}>ACID COMMAND</p>
              <p className={`font-mono text-[9px] ${t.textMuted}`}>Restaurant OS</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-mono text-xs font-bold tracking-wide transition-colors ${
                    isActive ? t.sidebarActive : t.sidebarInactive
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                  {isActive && <ChevronRight size={14} className="ml-auto" />}
                </button>
              );
            })}
          </nav>

          <div className={`pt-4 border-t ${t.divider}`}>
            <button className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-mono text-xs font-bold tracking-wide transition-colors ${t.sidebarInactive}`}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </aside>

        {/* ---------------- Main column ---------------- */}
        <div className="flex-1 min-w-0">
          {/* Top bar */}
          <header className={`sticky top-0 z-30 border-b ${t.topbar} px-6 py-4 flex items-center justify-between gap-4`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative w-full max-w-xs hidden md:block">
                <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
                <input
                  type="text"
                  placeholder="Search tables, orders..."
                  className={`w-full border rounded-full py-2 pl-9 pr-4 text-xs font-mono outline-none transition-all ${t.input}`}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ThemeToggle mode={mode} setMode={setMode} t={t} />
              <button className={`w-9 h-9 rounded-full border flex items-center justify-center relative ${t.divider} ${t.cardHover} transition-colors`}>
                <Bell size={15} className={t.textSecondary} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF3B3B]" />
              </button>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold ${t.accentBg} text-black`}>
                AC
              </div>
            </div>
          </header>

          <main className="px-6 py-8 max-w-6xl mx-auto">
            {/* Page heading */}
            <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
              <div>
                <h1 className={`text-2xl font-black tracking-tight ${t.textPrimary}`}>Tables & QR codes</h1>
                <p className={`font-mono text-xs mt-1 ${t.textSecondary}`}>
                  Upload a menu to generate a smart, scannable menu with per-table QR codes.
                </p>
              </div>
              {qrData && (
                <button
                  onClick={resetToUpload}
                  className={`flex items-center gap-2 font-mono text-xs font-bold px-4 py-2.5 rounded-full border transition-colors ${t.divider} ${t.cardHover}`}
                >
                  <Plus size={14} /> New menu
                </button>
              )}
            </div>

            {/* Stat row — always visible, gives the page a real "dashboard" feel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Table2} label="Active tables" value={qrData ? qrData.tables.length : numTables} sub="This location" t={t} />
              <StatCard icon={TrendingUp} label="Menus processed" value={qrData ? '1' : '0'} sub="Today" t={t} />
              <StatCard icon={Receipt} label="Orders today" value="0" sub="Live count" t={t} />
              <StatCard icon={Sparkles} label="AI parses" value={qrData ? '1' : '0'} sub="This session" t={t} />
            </div>

            {/* ---------------- Content card ---------------- */}
            <div className={`border rounded-[2rem] p-8 md:p-10 ${t.card}`}>
              <AnimatePresence mode="wait">
                {!qrData && !loading && !error && (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${t.accentBorder} bg-[#D6FF00]/10`}>
                        <Zap size={18} className={t.accentText} />
                      </div>
                      <div>
                        <h2 className={`font-bold text-lg ${t.textPrimary}`}>Upload a new menu</h2>
                        <p className={`font-mono text-[11px] ${t.textMuted}`}>AI parsing · dish photos · secure QR generation</p>
                      </div>
                    </div>

                    <div className="max-w-xl space-y-6">
                      <div className="flex flex-col items-start gap-2 text-left">
                        <label className={`font-mono text-xs font-bold tracking-wide ${t.accentText}`}>TOTAL TABLES / ROOMS</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={numTables}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setNumTables(Number.isNaN(val) ? 1 : val);
                          }}
                          className={`w-full border p-4 rounded-xl font-mono text-lg outline-none transition-all ${t.input}`}
                        />
                      </div>

                      <label
                        className={`relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden ${t.divider} hover:border-[#D6FF00]/60`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-[#D6FF00]/5 group-hover:to-[#00C2D6]/5 transition-all duration-500" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                        <div className={`relative w-16 h-16 rounded-2xl border flex items-center justify-center mb-4 group-hover:scale-105 transition-all ${t.divider} ${t.statIconBg}`}>
                          <Upload className={`w-7 h-7 ${t.textMuted} group-hover:${t.accentText} transition-colors`} />
                        </div>
                        <span className={`relative font-mono font-bold tracking-widest text-xs ${t.accentText}`}>UPLOAD MENU IMAGE</span>
                        <span className={`relative font-mono text-[10px] mt-2 ${t.textMuted}`}>JPG or PNG, one page at a time</span>
                      </label>
                    </div>
                  </motion.div>
                )}

                {loading && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-2">
                    <div className="flex items-center gap-3 mb-6">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                        className={`w-9 h-9 rounded-full border-2 ${t.divider}`}
                        style={{ borderTopColor: '#D6FF00' }}
                      />
                      <h2 className={`font-mono text-sm tracking-wide ${t.textPrimary}`}>Building your smart menu...</h2>
                    </div>
                    <UploadProgress stepIndex={stepIndex} t={t} />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-2xl">
                      {Array.from({ length: Math.min(numTables, 4) }).map((_, i) => (
                        <SkeletonCard key={i} t={t} />
                      ))}
                    </div>
                  </motion.div>
                )}

                {error && !loading && (
                  <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-sm">
                    <div className="w-14 h-14 rounded-2xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/40 flex items-center justify-center mb-5">
                      <AlertTriangle className="w-7 h-7 text-[#FF3B3B]" />
                    </div>
                    <h2 className="text-[#FF3B3B] font-bold text-lg mb-2 tracking-tight">
                      {error.kind === 'network' ? 'CONNECTION LOST' : 'PROCESSING FAILED'}
                    </h2>
                    <p className={`text-xs leading-relaxed mb-6 font-mono ${t.textSecondary}`}>{error.message}</p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleRetry}
                        className={`border font-bold font-mono text-xs px-5 py-3 rounded-xl transition-colors flex items-center gap-2 ${t.divider} hover:border-[#D6FF00] hover:bg-[#D6FF00]/10 ${t.textPrimary}`}
                      >
                        <RefreshCw size={14} /> RETRY
                      </button>
                      <button
                        onClick={resetToUpload}
                        className={`border font-bold font-mono text-xs px-5 py-3 rounded-xl transition-colors ${t.divider} ${t.cardHover} ${t.textSecondary}`}
                      >
                        CHOOSE NEW FILE
                      </button>
                    </div>
                  </motion.div>
                )}

                {qrData && (
                  <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                    <div className={`print-hero print-card mb-6 rounded-[2rem] border p-5 md:p-6 ${t.card}`}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.3em] text-black/70">
                            <PartyPopper size={12} className="text-[#0a0a0a]" />
                            smart table cards
                          </div>
                          <h2 className={`mt-3 font-black text-xl ${t.textPrimary}`}>Your menu is ready for print and tap</h2>
                          <p className={`mt-2 font-mono text-[11px] leading-relaxed ${t.textSecondary}`}>
                            {qrData.restaurant_name} — {qrData.tables.length} table card{qrData.tables.length !== 1 ? 's' : ''} with beautifully styled QR codes and optional NFC tags.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 print-hide">
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className={`text-xs font-mono font-bold px-5 py-3 rounded-full transition-colors flex items-center gap-2 ${t.accentBg} text-black hover:opacity-90`}
                          >
                            <Download size={14} /> EXPORT / PRINT
                          </button>
                        </div>
                      </div>

                      <div className={`mt-4 rounded-[1.4rem] border px-4 py-3 ${t.divider} ${mode === 'jet' ? 'bg-white/5' : 'bg-white/70'}`}>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className={`font-mono text-[10px] uppercase tracking-[0.32em] ${t.textMuted}`}>NFC STATUS</p>
                            <p className={`font-mono text-xs mt-1 ${t.textSecondary}`}>
                              {nfcSupported
                                ? (nfcStatus.message || 'Tap “Write NFC” on any card to transfer the menu link onto a tag.')
                                : 'Web NFC is not available in this browser yet, so the tag writer will stay disabled.'}
                            </p>
                          </div>
                          <div className={`rounded-full px-3 py-1.5 text-[10px] font-mono font-bold uppercase ${nfcSupported ? `${t.accentBg} text-black` : 'bg-white/10 text-white/70'}`}>
                            {nfcSupported ? 'READY' : 'UNAVAILABLE'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="print-shell grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {qrData.tables.map((tbl, idx) => {
                        const url = `${window.location.origin}/scan/${tbl.token}`;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 12, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.08 + idx * 0.04, type: 'spring', damping: 14 }}
                            className={`print-card border rounded-[1.75rem] p-4 flex flex-col items-center transition-all ${t.card} hover:border-[#D6FF00]/40`}
                          >
                            <div className="w-full rounded-[1.3rem] border border-black/10 bg-gradient-to-br from-[#D6FF00]/20 via-white/70 to-[#00C2D6]/10 p-3 mb-3">
                              <div className="print-qr bg-white p-2 rounded-[1.1rem] shadow-[0_0_24px_rgba(214,255,0,0.22)]">
                                <QRCodeSVG value={url} size={150} bgColor="#ffffff" fgColor="#030303" />
                              </div>
                            </div>

                            <div className="w-full rounded-[1.1rem] border border-black/10 bg-white/70 px-3 py-3 text-center">
                              <p className={`font-mono text-[10px] uppercase tracking-[0.3em] ${t.textMuted}`}>Table {tbl.table_id}</p>
                              <p className={`mt-1 font-black text-sm ${t.textPrimary}`}>Scan to open the menu</p>
                              <p className={`mt-1 font-mono text-[10px] leading-relaxed ${t.textMuted}`}>Perfect for guests, printouts, and NFC tap-to-order.</p>
                            </div>

                            <div className="mt-3 flex w-full flex-col gap-2 print-hide">
                              <button
                                type="button"
                                onClick={() => writeNfcTag(url, tbl.table_id)}
                                className={`text-[11px] font-mono font-bold rounded-full border px-4 py-2.5 transition-colors flex items-center justify-center gap-2 ${t.divider} ${t.cardHover} ${t.textPrimary}`}
                              >
                                {writingTable === tbl.table_id ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
                                {writingTable === tbl.table_id ? 'WRITING NFC…' : 'WRITE NFC'}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    <div className="mt-8 flex flex-wrap gap-3 print-hide">
                      <button
                        type="button"
                        onClick={resetToUpload}
                        className={`text-xs font-mono font-bold border px-6 py-3 rounded-full transition-colors ${t.divider} ${t.cardHover} ${t.textPrimary}`}
                      >
                        UPLOAD ANOTHER MENU
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className={`text-xs font-mono font-bold px-6 py-3 rounded-full transition-colors flex items-center gap-2 ${t.accentBg} text-black hover:opacity-90`}
                      >
                        <Download size={14} /> EXPORT / PRINT
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default AdminPortal;