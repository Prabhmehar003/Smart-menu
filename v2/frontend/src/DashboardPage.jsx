import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Table2,
  TrendingUp,
  Receipt,
  Users,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  ArrowDownRight,
  Sparkles,
  Clock,
  Layers,
  CheckCircle2,
  UtensilsCrossed,
} from 'lucide-react';
import { api } from './api';
import { STATUS_META } from './theme';

function timeAgo(dateInput) {
  if (!dateInput) return 'recently';
  let dateObj = new Date(dateInput);
  if (isNaN(dateObj.getTime())) {
    const str = String(dateInput).trim().replace(' ', 'T');
    dateObj = new Date(str.endsWith('Z') ? str : str + 'Z');
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date(str);
    }
  }
  if (isNaN(dateObj.getTime())) return 'recently';
  const diffMs = Date.now() - dateObj.getTime();
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * 3D Interactive Floating Glass Card with Cursor-tracked Physics
 * Styled exactly like the ProblemSection glassmorphism reference with compact viewport sizing
 */
function GlassDashboardCard({
  icon: Icon,
  title,
  subtitle,
  zoneNumber = '01',
  zoneLabel = 'SMART MENU OS',
  onClickArrow,
  onHoverChange,
  children,
  index = 0,
}) {
  const localCardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const defaultTranslateZ = index === 1 ? -4 : 0;
  const defaultTranslateY = index === 1 ? 3 : 0;

  const handleMouseMove = useCallback(
    (e) => {
      if (reducedMotion || !localCardRef.current) return;
      const rect = localCardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      requestAnimationFrame(() => {
        setTilt({
          rotateX: -y * 6.5,
          rotateY: x * 6.5,
        });
      });
    },
    [reducedMotion]
  );

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (onHoverChange) onHoverChange(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0 });
    if (onHoverChange) onHoverChange(false);
  };

  const transformStyle = isHovered && !reducedMotion
    ? `translate3d(0px, -6px, 16px) scale(1.015) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
    : `translate3d(0px, ${defaultTranslateY}px, ${defaultTranslateZ}px) scale(1) rotateX(0deg) rotateY(0deg)`;

  return (
    <div
      ref={localCardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-[22px] p-4 sm:p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none will-change-[transform,opacity,filter,box-shadow] ${
        isHovered ? 'z-30' : 'z-10'
      }`}
      style={{
        transform: transformStyle,
        backgroundColor: isHovered ? 'rgba(10, 12, 18, 0.82)' : 'rgba(8, 9, 14, 0.68)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: isHovered ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isHovered
          ? '0 24px 50px -10px rgba(0, 0, 0, 0.95), 0 0 35px rgba(245, 158, 11, 0.16), inset 0 1px 1px rgba(255, 255, 255, 0.25), inset 0 0 20px rgba(245, 158, 11, 0.04)'
          : '0 16px 40px -10px rgba(0, 0, 0, 0.85), inset 0 1px 1px rgba(255, 255, 255, 0.12)',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Radial glow highlight behind card on hover */}
      <div
        className="absolute -inset-5 rounded-[32px] pointer-events-none transition-opacity duration-400 ease-out"
        style={{
          background: 'radial-gradient(circle, rgba(0, 0, 0, 0.85) 0%, rgba(245, 158, 11, 0.08) 50%, transparent 75%)',
          filter: 'blur(22px)',
          opacity: isHovered ? 1 : 0,
          zIndex: -1,
        }}
      />

      {/* Internal warm rim light highlight along top border */}
      <div
        className="absolute top-0 left-6 right-6 h-[1px] pointer-events-none transition-opacity duration-300"
        style={{
          background: isHovered
            ? 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.9) 50%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
          opacity: isHovered ? 1 : 0.6,
        }}
      />

      {/* Card Header & Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Icon Squircle */}
        <div className="flex items-center justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              backgroundColor: isHovered ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.10)',
              border: isHovered ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(245, 158, 11, 0.20)',
              boxShadow: isHovered ? '0 0 16px rgba(245, 158, 11, 0.30)' : 'none',
              transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
            }}
          >
            <Icon className="w-4 h-4 text-amber-400" />
          </div>

          {onClickArrow && (
            <button
              onClick={onClickArrow}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-white/5 transition-colors cursor-pointer"
              title="Navigate"
            >
              <ArrowDownRight
                className={`w-4 h-4 transition-transform duration-300 ${
                  isHovered ? 'text-amber-400 translate-x-0.5 translate-y-0.5' : 'text-zinc-500'
                }`}
              />
            </button>
          )}
        </div>

        {/* Card Title & Subtitle */}
        <div className="mb-2.5">
          <h3 className="text-base sm:text-lg font-bold font-display uppercase tracking-wide text-white flex items-center justify-between">
            <span className={`transition-colors duration-200 ${isHovered ? 'text-amber-300' : 'text-white'}`}>
              {title}
            </span>
          </h3>
          {subtitle && (
            <p className="text-zinc-400 text-[11px] font-sans mt-0.5 leading-normal line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 flex flex-col justify-between">
          {children}
        </div>
      </div>

      {/* Card Footer Bar */}
      <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-[9px] font-mono">
        <span className="text-zinc-400">ZONE {zoneNumber}</span>
        <span
          className={`font-bold tracking-wider transition-colors duration-200 ${
            isHovered ? 'text-amber-300' : 'text-amber-400/90'
          }`}
        >
          {zoneLabel}
        </span>
      </div>
    </div>
  );
}

