// TablesPage.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Upload, Loader2, MapPin, ScanLine, Sparkles, CheckCircle2, RefreshCw,
  AlertTriangle, Download, PartyPopper, Zap, Table2, TrendingUp, Receipt,
  Plus, ImagePlus, QrCode, RotateCcw, Wifi, Star, ShoppingBag, ShieldCheck,
  Copy, Check, Store, CreditCard, ChevronUp, ChevronDown, X, ExternalLink,
  Edit2, Save, Smartphone, Package, FileText, Printer, FileCode, ArrowLeft,
} from 'lucide-react';
import { api } from '../src/api';
import TableStandStudioModal from './components/TableStandStudioModal';
import { downloadSingleTableStandPdf, downloadBulkMultiPagePdf } from './utils/standExport';

// ─── Print styles ─────────────────────────────────────────────────────────────
const PRINT_STYLES = `
  @page {
    size: A4 portrait;
    margin: 0;
  }

  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    body {
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .print-hide {
      display: none !important;
    }

    .print-page {
      display: flex !important;
      width: 210mm !important;
      height: 297mm !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
    }

    .print-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }

    .screen-only {
      display: none !important;
    }
  }

  @media screen {
    .print-page {
      display: none;
    }
  }
`;

const UPLOAD_STEPS = [
  { key: 'geo',    label: 'Reading location',     icon: MapPin    },
  { key: 'scan',   label: 'Scanning menu image',  icon: ScanLine  },
  { key: 'ai',     label: 'AI parsing dishes',    icon: Sparkles  },
  { key: 'images', label: 'Sourcing dish photos', icon: ImagePlus },
  { key: 'done',   label: 'Generating table QRs', icon: QrCode    },
];

