import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  QrCode,
  FileUp,
  UtensilsCrossed,
  Receipt,
  ArrowRight,
  CheckCircle2,
  FileText,
  Smartphone,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SHOWCASE_FEATURES } from '../lib/constants';

gsap.registerPlugin(ScrollTrigger);

/**
 * Helper to render appropriate icon for each feature
 */
function getFeatureIcon(iconName, isActive) {
  const iconProps = { className: 'w-4 h-4' };
  switch (iconName) {
    case 'QrCode':
      return <QrCode {...iconProps} />;
    case 'FileUp':
      return <FileUp {...iconProps} />;
    case 'UtensilsCrossed':
      return <UtensilsCrossed {...iconProps} />;
    case 'Receipt':
      return <Receipt {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
}

/**
 * Feature 1 Micro-visualization: Interactive Table QR Grid (Rearranged & Fixed Height)
 */
function TableQRVisualization() {
  const tables = [
    { id: 'T-01', name: 'Table 01', zone: 'Main Dining' },
    { id: 'T-02', name: 'Table 02', zone: 'Window Booth' },
    { id: 'T-03', name: 'Table 03', zone: 'Garden Patio' },
    { id: 'T-04', name: 'Table 04', zone: 'Chef Counter' },
  ];

  return (
    <div className="h-full flex flex-col justify-between">
      {/* Top Registry Status Bar */}
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          TABLE REGISTRY ONLINE
        </span>
        <span className="text-zinc-500 hidden sm:inline">24/24 QR ACTIVE</span>
      </div>

      {/* 4 Table Cards in single compact row */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {tables.map((table) => (
          <div
            key={table.id}
            className="p-1.5 sm:p-2 rounded-xl bg-[#090a0f] border border-white/10 hover:border-amber-400/40 transition-colors duration-200 flex flex-col items-center text-center group"
          >
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-black border border-amber-400/30 flex items-center justify-center relative mb-0.5 sm:mb-1 group-hover:border-amber-400 transition-colors">
              <QrCode className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-300" />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
            </div>

            <span className="text-[9px] sm:text-[11px] font-bold font-mono text-white group-hover:text-amber-300 transition-colors leading-tight">
              {table.name}
            </span>
            <span className="text-[8px] sm:text-[9px] font-mono text-zinc-400 mt-0.5 leading-tight truncate w-full">
              {table.zone}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom URL Handshake Strip */}
      <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-[9px] sm:text-[10px] font-mono">
        <span className="text-zinc-400 flex items-center gap-1.5 truncate">
          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">Instant Access Handshake:</span>
        </span>
        <span className="text-amber-400 font-semibold truncate ml-2">smartmenu.app/t/01</span>
      </div>
    </div>
  );
}

/**
 * Feature 2 Micro-visualization: Menu Upload -> Digital Menu -> QR Ready Pipeline (Fixed Height)
 */
function MenuToQRPipeline() {
  const steps = [
    {
      title: 'MENU UPLOAD',
      subtext: 'PDF / Photo / Sheet',
      badge: 'PARSED',
      badgeColor: 'text-zinc-300 bg-white/5 border-white/10',
      icon: <FileText className="w-3.5 h-3.5 text-zinc-300" />,
    },
    {
      title: 'DIGITAL MENU',
      subtext: 'Items & Prices Synced',
      badge: 'STRUCTURED',
      badgeColor: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      title: 'QR READY',
      subtext: 'Unique Table URLs',
      badge: 'DEPLOYED',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      icon: <QrCode className="w-3.5 h-3.5 text-emerald-400" />,
    },
  ];

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          TRANSFORMATION PIPELINE
        </span>
        <span className="text-zinc-500">AUTO-INGESTION ENGINE</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {steps.map((step) => (
          <div
            key={step.title}
            className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10 hover:border-amber-400/40 transition-colors duration-200 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
                {step.icon}
              </div>
              <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border font-bold ${step.badgeColor}`}>
                {step.badge}
              </span>
            </div>

            <div>
              <h5 className="text-[11px] font-bold font-mono text-white tracking-wide">{step.title}</h5>
              <p className="text-[9px] text-zinc-400 font-sans mt-0.5 leading-tight truncate">{step.subtext}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-[10px] font-mono">
        <span className="text-zinc-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Ingestion Complete in 0.84s:
        </span>
        <span className="text-emerald-400 font-semibold">48 Dishes &amp; Modifiers Active</span>
      </div>
    </div>
  );
}

/**
 * Feature 3 Micro-visualization: Real-Time Order Flow (Fixed Height)
 */
function OrderFlowVisualization() {
  const stages = [
    { title: 'GUEST', desc: 'Table Scan', icon: <Smartphone className="w-3.5 h-3.5 text-zinc-300" /> },
    { title: 'MENU', desc: 'Dishes Picked', icon: <UtensilsCrossed className="w-3.5 h-3.5 text-amber-300" /> },
    { title: 'ORDER', desc: 'Sent Direct', icon: <ArrowRight className="w-3.5 h-3.5 text-amber-400" /> },
    { title: 'KITCHEN', desc: 'KDS Sync', icon: <Flame className="w-3.5 h-3.5 text-emerald-400" /> },
  ];

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          DIRECT ORDER STREAM
        </span>
        <span className="text-zinc-500">NO WAITER DELAY</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {stages.map((stg, idx) => (
          <div
            key={stg.title}
            className="p-1.5 sm:p-2 rounded-xl bg-[#090a0f] border border-white/10 hover:border-amber-400/40 transition-colors duration-200 flex flex-col items-center text-center"
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center mb-0.5 sm:mb-1">
              {stg.icon}
            </div>
            <span className="text-[9px] sm:text-[11px] font-bold font-mono text-white leading-tight">{stg.title}</span>
            <span className="text-[8px] sm:text-[9px] font-mono text-zinc-400 mt-0.5 leading-tight truncate w-full">{stg.desc}</span>
            <div className="mt-0.5 sm:mt-1 text-[7px] sm:text-[8px] font-mono text-amber-400">STEP 0{idx + 1}</div>
          </div>
        ))}
      </div>

      <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-[9px] sm:text-[10px] font-mono">
        <span className="text-zinc-400 flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="truncate">Live Ticket #108:</span>
        </span>
        <span className="text-amber-400 font-semibold truncate ml-2">Tagliolini → Fired</span>
      </div>
    </div>
  );
}

/**
 * Feature 4 Micro-visualization: Parallel Bill Generation Workflow (Fixed Height)
 */
function ParallelBillingVisualization() {
  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          PARALLEL LEDGER PIPELINE
        </span>
        <span className="text-zinc-500">REAL-TIME AUTO SYNC</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-mono text-zinc-400 uppercase">STREAM A</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[8px] font-mono font-bold">
              ORDER
            </span>
          </div>
          <h5 className="text-[11px] font-bold font-mono text-white">ORDER RECEIVED</h5>
          <div className="text-[9px] font-mono text-emerald-400 font-semibold mt-1">+ 2 Items ($72.50)</div>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/30 flex flex-col items-center justify-center text-center">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping mb-1" />
          <span className="text-[9px] font-mono text-amber-300 font-bold uppercase tracking-wider">
            PARALLEL SYNC
          </span>
          <div className="mt-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[8px] font-mono font-bold">
            &lt; 50ms LATENCY
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-mono text-zinc-400 uppercase">STREAM B</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-mono font-bold">
              BILL
            </span>
          </div>
          <h5 className="text-[11px] font-bold font-mono text-white">BILL UPDATED</h5>
          <div className="text-[9px] font-mono text-amber-400 font-semibold mt-1">Total: $72.50 (Live)</div>
        </div>
      </div>

      <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-[10px] font-mono">
        <span className="text-zinc-400 flex items-center gap-1.5">
          <Receipt className="w-3 h-3 text-amber-400" />
          Payment Status:
        </span>
        <span className="text-emerald-400 font-semibold truncate ml-2">Split / Tap-to-Pay Ready</span>
      </div>
    </div>
  );
}

/**
 * Select the appropriate micro-visualization for the active feature
 */
function FeatureMicroVisualization({ featureId }) {
  switch (featureId) {
    case 'instant-qr':
      return <TableQRVisualization />;
    case 'menu-to-qr':
      return <MenuToQRPipeline />;
    case 'order-direct':
      return <OrderFlowVisualization />;
    case 'parallel-billing':
      return <ParallelBillingVisualization />;
    default:
      return <TableQRVisualization />;
  }
}

export default function ProductShowcase() {
  const [activeFeatureId, setActiveFeatureId] = useState('instant-qr');
  const activeFeature =
    SHOWCASE_FEATURES.find((f) => f.id === activeFeatureId) || SHOWCASE_FEATURES[0];

  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const leftColRef = useRef(null);
  const rightColRef = useRef(null);
  const ambientHaloRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // DESKTOP CINEMATIC PINNED TIMELINE
      mm.add('(min-width: 769px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: '+=170%',
            pin: true,
            scrub: 1,
            anticipatePin: 1,
          },
        });

        // 1. Ambient Golden Halo Bloom
        tl.fromTo(
          ambientHaloRef.current,
          { scale: 0.2, opacity: 0 },
          { scale: 2.8, opacity: 0.6, ease: 'power2.out', duration: 0.25 },
          0
        );

        // 2. Header Focus Pull Reveal
        tl.fromTo(
          headerRef.current,
          { opacity: 0, y: 35, scale: 0.94, filter: 'blur(10px)' },
          { opacity: 1, y: 0, scale: 1.0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.16 },
          0.02
        );

        // 3. Feature Selection Panel enters from left
        tl.fromTo(
          leftColRef.current,
          { x: -80, opacity: 0, filter: 'blur(8px)' },
          { x: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
          0.06
        );

        // 4. Interactive Console enters from right depth with 3D perspective angle
        tl.fromTo(
          rightColRef.current,
          { x: 80, y: 30, scale: 0.9, opacity: 0, filter: 'blur(10px)' },
          { x: 0, y: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
          0.08
        );

        // 5. Section exit transition: focus shifts out gently
        tl.to(
          containerRef.current,
          {
            scale: 0.94,
            filter: 'blur(12px)',
            opacity: 0.2,
            ease: 'power2.in',
            duration: 0.15,
          },
          0.85
        );
      });

      // MOBILE TIMELINE: Fluid responsive scroll reveal without layout-breaking pin
      mm.add('(max-width: 768px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
            end: 'top 25%',
            scrub: 0.6,
          },
        });

        tl.fromTo(headerRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.3 }, 0);
        tl.fromTo(leftColRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.35 }, 0.1);
        tl.fromTo(rightColRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.35 }, 0.15);
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative w-full min-h-screen py-12 lg:py-0 lg:h-[100svh] lg:min-h-[680px] lg:max-h-[900px] bg-[#05060a] border-t border-white/5 overflow-hidden flex items-center justify-center select-none"
    >
      {/* Ambient Aperture Halo */}
      <div
        ref={ambientHaloRef}
        className="absolute top-1/3 right-1/4 w-[460px] h-[460px] rounded-full pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.04) 55%, transparent 75%)',
          filter: 'blur(80px)',
        }}
      />

      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full will-change-[transform,opacity,filter]"
      >
        {/* Section Header */}
        <div ref={headerRef} className="text-center max-w-3xl mx-auto mb-5 lg:mb-7 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>INTELLIGENT DINING PLATFORM</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display uppercase tracking-tight leading-[1.08]">
            <span className="block text-white">THE FUTURE OF</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500">
              RESTAURANT DINING.
            </span>
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm font-sans max-w-2xl mx-auto leading-relaxed">
            One intelligent menu. Real-time control. Personalized experiences for every guest.
          </p>
        </div>

        {/* Two-Column Feature Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
          {/* Left Column: 4 Feature Cards */}
          <div ref={leftColRef} className="lg:col-span-5 space-y-2.5 will-change-[transform,opacity,filter]">
            {SHOWCASE_FEATURES.map((feature) => {
              const isActive = feature.id === activeFeatureId;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setActiveFeatureId(feature.id)}
                  onMouseEnter={() => setActiveFeatureId(feature.id)}
                  className={`w-full text-left p-3 sm:p-3.5 rounded-2xl transition-all duration-300 border flex items-start gap-3 cursor-pointer relative group ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-400/60 shadow-xl shadow-amber-500/15 scale-[1.01] ring-1 ring-amber-400/30'
                      : 'bg-[#0b0c12]/70 border-white/5 hover:border-white/20 hover:bg-[#0f111a]/80 hover:-translate-y-0.5'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isActive
                        ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                        : 'bg-white/5 text-zinc-400 group-hover:text-amber-400 group-hover:bg-amber-500/10'
                    }`}
                  >
                    {getFeatureIcon(feature.icon, isActive)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3
                        className={`text-xs sm:text-sm font-bold font-display uppercase tracking-wide truncate ${
                          isActive ? 'text-amber-300' : 'text-white group-hover:text-zinc-100'
                        }`}
                      >
                        {feature.cardTitle}
                      </h3>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0 ml-2" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans mt-0.5 line-clamp-2 leading-relaxed">
                      {feature.cardDescription}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Dynamic Live Engine Product Dashboard (Fixed Strict Height) */}
          <div ref={rightColRef} className="lg:col-span-7 will-change-[transform,opacity,filter]">
            <div className="relative p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#0e1017] via-[#090a0f] to-[#0d0e14] border border-amber-500/35 shadow-2xl shadow-black/90 h-[480px] max-h-[480px] flex flex-col justify-between backdrop-blur-md overflow-hidden">
              {/* Browser / Frame Top Bar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-sm shadow-red-500/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow-sm shadow-amber-500/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-sm shadow-emerald-500/30" />
                  <span className="ml-2 text-[10px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
                    smart-menu-engine // v2.4
                  </span>
                </div>
                <span className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  {activeFeature.microLabel}
                </span>
              </div>

              {/* Dynamic Animated Content Container (Strict Fixed Height h-[346px], Zero Layout Shift) */}
              <div className="my-auto h-[346px] flex flex-col justify-between overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFeature.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full flex flex-col justify-between"
                  >
                    {/* 1. Feature Highlight Header Block (Strict Fixed Height h-[104px]) */}
                    <div className="h-[104px] p-3 sm:p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-sm flex flex-col justify-between shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-amber-400 font-bold tracking-widest">
                          FEATURE HIGHLIGHT
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">
                          SYSTEM 0{activeFeature.number}
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg lg:text-xl font-bold font-display text-white truncate">
                        {activeFeature.title}
                      </h4>
                      <p className="text-zinc-300 font-sans text-xs line-clamp-2 leading-relaxed">
                        {activeFeature.description}
                      </p>
                    </div>

                    {/* 2. Dedicated Feature Micro-Visualization (Strict Fixed Height h-[142px]) */}
                    <div className="h-[142px] p-3 rounded-2xl bg-white/[0.02] border border-white/5 shrink-0 overflow-hidden">
                      <FeatureMicroVisualization featureId={activeFeature.id} />
                    </div>

                    {/* 3. 2 Key Information / Stat Blocks (Strict Fixed Height h-[64px]) */}
                    <div className="h-[64px] grid grid-cols-2 gap-3 shrink-0">
                      <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-center">
                        <span className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                          {activeFeature.stat1Label}
                        </span>
                        <span className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-0.5 block leading-tight">
                          {activeFeature.stat1Value}
                        </span>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-center">
                        <span className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                          {activeFeature.stat2Label}
                        </span>
                        <span className="text-base sm:text-lg font-bold font-mono text-amber-400 mt-0.5 block leading-tight">
                          {activeFeature.stat2Value}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Console Footer & Live Status Indicator (Strict Fixed Height) */}
              <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-mono text-zinc-400 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-zinc-300 font-semibold uppercase tracking-wider text-[10px] sm:text-[11px]">
                    {activeFeature.bottomStatus}
                  </span>
                </div>
                <span className="text-amber-400 font-bold tracking-wider text-[11px]">SMART MENU OS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