function DashboardPage({ t, mode, onNavigate, settings = {} }) {
  const [stats, setStats] = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_dashboard_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('smart_menu_dashboard_cache');
    } catch {
      return true;
    }
  });
  const [error, setError] = useState(null);
  const [isRecentHovered, setIsRecentHovered] = useState(false);
  const videoRef = useRef(null);

  const displayName = settings.restaurant_name || 'SMART MENU';

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getDashboard();
      if (data) {
        setStats(data);
        try {
          localStorage.setItem('smart_menu_dashboard_cache', JSON.stringify(data));
        } catch {}
      }
    } catch (e) {
      if (!stats) setError(e.message || 'Could not load dashboard stats.');
    } finally {
      setLoading(false);
    }
  }, [stats]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);

    const handleUpdate = () => {
      load();
    };
    window.addEventListener('smart_menu_orders_updated', handleUpdate);
    window.addEventListener('smart_menu_dashboard_updated', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('smart_menu_orders_updated', handleUpdate);
      window.removeEventListener('smart_menu_dashboard_updated', handleUpdate);
    };
  }, [load]);

  // Reliable autoplay & mute handler
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.defaultMuted = true;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Dashboard background video autoplay prevented:', err);
        });
      }
    }
  }, []);

  return (
    <div className="relative w-full min-h-[calc(100vh-80px)] overflow-hidden flex flex-col justify-start items-center pt-3 sm:pt-5 lg:pt-6 pb-8 lg:pb-10">
      {/* ========================================================================= */}
      {/* 1. CINEMATIC BACKGROUND VIDEO (PROPERLY VISIBLE & CRISP)                   */}
      {/* Path: /videos/smart_menu_watermark_removed.mp4                            */}
      {/* ========================================================================= */}
      <video
        ref={videoRef}
        src="/videos/smart_menu_watermark_removed.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="fixed inset-0 w-full h-full object-cover object-center pointer-events-none z-0"
        style={{
          filter: 'contrast(1.05) saturate(1.04) brightness(0.96)',
        }}
      />

      {/* 2a. Light Charcoal Glass Veil */}
      <div className="fixed inset-0 bg-[#06070a]/45 pointer-events-none z-[1]" />

      {/* 2b. Top and bottom subtle gradient vignettes */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#050508]/80 via-transparent to-[#05060a]/80 pointer-events-none z-[2]" />

      {/* 2c. Soft warm ambient restaurant light accent glow */}
      <div
        className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none z-[2]"
        style={{
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, rgba(244, 63, 94, 0.03) 45%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />

      {/* ========================================================================= */}
      {/* 3. CONTENT CONTAINER (Loading, Error, or Dashboard View)                  */}
      {/* ========================================================================= */}
      {loading && !stats ? (
        <div className="relative z-10 min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl shadow-2xl">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
          </div>
          <p className="font-mono text-xs text-zinc-400 tracking-wider uppercase">Loading Restaurant OS...</p>
        </div>
      ) : error && !stats ? (
        <div className="relative z-10 min-h-[60vh] flex items-center justify-center p-6">
          <div className="border border-white/10 rounded-3xl p-8 bg-[#0c0e14]/80 backdrop-blur-2xl max-w-md w-full shadow-2xl">
            <AlertTriangle className="w-8 h-8 text-[#FF3B3B] mb-4" />
            <h2 className="font-bold font-display text-lg text-white mb-2">Couldn't load dashboard</h2>
            <p className="font-mono text-xs text-zinc-400 mb-6">{error}</p>
            <button
              onClick={load}
              className="font-mono text-xs font-bold px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black flex items-center gap-2 hover:brightness-110 cursor-pointer shadow-lg shadow-amber-500/25"
            >
              <RefreshCw size={14} /> RETRY CONNECTION
            </button>
          </div>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 mt-1 sm:mt-2">
        {/* Perfectly Proportioned Centered Header (Single-line hero balance) */}
        <div className="text-center max-w-5xl mx-auto mb-6 sm:mb-7 lg:mb-8 space-y-2 sm:space-y-2.5">
          <h1 className="text-3xl sm:text-4xl md:text-[46px] lg:text-[54px] xl:text-[58px] font-black font-display uppercase tracking-tight text-white leading-tight whitespace-nowrap">
            RESTAURANT <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">OPERATIONS HUB</span>
          </h1>

          <p className="text-zinc-300 text-sm sm:text-[15px] md:text-base lg:text-[17px] font-sans tracking-wide flex items-center justify-center flex-wrap gap-2.5 sm:gap-3">
            <span>Real-time visibility.</span>
            <span className="text-amber-400/60 hidden sm:inline">•</span>
            <span>Intelligent insights.</span>
            <span className="text-amber-400/60 hidden sm:inline">•</span>
            <span>Complete control.</span>
          </p>
        </div>

        {/* Action Row Aligned Above Recent Transactions Card */}
        <div className="flex justify-end mb-2.5">
          <button
            onClick={load}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0c0e14]/75 border border-white/15 hover:border-amber-400/45 text-zinc-300 hover:text-amber-400 backdrop-blur-xl font-mono text-[11px] font-semibold tracking-wider uppercase transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer shadow-lg hover:shadow-amber-500/20 ${
              isRecentHovered
                ? '-translate-y-3.5 shadow-amber-500/30 border-amber-400/40 text-amber-300'
                : 'translate-y-0'
            }`}
            title="Refresh stream"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-amber-400' : ''} />
            <span>REFRESH</span>
          </button>
        </div>

        {/* ======================================================================= */}
        {/* 3 CENTERED GLASSMORPHISM CARDS (With balanced spacing and gaps)          */}
        {/* ======================================================================= */}
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch"
          style={{ perspective: '1400px' }}
        >
          {/* ───────────────────────────────────────────────────────────────── */}
          {/* CARD 1: OPERATIONS OVERVIEW                                       */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <GlassDashboardCard
            index={0}
            icon={Layers}
            title="OPERATIONS OVERVIEW"
            subtitle="Primary operational telemetry and active menu catalog status."
            zoneNumber="01"
            zoneLabel="SMART MENU OVERVIEW"
            onClickArrow={() => onNavigate('tables')}
          >
            <div className="space-y-2.5 my-1">
              {/* Stat 1: Total Customers */}
              <div className="group/stat">
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-400 font-semibold">
                  TOTAL CUSTOMERS
                </p>
                <p className="text-2xl sm:text-3xl font-black font-mono text-white mt-0.5 group-hover/stat:text-amber-400 transition-colors">
                  {stats.total_customers}
                </p>
                <p className="font-mono text-[10px] text-zinc-400">
                  Unique guests served across all tables
                </p>
              </div>

              {/* Stat 2: Menus Processed */}
              <div className="group/stat pt-1.5 border-t border-white/[0.08]">
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-400 font-semibold">
                  MENUS PROCESSED
                </p>
                <p className="text-2xl sm:text-3xl font-black font-mono text-white mt-0.5 group-hover/stat:text-amber-400 transition-colors">
                  {stats.menus_processed}
                </p>
                <p className="font-mono text-[10px] text-zinc-400">
                  Digital menu catalogs active in database
                </p>
              </div>

              {/* Active Menu Pod */}
              {stats.latest_menu && (
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5">
                  <p className="font-mono text-[8.5px] uppercase tracking-widest text-zinc-400 font-semibold">
                    CURRENT ACTIVE CATALOG
                  </p>
                  <p className="text-xs sm:text-sm font-black font-display text-amber-400 uppercase tracking-wide mt-0.5 truncate">
                    {stats.latest_menu.restaurant_name}
                  </p>
                  <p className="font-mono text-[9.5px] text-zinc-300 flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 size={11} className="text-emerald-400" />
                    <span>Live Synchronized</span>
                  </p>
                </div>
              )}
            </div>

            {/* Quick Action Button */}
            <button
              onClick={() => onNavigate('tables')}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-gradient-to-r hover:from-amber-500 hover:via-amber-400 hover:to-amber-500 text-white hover:text-black border border-white/15 hover:border-amber-400 font-mono text-[11px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-amber-500/25"
            >
              <span>Manage Tables & QRs</span>
              <ArrowRight size={12} />
            </button>
          </GlassDashboardCard>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* ZONE 2: 2x2 STANDALONE KPI MATRIX + VIEW ALL ORDERS ACTION        */}
          {/* (Outer wrapper removed as requested in image reference)           */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="flex flex-col justify-between h-full">
            <div className="grid grid-cols-2 gap-3 sm:gap-3.5 flex-1 mb-3">
              {/* KPI 1: Orders Today */}
              <div
                className="relative rounded-[22px] p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 select-none cursor-pointer border bg-[#080a10]/70 backdrop-blur-2xl border-white/12 hover:border-amber-400/35 shadow-[0_14px_35px_rgba(0,0,0,0.75)] hover:-translate-y-1 hover:scale-[1.015] group"
                style={{
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/20 group-hover:via-amber-400/40 to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-2">
                  <Receipt size={18} className="text-zinc-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="my-auto py-1">
                  <p className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tight text-white">
                    {stats.orders_today}
                  </p>
                </div>
                <div className="space-y-0.5 pt-1.5 border-t border-white/[0.06]">
                  <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-zinc-300 group-hover:text-white transition-colors">
                    ORDERS TODAY
                  </p>
                  <p className="font-mono text-[9px] text-zinc-500">
                    Since midnight
                  </p>
                </div>
              </div>

              {/* KPI 2: Revenue Today */}
              <div
                className="relative rounded-[22px] p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 select-none cursor-pointer border bg-[#080a10]/70 backdrop-blur-2xl border-white/12 hover:border-amber-400/35 shadow-[0_14px_35px_rgba(0,0,0,0.75)] hover:-translate-y-1 hover:scale-[1.015] group"
                style={{
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/20 group-hover:via-amber-400/40 to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp size={18} className="text-zinc-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="my-auto py-1">
                  <p className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tight text-white">
                    ${stats.revenue_today.toFixed(2)}
                  </p>
                </div>
                <div className="space-y-0.5 pt-1.5 border-t border-white/[0.06]">
                  <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-zinc-300 group-hover:text-white transition-colors">
                    REVENUE TODAY
                  </p>
                  <p className="font-mono text-[9px] text-zinc-500">
                    Gross sales
                  </p>
                </div>
              </div>

              {/* KPI 3: Active Orders (Accent Gold) */}
              <div
                className="relative rounded-[22px] p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 select-none cursor-pointer border bg-gradient-to-b from-[#181c28]/85 via-[#0f1320]/90 to-[#070912]/95 border-amber-400/50 shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_25px_rgba(245,158,11,0.18)] hover:-translate-y-1 hover:scale-[1.015]"
                style={{
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-amber-400/75 to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-2">
                  <Sparkles size={18} className="text-amber-400" />
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-[8px] font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#f59e0b]" />
                    LIVE
                  </span>
                </div>
                <div className="my-auto py-1">
                  <p className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">
                    {stats.active_orders}
                  </p>
                </div>
                <div className="space-y-0.5 pt-1.5 border-t border-amber-400/20">
                  <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-amber-300">
                    ACTIVE ORDERS
                  </p>
                  <p className="font-mono text-[9px] text-amber-400/80">
                    In preparation
                  </p>
                </div>
              </div>

              {/* KPI 4: Active Tables */}
              <div
                className="relative rounded-[22px] p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 select-none cursor-pointer border bg-[#080a10]/70 backdrop-blur-2xl border-white/12 hover:border-amber-400/35 shadow-[0_14px_35px_rgba(0,0,0,0.75)] hover:-translate-y-1 hover:scale-[1.015] group"
                style={{
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/20 group-hover:via-amber-400/40 to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-2">
                  <Table2 size={18} className="text-zinc-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="my-auto py-1">
                  <p className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tight text-white">
                    {stats.active_tables}
                  </p>
                </div>
                <div className="space-y-0.5 pt-1.5 border-t border-white/[0.06]">
                  <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-zinc-300 group-hover:text-white transition-colors">
                    ACTIVE TABLES
                  </p>
                  <p className="font-mono text-[9px] text-zinc-500">
                    Issued QR codes
                  </p>
                </div>
              </div>
            </div>

            {/* Standalone Bottom Button matching image */}
            <button
              onClick={() => onNavigate('orders')}
              className="w-full py-2.5 sm:py-3 px-4 rounded-2xl bg-white/[0.06] hover:bg-gradient-to-r hover:from-amber-500 hover:via-amber-400 hover:to-amber-500 text-white hover:text-black border border-white/15 hover:border-amber-400 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg backdrop-blur-xl hover:shadow-[0_0_25px_rgba(245,158,11,0.45)]"
            >
              <span>VIEW ALL ORDERS</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* CARD 3: RECENT TRANSACTIONS (Order Stream Queue)                 */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <GlassDashboardCard
            index={2}
            icon={Receipt}
            title="RECENT TRANSACTIONS"
            subtitle="Real-time stream of incoming customer table orders."
            zoneNumber="03"
            zoneLabel="ORDER STREAM"
            onClickArrow={() => onNavigate('orders')}
            onHoverChange={setIsRecentHovered}
          >
            <div className="space-y-1.5 my-auto">
              {stats.recent_orders.length === 0 ? (
                <div className="py-8 text-center rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                    No orders yet. Table scans will populate here live.
                  </p>
                </div>
              ) : (
                stats.recent_orders.slice(0, 4).map((order, idx) => {
                  const meta = STATUS_META[order.status] || STATUS_META.transmitted;
                  const dotColor = meta.color || '#f59e0b';
                  const isFirst = idx === 0;

                  return (
                    <motion.div
                      key={order.order_id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`group/row flex items-center justify-between gap-2.5 rounded-xl ${
                        isFirst
                          ? 'bg-white/[0.06] border-white/20 shadow-sm'
                          : 'bg-white/[0.025] hover:bg-white/[0.06] border-white/10 hover:border-amber-400/35'
                      } border px-3 py-1.5 transition-all duration-200 cursor-pointer`}
                    >
                      {/* Left: Indicator & Details */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_5px_currentColor]"
                          style={{ backgroundColor: dotColor, color: dotColor }}
                        />
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] font-bold text-white truncate flex items-center gap-1.5">
                            <span>#{order.order_id}</span>
                            <span className="text-zinc-500 font-normal">•</span>
                            <span className="text-zinc-200 font-sans font-semibold truncate">
                              {order.customer_name}
                            </span>
                          </p>
                          <p className="font-mono text-[8.5px] text-zinc-400">
                            Table <span className="text-white font-semibold">{order.table_id}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Total & Timestamp */}
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[11px] sm:text-xs font-extrabold text-white">
                          ${order.total.toFixed(2)}
                        </p>
                        <p className="font-mono text-[8.5px] text-zinc-400 flex items-center gap-1 justify-end">
                          <Clock size={8} />
                          <span>{timeAgo(order.created_at)}</span>
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Quick Action Button */}
            <button
              onClick={() => onNavigate('orders')}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-gradient-to-r hover:from-amber-500 hover:via-amber-400 hover:to-amber-500 text-white hover:text-black border border-white/15 hover:border-amber-400 font-mono text-[11px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-amber-500/25"
            >
              <span>Live Order Monitor</span>
              <ArrowRight size={12} />
            </button>
          </GlassDashboardCard>
        </div>
      </div>
      )}
    </div>
  );
}

export default DashboardPage;