// ─── Print pages (rendered off-screen, only visible during print) ─────────────
function PrintPages({ qrData, restaurantName }) {
  const name = restaurantName || qrData?.restaurant_name || 'Restaurant';
  if (!qrData?.tables?.length && !qrData?.counter_table) return null;

  const allPrintables = [];
  if (qrData?.counter_table) {
    allPrintables.push({ ...qrData.counter_table, isCounter: true });
  }
  if (qrData?.tables) {
    qrData.tables.forEach(t => allPrintables.push(t));
  }

  return (
    <>
      {allPrintables.map((tbl) => {
        const url = `${window.location.origin}/t/${tbl.short_code || tbl.token}?src=qr`;
        const isCounter = tbl.table_id === 'COUNTER' || tbl.isCounter;
        return (
          <div key={tbl.table_id} className="print-page">
            {/*
              Full A4 page split into two halves:
              LEFT  — bold identity / branding stripe
              RIGHT — QR code + instructions
            */}
            <div style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              fontFamily: "'Courier New', monospace",
            }}>

              {/* ── LEFT branding column ─────────────────────────────── */}
              <div style={{
                width: '42%',
                background: isCounter
                  ? 'linear-gradient(160deg, #00F0FF 0%, #00a0cf 40%, #0a0a0a 100%)'
                  : 'linear-gradient(160deg, #D6FF00 0%, #b8d900 40%, #0a0a0a 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '14mm 10mm',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: '-20mm', right: '-15mm',
                  width: '60mm', height: '60mm', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                }} />
                <div style={{
                  position: 'absolute', bottom: '30mm', left: '-10mm',
                  width: '40mm', height: '40mm', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                }} />

                {/* Top: restaurant name */}
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{
                    fontSize: '7pt',
                    fontWeight: '900',
                    letterSpacing: '0.35em',
                    textTransform: 'uppercase',
                    color: 'rgba(0,0,0,0.5)',
                    marginBottom: '6mm',
                  }}>
                    ✦ {isCounter ? 'SERVICE WINDOW & PICKUP' : 'SMART MENU'}
                  </div>
                  <div style={{
                    fontSize: '22pt',
                    fontWeight: '900',
                    lineHeight: 1.05,
                    color: '#0a0a0a',
                    letterSpacing: '-0.02em',
                    textTransform: 'uppercase',
                    wordBreak: 'break-word',
                  }}>
                    {name}
                  </div>
                </div>

                {/* Middle: big label */}
                <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
                  <div style={{
                    fontSize: '7pt',
                    fontWeight: '700',
                    letterSpacing: '0.4em',
                    textTransform: 'uppercase',
                    color: 'rgba(0,0,0,0.45)',
                    marginBottom: '3mm',
                  }}>
                    {isCounter ? 'ORDER LOCATION' : 'TABLE'}
                  </div>
                  <div style={{
                    fontSize: isCounter ? '28pt' : '72pt',
                    fontWeight: '900',
                    lineHeight: 1,
                    color: '#0a0a0a',
                    letterSpacing: '-0.04em',
                    textTransform: 'uppercase',
                  }}>
                    {tbl.table_name || (isCounter ? 'SERVICE WINDOW' : tbl.table_id)}
                  </div>
                  <div style={{
                    marginTop: '4mm',
                    display: 'inline-block',
                    background: 'rgba(0,0,0,0.12)',
                    borderRadius: '20mm',
                    padding: '2mm 5mm',
                    fontSize: '6pt',
                    fontWeight: '700',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    color: '#0a0a0a',
                  }}>
                    {isCounter ? 'Scan · Pay Online · Collect at Window' : 'Scan · Order · Enjoy'}
                  </div>
                </div>

                {/* Bottom: footer */}
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{
                    width: '100%',
                    height: '0.3mm',
                    background: 'rgba(0,0,0,0.2)',
                    marginBottom: '4mm',
                  }} />
                  <div style={{
                    fontSize: '5.5pt',
                    color: 'rgba(0,0,0,0.45)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    lineHeight: 1.6,
                  }}>
                    {isCounter ? 'MODEL A: COUNTER PICKUP · PRE-PAID ORDERS ONLY' : 'Powered by Smart Menu AI'}<br />
                    © {new Date().getFullYear()} {name}
                  </div>
                </div>
              </div>

              {/* ── RIGHT QR column ──────────────────────────────────── */}
              <div style={{
                width: '58%',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '14mm 12mm',
                gap: '8mm',
              }}>

                <div style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3mm',
                  marginBottom: '2mm',
                }}>
                  <div style={{
                    flex: 1, height: '0.4mm',
                    background: isCounter ? 'linear-gradient(90deg, #00F0FF, transparent)' : 'linear-gradient(90deg, #D6FF00, transparent)',
                  }} />
                  <span style={{
                    fontSize: '5.5pt',
                    fontWeight: '700',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: '#aaaaaa',
                  }}>
                    TAP PHONE HERE OR SCAN QR
                  </span>
                  <div style={{
                    flex: 1, height: '0.4mm',
                    background: isCounter ? 'linear-gradient(90deg, transparent, #00F0FF)' : 'linear-gradient(90deg, transparent, #D6FF00)',
                  }} />
                </div>

                {/* Visual NFC Tap Target Area on Printed Stand/Poster */}
                <div style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4mm',
                  padding: '3.5mm 5mm',
                  borderRadius: '5mm',
                  border: '0.5mm dashed #0a0a0a',
                  background: isCounter ? 'rgba(0,240,255,0.12)' : 'rgba(214,255,0,0.18)',
                }}>
                  <div style={{
                    width: '13mm',
                    height: '13mm',
                    borderRadius: '50%',
                    background: '#0a0a0a',
                    color: isCounter ? '#00F0FF' : '#D6FF00',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '7pt',
                    fontWeight: '900',
                    flexShrink: 0,
                    boxShadow: '0 0 0 1.2mm rgba(10,10,10,0.18)',
                  }}>
                    NFC
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{
                      fontSize: '8pt',
                      fontWeight: '900',
                      color: '#0a0a0a',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}>
                      TAP PHONE HERE (NFC)
                    </div>
                    <div style={{
                      fontSize: '5.5pt',
                      color: '#444444',
                      fontWeight: '700',
                      letterSpacing: '0.04em',
                    }}>
                      Hold top of phone here or scan backup QR below
                    </div>
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1.5mm solid #0a0a0a',
                  borderRadius: '8mm',
                  padding: '6mm',
                  boxShadow: isCounter ? '0 0 0 1mm #00F0FF, 4mm 4mm 0 0 #0a0a0a' : '0 0 0 1mm #D6FF00, 4mm 4mm 0 0 #0a0a0a',
                  display: 'inline-block',
                }}>
                  <QRCodeSVG
                    value={url}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    level="H"
                  />
                </div>

                <div style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3mm',
                  marginTop: '2mm',
                }}>
                  {[
                    ['01', 'Open your phone camera app'],
                    ['02', 'Scan the QR code above'],
                    ['03', 'Select your dishes & pay online'],
                    ['04', isCounter ? 'Receive your Order # & pickup at window' : 'Browse menu & place your order'],
                  ].map(([num, text]) => (
                    <div key={num} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3mm',
                    }}>
                      <div style={{
                        width: '6mm', height: '6mm',
                        background: isCounter ? '#00F0FF' : '#D6FF00',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '5pt',
                        fontWeight: '900',
                        color: '#0a0a0a',
                        flexShrink: 0,
                      }}>
                        {num}
                      </div>
                      <div style={{
                        fontSize: '7pt',
                        color: '#333333',
                        fontWeight: '500',
                        letterSpacing: '0.05em',
                      }}>
                        {text}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  width: '100%',
                  background: '#f5f5f5',
                  borderRadius: '3mm',
                  padding: '3mm 4mm',
                  marginTop: '2mm',
                }}>
                  <div style={{
                    fontSize: '5pt',
                    color: '#888888',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: '1mm',
                  }}>
                    Direct Link:
                  </div>
                  <div style={{
                    fontSize: '5.5pt',
                    color: '#333333',
                    fontWeight: '700',
                    wordBreak: 'break-all',
                    letterSpacing: '0.02em',
                  }}>
                    {url}
                  </div>
                </div>

                <div style={{
                  width: '100%',
                  height: '1.5mm',
                  background: isCounter ? 'linear-gradient(90deg, #00F0FF 0%, #FF00FF 100%)' : 'linear-gradient(90deg, #D6FF00 0%, #00F0FF 50%, #FF00FF 100%)',
                  borderRadius: '2mm',
                  marginTop: '2mm',
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Upload progress ──────────────────────────────────────────────────────────
function UploadProgress({ stepIndex, t }) {
  return (
    <div className="max-w-sm mx-auto space-y-3">
      {UPLOAD_STEPS.map((step, idx) => {
        const Icon     = step.icon;
        const isDone   = idx < stepIndex;
        const isActive = idx === stepIndex;
        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`flex items-center gap-3 border rounded-xl px-4 py-3 backdrop-blur-md transition-all ${
              isActive
                ? 'bg-[#08090e]/90 border-amber-400/50 shadow-[0_4px_20px_rgba(245,158,11,0.2)]'
                : 'bg-[#08090e]/50 border-white/[0.08]'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
              isDone
                ? 'border-amber-400/40 text-amber-400 bg-amber-500/10'
                : isActive
                  ? 'border-cyan-400/50 text-cyan-400 bg-cyan-500/10'
                  : 'border-white/10 text-zinc-500'
            }`}>
              {isDone
                ? <CheckCircle2 size={14} />
                : isActive
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Icon size={14} />}
            </div>
            <span className={`font-mono text-xs font-bold ${isDone ? 'text-zinc-300' : isActive ? 'text-white' : 'text-zinc-500'}`}>
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
    <div className="border border-white/[0.12] rounded-2xl p-4 flex flex-col items-center animate-pulse bg-[#08090e]/70 backdrop-blur-[20px] shadow-[0_8px_25px_-5px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.08)]">
      <div className="w-[110px] h-[110px] rounded-xl mb-3 bg-white/5" />
      <div className="w-16 h-3 rounded bg-white/5" />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, t }) {
  return (
    <div className="relative rounded-[22px] p-5 flex flex-col justify-between cursor-default bg-[#08090e]/75 backdrop-blur-[24px] border border-white/[0.12] hover:border-amber-400/60 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.12)] hover:shadow-[0_0_0_1px_rgba(245,158,11,0.4),0_0_24px_rgba(245,158,11,0.3),0_16px_40px_-10px_rgba(0,0,0,0.85)] transition-all duration-300 overflow-hidden">
      {/* Top rim specular highlight */}
      <div className="absolute top-0 left-6 right-6 h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-400 mb-2 font-bold">{label}</p>
          <p className="text-2xl sm:text-3xl font-black text-white">{value}</p>
          {sub && <p className="font-mono text-[10px] mt-1 text-zinc-500">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 border border-amber-400/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.12)]">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

// ─── Device Detection Helper ─────────────────────────────────────────────────
function detectDeviceCapabilities() {
  if (typeof window === 'undefined') {
    return { isAppleOrIOS: false, isIOS: false, isAndroid: false, supportsWebNfc: false, canWriteHardware: false };
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/.test(ua) && !isIOS;
  const isAppleOrIOS = isIOS || isMac;
  const isAndroid = /Android/i.test(ua);
  const supportsWebNfc = 'NDEFReader' in window;

  return {
    isAppleOrIOS,
    isIOS,
    isMac,
    isAndroid,
    isDesktop: !isIOS && !isAndroid,
    supportsWebNfc,
    // Web NFC hardware writing is only functional when browser supports Web NFC and is not blocked by iOS/Safari
    canWriteHardware: supportsWebNfc && !isAppleOrIOS,
  };
}

// ─── NFC Tag Programmer Modal ────────────────────────────────────────────────
function NfcModal({ isOpen, onClose, target, onNfcStatusChange }) {
  const [writeState, setWriteState] = useState('idle'); // 'idle' | 'writing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const device = React.useMemo(() => detectDeviceCapabilities(), []);

  const { url, tableId, tableName, shortCode } = target || {};
  const isCounter = tableId === 'COUNTER';
  const label = tableName || (isCounter ? 'Central Service Window' : `Table ${tableId}`);

  const startHardwareWrite = useCallback(async () => {
    if (!('NDEFReader' in window)) {
      setWriteState('error');
      setErrorMessage('Web NFC is not supported in this browser.');
      return;
    }

    try {
      setWriteState('writing');
      setErrorMessage('');
      if (onNfcStatusChange) {
        onNfcStatusChange({ kind: 'writing', message: `Programming ${label}… hold phone near tag.` });
      }

      const ndef = new window.NDEFReader();
      await ndef.write({
        records: [
          {
            recordType: 'url',
            data: url,
          },
        ],
      });

      setWriteState('success');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      if (onNfcStatusChange) {
        onNfcStatusChange({ kind: 'success', message: `${label} encoded to NFC tag successfully!` });
      }
    } catch (err) {
      setWriteState('error');
      setErrorMessage(err?.message || 'NFC write was cancelled or timed out. Tap retry and touch your tag again.');
      if (onNfcStatusChange) {
        onNfcStatusChange({ kind: 'error', message: err?.message || 'NFC write failed.' });
      }
    }
  }, [url, label, onNfcStatusChange]);

  useEffect(() => {
    if (isOpen && target) {
      setWriteState('idle');
      setErrorMessage('');
      setCopied(false);

      if (device.canWriteHardware) {
        startHardwareWrite();
      }
    }
  }, [isOpen, target, device.canWriteHardware, startHardwareWrite]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !target) return null;

  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const handleSimulateTap = () => {
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-[#0a0c12] p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_40px_rgba(245,158,11,0.12)] z-10 space-y-5 text-left"
      >
        {/* Specular highlight rim */}
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl border border-zinc-700/80 bg-[#12141a] flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <Wifi size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white uppercase">
                  PROGRAM NFC TAG
                </h3>
                <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-400 uppercase">
                  {label}
                </span>
              </div>
              <p className="font-mono text-xs text-zinc-400 mt-0.5">
                Dynamic proxy link with source tracking (?src=nfc)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Token Card */}
        <div className="rounded-2xl border border-white/10 bg-[#06080d] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} /> DYNAMIC TABLE TOKEN
            </span>
            <span className="font-mono text-[9px] text-zinc-400 uppercase bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
              Code: {shortCode || tableId}
            </span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-white/10 bg-black/60">
            <div className="flex-1 font-mono text-[11px] text-zinc-300 truncate select-all px-1">
              {url}
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white font-mono text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              {copied ? <><Check size={12} className="text-amber-400" /> COPIED</> : <><Copy size={12} /> COPY</>}
            </button>
          </div>
        </div>

        {/* ── CASE 1: SUPPORTED BROWSER (Android / Chrome Web NFC) ───────────── */}
        {device.canWriteHardware && (
          <div className="space-y-4 pt-1">
            {writeState === 'writing' && (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 text-center space-y-3">
                <div className="relative mx-auto w-16 h-16 rounded-full border-2 border-amber-400/30 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-amber-400 animate-ping opacity-40" />
                  <Wifi size={24} className="text-amber-400" />
                </div>
                <div>
                  <h4 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                    TOUCH STICKER TO PROGRAM
                  </h4>
                  <p className="font-mono text-xs text-zinc-300 mt-1 max-w-xs mx-auto">
                    Hold the back of your phone near the NFC sticker or tag to program it instantly.
                  </p>
                </div>
              </div>
            )}

            {/* Write Verification feedback */}
            {writeState === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-center space-y-3"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 className="font-mono text-sm font-bold text-emerald-300 uppercase tracking-wider">
                    NDEF PAYLOAD WRITTEN SUCCESSFULLY!
                  </h4>
                  <p className="font-mono text-xs text-zinc-300 mt-1">
                    Verified: Physical tag successfully programmed for <strong>{label}</strong>.
                  </p>
                </div>
                <div className="pt-2 flex gap-2 justify-center">
                  <button
                    onClick={startHardwareWrite}
                    className="font-mono text-xs px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all cursor-pointer"
                  >
                    Touch Another Sticker
                  </button>
                  <button
                    onClick={onClose}
                    className="font-mono text-xs font-bold px-5 py-2 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-all cursor-pointer shadow-lg"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}

            {writeState === 'error' && (
              <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-3 text-left">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={18} className="shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <p className="font-mono text-xs font-bold text-rose-300 uppercase">Write Notice</p>
                    <p className="font-mono text-[11px] text-rose-200/80 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
                <button
                  onClick={startHardwareWrite}
                  className="w-full h-10 rounded-full border border-rose-400/30 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 font-mono text-xs font-bold tracking-wider transition-all cursor-pointer"
                >
                  RETRY TOUCH PROGRAMMING
                </button>
              </div>
            )}

            {/* Test Simulation link */}
            <button
              onClick={handleSimulateTap}
              className="w-full h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ExternalLink size={13} />
              SIMULATE NFC TAP (TEST ORDER FLOW)
            </button>
          </div>
        )}

        {/* ── CASE 2: APPLE / IOS / DESKTOP (WRITE BUTTON HIDDEN + FALLBACK UI) ─ */}
        {!device.canWriteHardware && (
          <div className="space-y-4 pt-1">
            {/* Apple / iOS Device Notice */}
            <div className="p-3.5 rounded-2xl border border-amber-400/25 bg-amber-500/10 flex items-start gap-3">
              <span className="text-lg"></span>
              <div className="text-left font-mono text-[11px]">
                <p className="font-bold text-amber-300">Apple / iOS Device Detected</p>
                <p className="text-zinc-300 mt-0.5 leading-relaxed">
                  Apple blocks direct browser NFC writing in iOS Safari. Use the free <strong>NFC Tools</strong> app below to program your sticker in seconds.
                </p>
              </div>
            </div>

            {/* Prominent COPY URL button */}
            <button
              onClick={handleCopy}
              className={`w-full h-12 rounded-full font-mono text-xs font-bold tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg active:scale-95 ${
                copied
                  ? 'border border-emerald-400 bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                  : 'border border-amber-400/60 bg-amber-400 text-black hover:bg-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
              }`}
            >
              {copied ? (
                <>
                  <Check size={16} className="stroke-[3]" />
                  <span>COPIED TO CLIPBOARD!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>COPY DYNAMIC TABLE URL</span>
                </>
              )}
            </button>

            {/* 3-Step Guide on Using Free NFC Tools App */}
            <div className="rounded-2xl border border-white/10 bg-[#06080d] p-4 text-left font-mono space-y-2.5">
              <p className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>📱</span> 3-STEP GUIDE (FREE NFC TOOLS APP):
              </p>
              <div className="space-y-2 text-[11px] text-zinc-300 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">1</span>
                  <p>Tap <strong>"COPY DYNAMIC TABLE URL"</strong> above to copy this table's link.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">2</span>
                  <p>Open the free <strong>NFC Tools</strong> app on your iPhone (free on the App Store).</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">3</span>
                  <p>Choose <strong>Write → Add a record → URL / URI</strong>, paste the copied link, and touch your NFC tag to program it!</p>
                </div>
              </div>
            </div>

            {/* Simulate NFC Tap (Test Order Flow) */}
            <button
              onClick={handleSimulateTap}
              className="w-full h-11 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ExternalLink size={14} />
              SIMULATE NFC TAP (TEST LIVE FLOW)
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Screen QR card ───────────────────────────────────────────────────────────
function QRGrid({
  qrData,
  t,
  mode,
  nfcSupported,
  nfcStatus,
  writingTable,
  onWriteNfc,
  restaurantName,
  onOpenStandStudio,
}) {
  const name = restaurantName || qrData.restaurant_name;
  const [copied, setCopied] = useState(false);
  const [copiedTableId, setCopiedTableId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const handleCopyQrLink = (url, tableId) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedTableId(tableId);
    setTimeout(() => setCopiedTableId(null), 2000);
  };

  const handleDirectPrint = async (item) => {
    if (!item) return;
    setDownloadingId(item.table_id);
    const rawName = item.table_name || `Table ${item.table_id}`;
    const formattedName = rawName.replace(/^Table(\d+)/i, 'Table $1');
    try {
      await downloadSingleTableStandPdf({ ...item, table_name: formattedName }, {
        restaurantName: name || 'SMART MENU',
        layoutStyle: 'sticker',
        showPrintMarks: false,
      });
    } catch (err) {
      console.error('Direct print failed:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const counterTable = qrData.counter_table;
  const counterQrUrl = counterTable
    ? `${window.location.origin}/t/${counterTable.short_code || counterTable.token}?src=qr`
    : null;
  const counterNfcUrl = counterTable
    ? `${window.location.origin}/t/${counterTable.short_code || counterTable.token}?src=nfc`
    : null;

  const handleCopyCounterUrl = () => {
    const copyTarget = counterNfcUrl || counterQrUrl;
    if (!copyTarget) return;
    navigator.clipboard.writeText(copyTarget);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      key="results"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="screen-only"
    >
      {/* ─── DEDICATED SERVICE WINDOW QR CARD ─────────────────────────────── */}
      {counterTable && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 rounded-[28px] border border-cyan-500/35 hover:border-cyan-400/70 bg-[#08090e]/78 backdrop-blur-[24px] overflow-hidden shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9),0_0_20px_rgba(6,182,212,0.12),inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4),0_0_30px_rgba(6,182,212,0.35),0_20px_50px_-10px_rgba(0,0,0,0.9)] transition-all duration-300"
        >
          {/* Top glowing cyan/amber gradient stripe */}
          <div className="h-2 w-full bg-gradient-to-r from-cyan-400 via-amber-400 to-orange-500" />
          <div className="absolute top-2 left-8 right-8 h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />

          <div className="p-6 md:p-8">
            <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-between">
              
              {/* Left Column: Details & Instructions */}
              <div className="flex-1 space-y-4 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-cyan-400 text-black font-mono font-black text-[10px] tracking-widest px-3 py-1 rounded-full uppercase inline-flex items-center gap-1.5 whitespace-nowrap leading-none shadow-[0_0_12px_rgba(6,182,212,0.35)]">
                    <Store size={12} className="shrink-0" /> MODEL A: SERVICE WINDOW / COUNTER
                  </span>
                  <span className="bg-amber-500/15 border border-amber-400/30 text-amber-400 font-mono font-bold text-[9.5px] tracking-wider px-3 py-1 rounded-full uppercase inline-flex items-center gap-1 whitespace-nowrap leading-none shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                    <ShieldCheck size={11} className="shrink-0" /> MANDATORY PRE-PAYMENT
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black tracking-tight text-white">
                    Central Service Window &amp; Takeaway QR
                  </h3>
                  <p className="font-mono text-xs leading-relaxed mt-2 text-zinc-400 max-w-2xl">
                    Place this stand at your entrance, order window, or takeaway counter. Customers tap their phone on the NFC target or scan the QR code to browse the menu and pay online.
                  </p>
                </div>

                {/* Workflow steps badge box */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border border-white/[0.1] bg-[#06080d]/80 backdrop-blur-md shadow-inner">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-cyan-400/30 shadow-[0_0_8px_rgba(6,182,212,0.25)]">1</div>
                    <div>
                      <p className="font-mono text-[10px] font-bold text-white">TAP OR SCAN</p>
                      <p className="font-mono text-[9px] text-zinc-500">NFC target or QR backup</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-amber-400/30 shadow-[0_0_8px_rgba(245,158,11,0.25)]">2</div>
                    <div>
                      <p className="font-mono text-[10px] font-bold text-white">PAY ONLINE</p>
                      <p className="font-mono text-[9px] text-zinc-500">Pre-payment required</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-orange-400/30 shadow-[0_0_8px_rgba(249,115,22,0.25)]">3</div>
                    <div>
                      <p className="font-mono text-[10px] font-bold text-white">CALLOUT PICKUP</p>
                      <p className="font-mono text-[9px] text-zinc-500">Order # callout</p>
                    </div>
                  </div>
                </div>

                {/* Buttons row - Action links */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={downloadingId === 'COUNTER'}
                    onClick={() =>
                      handleDirectPrint({
                        ...counterTable,
                        table_id: 'COUNTER',
                        table_name: counterTable?.table_name || 'Central Service Window',
                        short_code: counterTable?.short_code,
                        token: counterTable?.token,
                        qrUrl: counterQrUrl,
                        nfcUrl: counterNfcUrl,
                        isCounter: true,
                      })
                    }
                    className="group/print relative h-10 px-5 rounded-full border border-cyan-400/40 hover:border-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_0_15px_rgba(0,240,255,0.12)] hover:shadow-[0_0_22px_rgba(0,240,255,0.35)] active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
                    title="Download printable PDF for Central Service Window"
                  >
                    {downloadingId === 'COUNTER' ? (
                      <>
                        <RefreshCw size={13} className="animate-spin text-cyan-400 shrink-0" />
                        <span>PRINTING…</span>
                      </>
                    ) : (
                      <>
                        <Printer size={14} className="shrink-0 transition-transform duration-200 group-hover/print:-translate-y-0.5" />
                        <span>PRINT</span>
                        <Download size={12} className="opacity-60 group-hover/print:opacity-100 group-hover/print:translate-y-0.5 transition-all" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: QR Code Display Frame & Single NFC Button */}
              <div className="flex flex-col items-center shrink-0 w-full sm:w-auto">
                <div
                  onClick={() => handleCopyQrLink(counterQrUrl, 'COUNTER')}
                  className="group/qr relative bg-white p-4 rounded-3xl shadow-[0_0_0_2px_#00F0FF,0_10px_35px_rgba(0,240,255,0.35)] hover:shadow-[0_0_40px_rgba(0,240,255,0.5),0_0_0_3px_#00F0FF] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 cursor-pointer"
                  title="Click to copy menu link"
                >
                  <QRCodeSVG
                    id="stand-qr-svg-COUNTER"
                    value={counterQrUrl}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    level="H"
                  />
                  <div className="absolute inset-0 rounded-3xl bg-black/60 opacity-0 group-hover/qr:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                    {copiedTableId === 'COUNTER' ? (
                      <div className="flex flex-col items-center gap-1 text-emerald-400 animate-in fade-in zoom-in duration-150">
                        <Check size={24} className="stroke-[3]" />
                        <span className="font-mono text-[10px] font-black tracking-wider uppercase">COPIED!</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-cyan-300">
                        <Copy size={20} />
                        <span className="font-mono text-[10px] font-bold tracking-wider uppercase">COPY LINK</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Visual Target: SCAN QR */}
                <div className="mt-3.5 mb-3.5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/40 bg-[#0c0e14]/90 hover:bg-cyan-500/10 shadow-[0_0_15px_rgba(0,240,255,0.15)] group/scan transition-all duration-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                  </span>
                  <ScanLine size={13} className="text-cyan-400 group-hover/scan:scale-110 transition-transform duration-200" />
                  <span className="font-mono text-[11px] font-black tracking-widest text-cyan-300 uppercase">
                    SCAN QR
                  </span>
                </div>

                {/* Single WRITE NFC TAG button placed directly near the QR code */}
                <button
                  type="button"
                  onClick={() => onWriteNfc(counterNfcUrl, 'COUNTER', counterTable.table_name || 'Central Service Window', counterTable.short_code)}
                  className="w-full max-w-[220px] h-11 rounded-full border border-zinc-700/60 bg-[#12141a] hover:bg-[#181b24] hover:border-zinc-500/80 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 px-6 shadow-[0_2px_12px_rgba(0,0,0,0.5)] cursor-pointer group"
                >
                  <Wifi size={14} className="text-zinc-300 group-hover:text-white transition-colors" />
                  <span className="font-mono text-xs font-semibold tracking-wider text-zinc-200 group-hover:text-white transition-colors uppercase">
                    WRITE NFC TAG
                  </span>
                </button>
              </div>

            </div>
          </div>
        </motion.div>
      )}

      {/* Title section for Table QRs */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-black text-lg text-white">
          Dine-In Table Stands &amp; QR Codes ({qrData.tables.length})
        </h3>
        <span className="font-mono text-xs text-zinc-400">
          Click &ldquo;PRINT&rdquo; to download table card PDF
        </span>
      </div>

      {/* Screen preview grid */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {qrData.tables.map((tbl, idx) => {
          const qrUrl = `${window.location.origin}/t/${tbl.short_code || tbl.token}?src=qr`;
          const nfcUrl = `${window.location.origin}/t/${tbl.short_code || tbl.token}?src=nfc`;
          const rawLabel = tbl.table_name || `Table ${tbl.table_id}`;
          const displayLabel = rawLabel.replace(/^Table(\d+)/i, 'Table $1');

          return (
            <motion.div
              key={tbl.table_id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.06 + idx * 0.04, type: 'spring', damping: 14 }}
              className="relative rounded-[24px] border border-white/[0.12] hover:border-amber-400/60 bg-[#08090e]/75 backdrop-blur-[24px] overflow-hidden shadow-[0_16px_40px_-10px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.12)] hover:shadow-[0_0_0_1px_rgba(245,158,11,0.4),0_0_24px_rgba(245,158,11,0.3),0_16px_40px_-10px_rgba(0,0,0,0.85)] transition-all duration-300 flex flex-col justify-between"
            >
              {/* Internal warm rim light highlight along top border */}
              <div className="absolute top-0 left-6 right-6 h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              {/* Mini branding bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300" />

              <div className="p-6 flex-1 flex flex-col justify-between">
                {/* Restaurant + table header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    {name && (
                      <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-amber-400 mb-1 truncate">
                        {name}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-black text-2xl tracking-tight text-white">
                        {displayLabel}
                      </span>
                    </div>
                    {tbl.short_code && (
                      <p className="font-mono text-[9px] text-zinc-500 mt-0.5">
                        Code: {tbl.short_code}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={downloadingId === tbl.table_id}
                      onClick={() =>
                        handleDirectPrint({
                          ...tbl,
                          table_id: tbl.table_id,
                          table_name: displayLabel,
                          short_code: tbl.short_code,
                          token: tbl.token,
                          qrUrl,
                          nfcUrl,
                          isCounter: false,
                        })
                      }
                      className="group/print relative h-9 px-4 rounded-full border border-amber-400/40 hover:border-amber-300 bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 hover:text-white font-mono text-[11px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_0_15px_rgba(245,158,11,0.12)] hover:shadow-[0_0_22px_rgba(245,158,11,0.35)] active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
                      title={`Download printable PDF for ${displayLabel}`}
                    >
                      {downloadingId === tbl.table_id ? (
                        <>
                          <RefreshCw size={12} className="animate-spin text-amber-400 shrink-0" />
                          <span>PRINTING…</span>
                        </>
                      ) : (
                        <>
                          <Printer size={13} className="shrink-0 transition-transform duration-200 group-hover/print:-translate-y-0.5" />
                          <span>PRINT</span>
                          <Download size={11} className="opacity-60 group-hover/print:opacity-100 group-hover/print:translate-y-0.5 transition-all" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Interactive Visual Target: SCAN QR */}
                <div className="flex items-center justify-center mb-3.5">
                  <div className="group/scan relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-400/40 bg-[#0c0e14]/90 hover:bg-amber-500/10 hover:border-amber-400/70 shadow-[0_0_15px_rgba(245,158,11,0.12)] hover:shadow-[0_0_20px_rgba(245,158,11,0.28)] transition-all duration-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                    </span>
                    <ScanLine size={13} className="text-amber-400 group-hover/scan:scale-110 transition-transform duration-200" />
                    <span className="font-mono text-[11px] font-black uppercase tracking-[0.16em] text-amber-300 group-hover/scan:text-amber-200 transition-colors">
                      SCAN QR
                    </span>
                  </div>
                </div>

                {/* QR code with interactive hover glow and click-to-copy */}
                <div className="flex justify-center mb-4">
                  <div
                    onClick={() => handleCopyQrLink(qrUrl, tbl.table_id)}
                    className="group/qr relative bg-white p-3.5 rounded-2xl shadow-[0_0_0_1.5px_rgba(0,0,0,0.08)] hover:shadow-[0_0_30px_rgba(245,158,11,0.35),0_0_0_2.5px_#f59e0b] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 cursor-pointer"
                    title="Click to copy menu link"
                  >
                    <QRCodeSVG
                      id={`stand-qr-svg-${tbl.table_id}`}
                      value={qrUrl}
                      size={140}
                      bgColor="#ffffff"
                      fgColor="#0a0a0a"
                      level="H"
                    />
                    <div className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover/qr:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                      {copiedTableId === tbl.table_id ? (
                        <div className="flex flex-col items-center gap-1 text-emerald-400 animate-in fade-in zoom-in duration-150">
                          <Check size={22} className="stroke-[3]" />
                          <span className="font-mono text-[10px] font-black tracking-wider uppercase">COPIED!</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-amber-300">
                          <Copy size={18} />
                          <span className="font-mono text-[10px] font-bold tracking-wider uppercase">COPY LINK</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Single WRITE NFC TAG button directly below QR code */}
                <button
                  type="button"
                  onClick={() => onWriteNfc(nfcUrl, tbl.table_id, tbl.table_name, tbl.short_code)}
                  className="w-full h-11 rounded-full border border-zinc-700/60 bg-[#12141a] hover:bg-[#181b24] hover:border-zinc-500/80 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 px-6 shadow-[0_2px_12px_rgba(0,0,0,0.5)] cursor-pointer group"
                >
                  <Wifi size={14} className="text-zinc-300 group-hover:text-white transition-colors" />
                  <span className="font-mono text-xs font-semibold tracking-wider text-zinc-200 group-hover:text-white transition-colors uppercase">
                    WRITE NFC TAG
                  </span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function TablesPage({ t, mode, settings = {} }) {
  const [loading, setLoading]             = useState(false);
  const [loadingPersisted, setLoadingPersisted] = useState(() => {
    try {
      return !localStorage.getItem('smart_menu_qr_data');
    } catch {
      return true;
    }
  });
  const [stepIndex, setStepIndex]         = useState(0);
  const [numTables, setNumTables]         = useState(5);
  const tableInputRef                     = useRef(null);
  const previewVideoRef                   = useRef(null);
  const [qrData, setQrDataState]          = useState(() => {
    try {
      const saved = localStorage.getItem('smart_menu_qr_data');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setQrData = useCallback((action) => {
    setQrDataState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        if (next) {
          localStorage.setItem('smart_menu_qr_data', JSON.stringify(next));
        } else {
          localStorage.removeItem('smart_menu_qr_data');
        }
      } catch (err) {
        console.warn('Failed to persist qrData to localStorage:', err);
      }
      return next;
    });
  }, []);

  const [error, setError]                 = useState(null);
  const [pendingFile, setPendingFile]     = useState(null);
  const [nfcSupported, setNfcSupported]   = useState(false);
  const [nfcStatus, setNfcStatus]         = useState({ kind: 'idle', message: '' });
  const [writingTable, setWritingTable]   = useState(null);
  const [resetting, setResetting]         = useState(false);
  const [resetConfirm, setResetConfirm]   = useState(false);
  const [isUploadingNew, setIsUploadingNew] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) setNfcSupported(true);
  }, []);

  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.muted = true;
      previewVideoRef.current.defaultMuted = true;
      const playPromise = previewVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    api.getTablesCurrent()
      .then((data) => {
        if (data && (data.tables?.length > 0 || data.counter_table)) {
          setQrData(data);
        } else {
          setQrData(null);
        }
      })
      .catch(() => {
        // preserve cache on network failure
      })
      .finally(() => setLoadingPersisted(false));
  }, [setQrData]);

  const doUpload = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setStepIndex(0);

    const upload = async (lat, lon) => {
      setStepIndex(1);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('num_tables', String(Number(numTables) || 1));
      if (lat != null) formData.append('admin_lat', lat);
      if (lon != null) formData.append('admin_lon', lon);

      const t1 = setTimeout(() => setStepIndex(2), 600);
      const t2 = setTimeout(() => setStepIndex(3), 1800);

      let res;
      try {
        res = await fetch('/api/process-menu', { method: 'POST', body: formData, credentials: 'include' });
      } catch {
        clearTimeout(t1); clearTimeout(t2);
        setLoading(false);
        setError({ kind: 'network', message: 'Could not reach the server.' });
        return;
      }
      clearTimeout(t1); clearTimeout(t2);

      if (!res.ok) {
        let detail = 'Menu processing failed.';
        try { const b = await res.json(); if (b?.detail) detail = b.detail; } catch {}
        setLoading(false);
        setError({ kind: 'processing', message: detail });
        return;
      }

      setStepIndex(4);
      const data = await res.json();
      await new Promise((r) => setTimeout(r, 350));
      setQrData(data);
      setIsUploadingNew(false);
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => upload(pos.coords.latitude, pos.coords.longitude),
      ()    => upload(null, null),
      { timeout: 8000 }
    );
  }, [numTables, setQrData]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    doUpload(file);
  };

  const handleRetry = () => { if (pendingFile) doUpload(pendingFile); };

  const resetToUpload = () => {
    setIsUploadingNew(true);
    setError(null);
    setPendingFile(null);
    setNfcStatus({ kind: 'idle', message: '' });
    setWritingTable(null);
    setResetConfirm(false);
  };

  const handleBackToQr = () => {
    setIsUploadingNew(false);
    setError(null);
    setPendingFile(null);
  };

  const handleResetQRs = async () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    setResetting(true); setResetConfirm(false);
    try {
      const data = await api.resetTables();
      setQrData(data);
      setNfcStatus({ kind: 'idle', message: 'QR codes reset — old printed cards are now invalid.' });
    } catch (e) {
      setError({ kind: 'processing', message: e.message || 'Reset failed.' });
    } finally {
      setResetting(false);
    }
  };

  const [activeNfcTarget, setActiveNfcTarget] = useState(null);
  const [standStudioState, setStandStudioState] = useState({
    isOpen: false,
    initialTableId: null,
    autoAction: null,
  });

  const handleOpenNfcModal = useCallback((url, tableId, tableName, shortCode) => {
    setActiveNfcTarget({ url, tableId, tableName, shortCode });
  }, []);

  const handleOpenStandStudio = useCallback((tableId = null, autoAction = null) => {
    setStandStudioState({
      isOpen: true,
      initialTableId: tableId,
      autoAction,
    });
  }, []);

  const allStandItems = React.useMemo(() => {
    if (!qrData) return [];
    const items = [];
    if (qrData.counter_table) {
      const ct = qrData.counter_table;
      items.push({
        ...ct,
        isCounter: true,
        qrUrl: `${window.location.origin}/t/${ct.short_code || ct.token}?src=qr`,
        nfcUrl: `${window.location.origin}/t/${ct.short_code || ct.token}?src=nfc`,
      });
    }
    if (Array.isArray(qrData.tables)) {
      qrData.tables.forEach((tbl) => {
        const rawName = tbl.table_name || `Table ${tbl.table_id}`;
        const formattedName = rawName.replace(/^Table(\d+)/i, 'Table $1');
        items.push({
          ...tbl,
          table_name: formattedName,
          isCounter: false,
          qrUrl: `${window.location.origin}/t/${tbl.short_code || tbl.token}?src=qr`,
          nfcUrl: `${window.location.origin}/t/${tbl.short_code || tbl.token}?src=nfc`,
        });
      });
    }
    return items;
  }, [qrData]);

  const handleRenameTable = useCallback(async (tableId, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed) return;

    // 1. Optimistically update local state & localStorage immediately
    setQrData((prev) => {
      if (!prev) return prev;
      const updatedTables = Array.isArray(prev.tables)
        ? prev.tables.map((t) =>
            String(t.table_id) === String(tableId) ? { ...t, table_name: trimmed } : t
          )
        : [];
      let updatedCounter = prev.counter_table;
      if (String(tableId) === 'COUNTER' && updatedCounter) {
        updatedCounter = { ...updatedCounter, table_name: trimmed };
      }
      return { ...prev, tables: updatedTables, counter_table: updatedCounter };
    });

    // 2. Persist to backend
    try {
      const res = await api.renameTable(tableId, trimmed, qrData?.menu_id);
      const serverName = res?.table?.table_name || res?.table_name || trimmed;
      if (serverName !== trimmed) {
        setQrData((prev) => {
          if (!prev) return prev;
          const updatedTables = Array.isArray(prev.tables)
            ? prev.tables.map((t) =>
                String(t.table_id) === String(tableId) ? { ...t, table_name: serverName } : t
              )
            : [];
          let updatedCounter = prev.counter_table;
          if (String(tableId) === 'COUNTER' && updatedCounter) {
            updatedCounter = { ...updatedCounter, table_name: serverName };
          }
          return { ...prev, tables: updatedTables, counter_table: updatedCounter };
        });
      }
    } catch (err) {
      console.warn('Backend sync error (saved locally):', err);
    }
  }, [setQrData]);

  if (loadingPersisted) {
    return (
      <div className="flex items-center justify-center py-28">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
          <p className="font-mono text-xs text-zinc-500">Loading table and QR configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Inject print + screen styles */}
      <style>{PRINT_STYLES}</style>

      {/* Print pages — invisible on screen, one per table ────────────── */}
      {qrData && (
        <PrintPages
          qrData={qrData}
          restaurantName={settings?.restaurant_name}
        />
      )}

      {/* ── Screen UI ─────────────────────────────────────────────────── */}
      <div className="screen-only relative w-full min-h-screen px-6 sm:px-10 lg:px-12 xl:px-16 py-6 pb-28 lg:pb-20 max-w-[1700px] mx-auto">
        {/* Ambient background glow & subtle dot pattern */}
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-32 left-1/4 w-[800px] h-[700px] rounded-full blur-[160px] bg-gradient-to-br from-amber-500/12 via-orange-500/6 to-transparent" />
          <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] rounded-full blur-[150px] bg-gradient-to-tl from-cyan-500/6 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px] opacity-40" />
        </div>

        <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Tables &amp; QR codes
            </h1>
            <p className="font-mono text-xs mt-1.5 text-zinc-400">
              Generate per-table QR codes, NFC tags, and commercial PDF / SVG table stands with &ldquo;Tap Phone Here or Scan QR&rdquo;.
            </p>
          </div>

          {qrData && !isUploadingNew && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenStandStudio(null, null)}
                className="h-10 inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none font-mono text-xs font-black px-5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all cursor-pointer active:scale-95"
              >
                <Printer size={14} className="shrink-0" />
                <span>Export ALL QR (PDF)</span>
              </button>
              <button
                type="button"
                onClick={handleResetQRs}
                disabled={resetting}
                className={`h-10 inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none font-mono text-xs font-bold px-4 rounded-full border transition-all disabled:opacity-50 cursor-pointer ${
                  resetConfirm
                    ? 'border-rose-500/60 text-rose-400 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                    : 'border-white/10 bg-[#0a0d14]/70 backdrop-blur-xl text-zinc-300 hover:border-white/25 hover:text-white shadow-lg'
                }`}
              >
                {resetting
                  ? <><RefreshCw size={14} className="animate-spin text-rose-400 shrink-0" /><span>Resetting…</span></>
                  : <><RotateCcw size={14} className="shrink-0" /><span>{resetConfirm ? 'Confirm Reset?' : 'Reset QR Codes'}</span></>}
              </button>
              <button
                type="button"
                onClick={resetToUpload}
                className="h-10 inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none font-mono text-xs font-bold px-4 rounded-full border border-white/10 bg-[#0a0d14]/70 backdrop-blur-xl text-white hover:border-amber-400/50 hover:bg-amber-500/10 hover:text-amber-400 transition-all shadow-lg cursor-pointer"
              >
                <Plus size={14} className="shrink-0" />
                <span>New menu</span>
              </button>
            </div>
          )}

          {qrData && isUploadingNew && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleBackToQr}
                className="h-10 inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none font-mono text-xs font-bold px-4 rounded-full border border-white/15 bg-[#0a0d14]/70 backdrop-blur-xl text-zinc-300 hover:text-white hover:border-amber-400/50 hover:bg-amber-500/10 transition-all shadow-lg cursor-pointer active:scale-95"
              >
                <ArrowLeft size={14} className="text-amber-400 shrink-0" />
                <span>Back to QR Codes</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Table2}     label="Active tables"    value={qrData ? qrData.tables.length : numTables} sub="This location" t={t} />
          <StatCard icon={TrendingUp} label="Menus processed"  value={qrData ? '1+' : '0'} sub="This session" t={t} />
          <StatCard icon={Receipt}    label="Orders today"     value="—" sub="See Orders page" t={t} />
          <StatCard icon={Sparkles}   label="AI parses"        value={qrData ? '1+' : '0'} sub="This session" t={t} />
        </div>

        {/* Reset confirm warning */}
        <AnimatePresence>
          {resetConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4"
            >
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <p className="font-mono text-xs text-rose-300">
                This regenerates all QR tokens — already-printed cards will stop working.
                Click <strong>Confirm Reset?</strong> above to proceed.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative rounded-[28px] border border-white/[0.12] bg-[#08090e]/75 backdrop-blur-[24px] p-7 sm:p-10 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden">
          {/* Top specular highlight line */}
          <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />

          <AnimatePresence mode="wait">

            {/* Upload form */}
            {(!qrData || isUploadingNew) && !loading && !error && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                  {/* Left Column: Form Controls (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between gap-3.5 flex-wrap">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                          <Zap size={20} />
                        </div>
                        <div>
                          <h2 className="font-bold text-lg text-white">Upload a new menu</h2>
                          <p className="font-mono text-[11px] text-zinc-400">
                            AI parsing · dish photos · secure QR generation
                          </p>
                        </div>
                      </div>

                      {qrData && (
                        <button
                          type="button"
                          onClick={handleBackToQr}
                          className="h-8 px-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 hover:border-amber-400/50 text-zinc-300 hover:text-white font-mono text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Back to previously generated QR codes"
                        >
                          <ArrowLeft size={13} className="text-amber-400 shrink-0" />
                          <span>Back to QR codes</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <label 
                        onClick={() => {
                          tableInputRef.current?.focus();
                          tableInputRef.current?.select();
                        }}
                        className="font-mono text-xs font-bold tracking-wider text-amber-400 uppercase select-none cursor-pointer"
                      >
                        TOTAL TABLES / ROOMS
                      </label>
                      <div
                        onClick={() => {
                          tableInputRef.current?.focus();
                          tableInputRef.current?.select();
                        }}
                        className="group relative flex items-center mt-2 border border-white/[0.12] hover:border-amber-400/50 bg-[#08090e]/85 backdrop-blur-[20px] rounded-2xl focus-within:border-amber-400/70 focus-within:shadow-[0_0_0_1px_rgba(245,158,11,0.4),0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_0_16px_rgba(245,158,11,0.2)] transition-all duration-300 shadow-[0_8px_25px_-5px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.1)] cursor-text overflow-hidden"
                      >
                        <input
                          ref={tableInputRef}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={numTables}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.target.select();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                              if (numTables === 0 || numTables === '0') {
                                e.preventDefault();
                                tableInputRef.current?.select();
                                return;
                              }
                              const input = e.currentTarget;
                              const isAllSelected = input.selectionStart === 0 && input.selectionEnd === String(input.value).length;
                              const isSingleChar = String(input.value).length <= 1;
                              if (isAllSelected || isSingleChar) {
                                e.preventDefault();
                                setNumTables(0);
                                setTimeout(() => {
                                  tableInputRef.current?.select();
                                }, 0);
                              }
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (val === '' || val === '0') {
                              setNumTables(0);
                              setTimeout(() => {
                                tableInputRef.current?.select();
                              }, 0);
                            } else {
                              const n = parseInt(val, 10);
                              setNumTables(isNaN(n) ? 0 : Math.min(100, Math.max(0, n)));
                            }
                          }}
                          onBlur={() => {
                            if (numTables === '' || numTables == null) setNumTables(0);
                            else if (numTables > 100) setNumTables(100);
                          }}
                          className="w-full bg-transparent px-4 py-3.5 font-mono text-lg text-white outline-none select-all"
                        />
                        <div className="flex flex-col pr-2.5 pl-1 py-1 shrink-0 select-none">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setNumTables((prev) => Math.min(100, (Number(prev) || 0) + 1));
                            }}
                            className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-white/10 active:scale-90 rounded transition-all flex items-center justify-center cursor-pointer"
                            aria-label="Increase tables"
                          >
                            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setNumTables((prev) => Math.max(0, (Number(prev) || 0) - 1));
                            }}
                            className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-white/10 active:scale-90 rounded transition-all flex items-center justify-center cursor-pointer"
                            aria-label="Decrease tables"
                          >
                            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <label className="relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer overflow-hidden border-white/15 hover:border-amber-400/60 bg-[#08090e]/60 backdrop-blur-[20px] shadow-[0_16px_40px_-10px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.08)] hover:shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_0_24px_rgba(245,158,11,0.25)] transition-all duration-300">
                      <div className="absolute top-0 left-12 right-12 h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                      <div className="relative w-16 h-16 rounded-2xl border border-white/15 bg-amber-500/10 flex items-center justify-center mb-4">
                        <Upload className="w-7 h-7 text-amber-400" />
                      </div>
                      <span className="relative font-mono font-bold tracking-widest text-xs text-amber-400">
                        UPLOAD MENU IMAGE
                      </span>
                      <span className="relative font-mono text-[10px] mt-2 text-zinc-400">
                        JPG or PNG, one page at a time
                      </span>
                    </label>
                  </div>

                  {/* Right Column: Square-shaped Video Card (5 cols) */}
                  <div className="lg:col-span-5 flex items-start justify-center lg:justify-end">
                    <div className="relative aspect-square w-full max-w-[340px] sm:max-w-[380px] lg:max-w-[420px] rounded-[26px] overflow-hidden border border-white/[0.12] hover:border-amber-400/60 bg-[#08090e]/75 backdrop-blur-[24px] shadow-[0_16px_40px_-10px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.12)] hover:shadow-[0_0_0_1px_rgba(245,158,11,0.4),0_0_24px_rgba(245,158,11,0.3),0_16px_40px_-10px_rgba(0,0,0,0.85)] transition-all duration-300 flex items-center justify-center group">
                      {/* Top rim specular highlight */}
                      <div className="absolute top-0 left-6 right-6 h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-white/25 to-transparent z-10" />

                      {/* Video */}
                      <video
                        ref={(el) => {
                          previewVideoRef.current = el;
                          if (el) {
                            el.muted = true;
                            el.defaultMuted = true;
                            el.play().catch(() => {});
                          }
                        }}
                        src="/videos/PixVerse_no_watermark.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        onLoadedData={(e) => {
                          e.currentTarget.muted = true;
                          e.currentTarget.play().catch(() => {});
                        }}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Loading */}
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-2">
                <div className="flex items-center gap-3 mb-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                    className="w-9 h-9 rounded-full border-2 border-white/10"
                    style={{ borderTopColor: '#f59e0b' }}
                  />
                  <h2 className="font-mono text-sm tracking-wide text-white">
                    Building your smart menu...
                  </h2>
                </div>
                <UploadProgress stepIndex={stepIndex} t={t} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-2xl">
                  {Array.from({ length: Math.min(Number(numTables) || 1, 4) }).map((_, i) => (
                    <SkeletonCard key={i} t={t} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && !loading && (
              <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-5">
                  <AlertTriangle className="w-7 h-7 text-rose-400" />
                </div>
                <h2 className="text-rose-400 font-bold text-lg mb-2">
                  {error.kind === 'network' ? 'CONNECTION LOST' : 'PROCESSING FAILED'}
                </h2>
                <p className="text-xs leading-relaxed mb-6 font-mono text-zinc-400">{error.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleRetry}
                    className="border border-white/10 font-bold font-mono text-xs px-5 py-3 rounded-xl flex items-center gap-2 hover:border-amber-400/40 hover:text-amber-400 text-white bg-white/5 transition-all cursor-pointer"
                  >
                    <RefreshCw size={14} /> RETRY
                  </button>
                  <button
                    onClick={resetToUpload}
                    className="border border-white/10 font-bold font-mono text-xs px-5 py-3 rounded-xl text-zinc-400 hover:text-white bg-white/5 transition-all cursor-pointer"
                  >
                    CHOOSE NEW FILE
                  </button>
                  {qrData && (
                    <button
                      onClick={handleBackToQr}
                      className="border border-white/10 font-bold font-mono text-xs px-5 py-3 rounded-xl text-zinc-300 hover:text-white hover:border-amber-400/40 bg-white/5 transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <ArrowLeft size={14} className="text-amber-400 shrink-0" />
                      <span>CANCEL &amp; BACK</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* QR grid */}
            {qrData && !isUploadingNew && !loading && (
              <QRGrid
                qrData={qrData}
                t={t}
                mode={mode}
                nfcSupported={nfcSupported}
                nfcStatus={nfcStatus}
                writingTable={writingTable}
                onWriteNfc={handleOpenNfcModal}
                onOpenStandStudio={handleOpenStandStudio}
                restaurantName={settings?.restaurant_name}
              />
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* NFC Modal Dialog */}
      <NfcModal
        isOpen={!!activeNfcTarget}
        onClose={() => setActiveNfcTarget(null)}
        target={activeNfcTarget}
        nfcSupported={nfcSupported}
        onNfcStatusChange={setNfcStatus}
      />

      {/* Table Stand Generator & Commercial Bulk Export Studio Modal */}
      <TableStandStudioModal
        isOpen={standStudioState.isOpen}
        onClose={() => setStandStudioState({ isOpen: false, initialTableId: null, autoAction: null })}
        allItems={allStandItems}
        initialTableId={standStudioState.initialTableId}
        restaurantName={settings?.restaurant_name || qrData?.restaurant_name || 'SMART MENU'}
        autoAction={standStudioState.autoAction}
        onAutoActionComplete={() =>
          setStandStudioState((prev) => ({ ...prev, autoAction: null }))
        }
      />
    </div>
  );
}

export default TablesPage;