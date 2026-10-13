// TableStandStudioModal.jsx — Interactive Table Stand Generator & Print Export Studio
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  X, Download, FileText, Sparkles, Wifi, Layers, CheckCircle2,
  Printer, FileCode, Image as ImageIcon, ChevronLeft, ChevronRight, Check,
} from 'lucide-react';
import {
  downloadSingleTableStandSvg,
  downloadSingleTableStandPdf,
  downloadSingleTableStandPng,
  downloadBulkMultiPagePdf,
} from '../utils/standExport';

const STAND_STYLES = [
  {
    id: 'sticker',
    label: 'Table Sticker Decal',
    sub: '100×100mm Laminated Adhesive Badge',
    badge: 'ALL-IN-ONE DECAL',
  },
];

export default function TableStandStudioModal({
  isOpen,
  onClose,
  allItems = [],
  initialTableId = null,
  restaurantName = 'SMART MENU',
  autoAction = null, // optional: 'pdf' | 'single-pdf'
  onAutoActionComplete,
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [layoutStyle, setLayoutStyle] = useState('sticker');
  const [showPrintMarks, setShowPrintMarks] = useState(false);
  const [includeCounter, setIncludeCounter] = useState(true);
  const [exportingMode, setExportingMode] = useState(null); // 'pdf' | 'single-pdf' | 'single-svg' | 'single-png' | null
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [exportSuccess, setExportSuccess] = useState('');

  // Filter items based on includeCounter toggle for bulk PDF export
  const bulkItems = useMemo(() => {
    if (includeCounter) return allItems;
    return allItems.filter((item) => item.table_id !== 'COUNTER' && !item.isCounter);
  }, [allItems, includeCounter]);

  useEffect(() => {
    if (isOpen && allItems.length > 0) {
      if (initialTableId != null) {
        const idx = allItems.findIndex((i) => String(i.table_id) === String(initialTableId));
        setSelectedIdx(idx >= 0 ? idx : 0);
      } else {
        const firstTableIdx = allItems.findIndex((i) => i.table_id !== 'COUNTER' && !i.isCounter);
        setSelectedIdx(firstTableIdx >= 0 ? firstTableIdx : 0);
      }
      setExportSuccess('');
    }
  }, [isOpen, initialTableId, allItems]);

  useEffect(() => {
    if (isOpen && autoAction && bulkItems.length > 0 && !exportingMode) {
      if (autoAction === 'pdf') {
        handleBulkPdf();
      } else if (autoAction === 'single-pdf') {
        handleSinglePdf();
      }
      if (onAutoActionComplete) onAutoActionComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoAction]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !exportingMode) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, exportingMode, onClose]);

  if (!isOpen || allItems.length === 0) return null;

  const currentItem = allItems[selectedIdx] || allItems[0];
  const isCounter = currentItem.table_id === 'COUNTER' || currentItem.isCounter;
  const rawTitle = isCounter
    ? (currentItem.table_name && currentItem.table_name !== 'Central Service Window'
        ? currentItem.table_name
        : 'SERVICE WINDOW')
    : (currentItem.table_name || `TABLE ${currentItem.table_id}`);
  const displayTitle = rawTitle.replace(/^Table(\d+)/i, 'TABLE $1');

  const options = {
    restaurantName,
    layoutStyle,
    showPrintMarks,
  };

  const showDoneBanner = (msg) => {
    setExportSuccess(msg);
    setTimeout(() => setExportSuccess(''), 4000);
  };

  const handleSinglePdf = async () => {
    setExportingMode('single-pdf');
    setProgress({ step: `Generating printable PDF for ${displayTitle}…`, percent: 45 });
    try {
      await downloadSingleTableStandPdf(currentItem, options);
      showDoneBanner(`Downloaded ${displayTitle} Stand (PDF)`);
    } finally {
      setExportingMode(null);
    }
  };

  const handleSingleSvg = () => {
    setExportingMode('single-svg');
    try {
      downloadSingleTableStandSvg(currentItem, options);
      showDoneBanner(`Downloaded ${displayTitle} Stand (Vector SVG)`);
    } finally {
      setExportingMode(null);
    }
  };

  const handleSinglePng = async () => {
    setExportingMode('single-png');
    setProgress({ step: `Rendering 300-DPI PNG for ${displayTitle}…`, percent: 50 });
    try {
      await downloadSingleTableStandPng(currentItem, options);
      showDoneBanner(`Downloaded ${displayTitle} Stand (300-DPI PNG)`);
    } finally {
      setExportingMode(null);
    }
  };

  const handleBulkPdf = async () => {
    if (bulkItems.length === 0) return;
    setExportingMode('pdf');
    setProgress({ step: 'Initializing multi-page PDF generator…', percent: 10 });
    try {
      await downloadBulkMultiPagePdf(bulkItems, options, setProgress);
      showDoneBanner(`Exported all ${bulkItems.length} table stands as a multi-page PDF!`);
    } finally {
      setExportingMode(null);
    }
  };

  const isSticker = layoutStyle === 'sticker';
  const isWooden = layoutStyle === 'wooden';
  const accentColor = isCounter
    ? '#00F0FF'
    : isSticker
    ? '#10B981'
    : '#F59E0B';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !exportingMode && onClose()}
        className="fixed inset-0 bg-black/85 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative w-full max-w-5xl rounded-[28px] border border-white/15 bg-[#090b10] shadow-[0_30px_80px_-15px_rgba(0,0,0,0.95),0_0_50px_rgba(245,158,11,0.12)] z-10 overflow-hidden my-auto"
      >
        {/* Top gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-cyan-400 to-emerald-400" />

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 sm:px-8 py-4 border-b border-white/10 bg-[#0d1017]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl border border-amber-400/30 bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <Printer size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                  Table Stand Studio &amp; Print Export
                </h2>
                <span className="inline-flex items-center justify-center font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-400 uppercase whitespace-nowrap leading-none">
                  PRINT &amp; LASER READY
                </span>
              </div>
              <p className="font-mono text-xs text-zinc-400 mt-0.5 truncate">
                Printable PDF &amp; vector SVG cards with Table #, QR Code, and &ldquo;Tap Phone Here or Scan QR&rdquo; target zone.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !exportingMode && onClose()}
            className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close studio"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[82vh] overflow-y-auto">
          {/* ── LEFT COLUMN: LIVE INTERACTIVE STAND PREVIEW (5 cols) ────────── */}
          <div className="lg:col-span-5 p-6 bg-[#06080c] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col items-center justify-between">
            {/* Table Selector Strip */}
            <div className="w-full max-w-[340px] flex items-center justify-between gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSelectedIdx((prev) => (prev - 1 + allItems.length) % allItems.length)}
                className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="Previous table"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="text-center min-w-0 px-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 font-bold block whitespace-nowrap">
                  LIVE STAND PREVIEW ({selectedIdx + 1} OF {allItems.length})
                </span>
                <span className="font-bold text-xs text-white block truncate mt-0.5">
                  {displayTitle} {currentItem.short_code ? `(/t/${currentItem.short_code})` : ''}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedIdx((prev) => (prev + 1) % allItems.length)}
                className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="Next table"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Visual Stand Preview Card */}
            <div
              className={`relative w-full max-w-[340px] rounded-[24px] p-4 sm:p-5 border-2 transition-all duration-300 shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden ${
                isWooden
                  ? 'bg-gradient-to-b from-[#1f160e] to-[#2b1e13]'
                  : isSticker
                  ? 'bg-gradient-to-b from-[#080b11] to-[#101622]'
                  : 'bg-gradient-to-b from-[#0a0d14] to-[#131824]'
              }`}
              style={{ borderColor: accentColor }}
            >
              {/* Top accent bar */}
              <div
                className="absolute top-0 inset-x-0 h-1.5"
                style={{ background: accentColor }}
              />

              {/* Optional Print Crop Marks */}
              {showPrintMarks && (
                <>
                  <div className="absolute top-2.5 left-2.5 w-2.5 h-2.5 border-t border-l border-white/40 pointer-events-none" />
                  <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 border-t border-r border-white/40 pointer-events-none" />
                  <div className="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 border-b border-l border-white/40 pointer-events-none" />
                  <div className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 border-b border-r border-white/40 pointer-events-none" />
                </>
              )}

              {/* Stand Header: Restaurant & Table # */}
              <div className="mt-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center">
                <p
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] truncate"
                  style={{ color: accentColor }}
                >
                  ✦ {restaurantName} ✦
                </p>
                <h3 className="font-black text-2xl sm:text-3xl tracking-tight text-white uppercase mt-0.5 leading-tight">
                  {displayTitle}
                </h3>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-400 mt-0.5">
                  {isCounter ? 'Order & Pickup Window' : 'Digital Dining & Instant Menu'}
                </p>
              </div>

              {/* Callout Banner: SCAN QR */}
              <div
                className="mt-3 h-8 px-3 rounded-full flex items-center justify-center font-mono text-[10px] font-black uppercase tracking-widest text-black shadow-md whitespace-nowrap"
                style={{ backgroundColor: accentColor }}
              >
                SCAN QR
              </div>

              {/* Dual Zone Content: Visual NFC Target + QR Code */}
              <div className={`mt-3 grid ${isSticker ? 'grid-cols-2 gap-2.5' : 'grid-cols-1 gap-2.5'}`}>
                {/* Visual NFC Tap Target Area */}
                <div
                  className="rounded-2xl border p-3 flex flex-col items-center justify-center text-center relative overflow-hidden bg-black/40"
                  style={{ borderColor: `${accentColor}55` }}
                >
                  <div className="flex items-center gap-3 w-full">
                    {/* Concentric Contactless Target Rings */}
                    <div className="relative w-14 h-14 flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                      <div
                        className="absolute inset-0 rounded-full border-2 border-dashed opacity-50"
                        style={{ borderColor: accentColor }}
                      />
                      <div
                        className="absolute inset-1.5 rounded-full border opacity-75"
                        style={{ borderColor: accentColor }}
                      />
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-black shadow-md"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Wifi size={16} className="rotate-90 stroke-[2.5]" />
                      </div>
                    </div>

                    {!isSticker && (
                      <div className="text-left min-w-0 flex-1">
                        <span
                          className="inline-flex items-center font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 whitespace-nowrap leading-none"
                          style={{ color: accentColor }}
                        >
                          OPTION 1 · NFC TAP
                        </span>
                        <p className="font-black text-sm text-white uppercase mt-1 leading-tight whitespace-nowrap">
                          TAP PHONE HERE
                        </p>
                        <p className="font-mono text-[10px] text-zinc-400 leading-snug mt-0.5">
                          Touch phone to target ring to open menu
                        </p>
                      </div>
                    )}
                  </div>

                  {isSticker && (
                    <div className="mt-2">
                      <p className="font-black text-[11px] text-white uppercase whitespace-nowrap">TAP PHONE HERE</p>
                      <p className="font-mono text-[9px] text-zinc-400 mt-0.5">Hold near NFC ring</p>
                    </div>
                  )}

                  {showPrintMarks && (
                    <div
                      className="mt-2 w-full rounded-lg border border-dashed px-2 py-1 text-[9px] font-mono font-bold uppercase whitespace-nowrap truncate"
                      style={{ borderColor: `${accentColor}66`, color: accentColor }}
                    >
                      [ Ø 30mm NFC Sticker Target ]
                    </div>
                  )}
                </div>

                {/* Backup QR Code Zone */}
                <div className="rounded-2xl border border-white/15 bg-black/40 p-3 flex items-center justify-center gap-3">
                  <div
                    className="bg-white p-2 rounded-xl shrink-0 border-2"
                    style={{ borderColor: accentColor }}
                  >
                    <QRCodeSVG
                      value={currentItem.qrUrl}
                      size={isSticker ? 80 : 88}
                      bgColor="#ffffff"
                      fgColor="#0a0a0a"
                      level="H"
                    />
                  </div>

                  {!isSticker && (
                    <div className="text-left min-w-0 flex-1">
                      <span className="inline-flex items-center font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-zinc-200 whitespace-nowrap leading-none">
                        OPTION 2 · QR SCAN
                      </span>
                      <p className="font-black text-sm text-white uppercase mt-1 leading-tight whitespace-nowrap">
                        SCAN QR CODE
                      </p>
                      <p className="font-mono text-[10px] text-zinc-400 leading-snug mt-0.5">
                        Point camera at QR · No app needed
                      </p>
                      {currentItem.short_code && (
                        <p
                          className="font-mono text-[9px] font-bold mt-1 whitespace-nowrap"
                          style={{ color: accentColor }}
                        >
                          TOKEN: {currentItem.short_code}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Stand Footer */}
              <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between font-mono text-[9px] text-zinc-400 uppercase">
                <span>No App Needed</span>
                <span>Smart Menu AI</span>
              </div>
            </div>


          </div>

          {/* ── RIGHT COLUMN: STAND CONFIGURATION & DOWNLOADS (7 cols) ──────── */}
          <div className="lg:col-span-7 p-6 sm:p-7 space-y-5 flex flex-col justify-between text-left">
            <div className="space-y-5">
              {/* Step 1: Select Physical Stand / Sticker Format */}
              <div>
                <label className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 mb-2.5">
                  <Layers size={14} className="shrink-0" />
                  <span>1. PHYSICAL STAND / STICKER FORMAT</span>
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {STAND_STYLES.map((st) => {
                    const active = layoutStyle === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setLayoutStyle(st.id)}
                        className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                            : 'border-white/10 bg-[#0d1017] hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="inline-flex items-center font-mono text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 whitespace-nowrap leading-none font-bold">
                            {st.badge}
                          </span>
                          {active && (
                            <div className="flex items-center gap-1.5 text-amber-400 font-mono text-xs font-bold">
                              <Check size={14} className="stroke-[3]" />
                              <span>SELECTED</span>
                            </div>
                          )}
                        </div>
                        <p className="font-bold text-sm sm:text-base text-white">{st.label}</p>
                        <p className="font-mono text-[11px] text-zinc-400 mt-0.5 leading-snug">
                          {st.sub}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Commercial Print & Hardware Options */}
              <div>
                <label className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 mb-2.5">
                  <Sparkles size={14} className="shrink-0" />
                  <span>2. PRINT &amp; HARDWARE PLACEMENT OPTIONS</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowPrintMarks((v) => !v)}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      showPrintMarks
                        ? 'border-amber-400/50 bg-amber-500/10'
                        : 'border-white/10 bg-[#0d1017]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        showPrintMarks ? 'bg-amber-400 text-black' : 'border border-white/25'
                      }`}
                    >
                      {showPrintMarks && <Check size={13} className="stroke-[3]" />}
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-white">
                        Crop Marks &amp; NFC Sticker Guide
                      </p>
                      <p className="font-mono text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                        Adds bleed trim lines &amp; Ø 30mm NFC sticker target
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncludeCounter((v) => !v)}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      includeCounter
                        ? 'border-cyan-400/50 bg-cyan-500/10'
                        : 'border-white/10 bg-[#0d1017]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        includeCounter ? 'bg-cyan-400 text-black' : 'border border-white/25'
                      }`}
                    >
                      {includeCounter && <Check size={13} className="stroke-[3]" />}
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-white">
                        Include Service Window Card
                      </p>
                      <p className="font-mono text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                        Includes Central Pickup Window QR &amp; NFC stand
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 3: Export Actions (Current Previewed Stand + Multi-Page Bulk PDF) */}
              <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-[#0d1017] to-cyan-500/5 p-5 space-y-4">
                <div>
                  <h3 className="font-black text-base text-white uppercase tracking-tight flex items-center gap-2">
                    <Download size={17} className="text-amber-400 shrink-0" />
                    <span>DOWNLOAD STAND CARDS (PRINT-READY)</span>
                  </h3>
                  <p className="font-mono text-xs text-zinc-300 mt-0.5">
                    Download the currently previewed <strong className="text-amber-300">{displayTitle}</strong> card or export all {bulkItems.length} cards in a single multi-page PDF.
                  </p>
                </div>

                {/* Progress Indicator */}
                <AnimatePresence>
                  {exportingMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-2xl border border-amber-400/40 bg-black/60 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between font-mono text-xs text-amber-300 font-bold">
                        <span>{progress.step || 'Generating print file…'}</span>
                        <span>{progress.percent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-200"
                          style={{ width: `${Math.max(8, progress.percent)}%` }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success Toast */}
                <AnimatePresence>
                  {exportSuccess && !exportingMode && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 flex items-center gap-2.5 text-emerald-300 font-mono text-xs font-bold"
                    >
                      <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                      <span>{exportSuccess}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary Action Buttons — Balanced padding and responsive sizing to prevent text overflow */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSinglePdf}
                    disabled={!!exportingMode}
                    className="min-h-[48px] py-2 px-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black text-[11px] sm:text-xs font-black uppercase tracking-tight inline-flex items-center justify-center gap-1.5 text-center leading-tight shadow-[0_0_25px_rgba(245,158,11,0.3)] hover:shadow-[0_0_35px_rgba(245,158,11,0.5)] transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <Download size={14} className="shrink-0" />
                    <span>DOWNLOAD {displayTitle} (PDF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkPdf}
                    disabled={!!exportingMode}
                    className="min-h-[48px] py-2 px-3 rounded-2xl border border-cyan-400/50 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white text-[11px] sm:text-xs font-black uppercase tracking-tight inline-flex items-center justify-center gap-1.5 text-center leading-tight shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <FileText size={14} className="shrink-0" />
                    <span>DOWNLOAD ALL QR</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Hardware Placement Tip Footer */}
            <div className="rounded-2xl border border-white/10 bg-[#0d1017] p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Wifi size={14} />
              </div>
              <div className="font-mono text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-white font-bold">PRO HARDWARE TIP: </span>
                Stick a programmed <strong className="text-amber-300">NTAG213 / NTAG215</strong> sticker directly behind the <strong className="text-white">&ldquo;TAP PHONE HERE&rdquo;</strong> target circle inside your acrylic stand, under a wooden block, or beneath your table sticker.
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
