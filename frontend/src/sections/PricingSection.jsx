import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, Sparkles, Zap, ShieldCheck, ChevronRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PRICING_PLANS } from '../lib/constants';

gsap.registerPlugin(ScrollTrigger);

/**
 * 3D Glass Interactive Pricing Card
 * Features:
 * - Cursor-tracked physical tilt via requestAnimationFrame
 * - Dynamic specular light sheen following pointer
 * - Peer hover dimming (unfocused cards subdue to 0.88 opacity)
 * - Distinct cyan/teal accents on standard tiers, elevated amber/gold on Brasserie (popular)
 */
function PricingCard({
  plan,
  index,
  annual,
  hoveredIndex,
  setHoveredIndex,
  onOpenDemo,
  cardRefCallback,
}) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, shineX: 50, shineY: 50 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isHovered = hoveredIndex === index;
  const isAnyHovered = hoveredIndex !== null;
  const isOtherHovered = isAnyHovered && !isHovered;
  const isPopular = plan.popular;

  const handleMouseMove = useCallback(
    (e) => {
      if (reducedMotion || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5
      const shineX = ((e.clientX - rect.left) / rect.width) * 100;
      const shineY = ((e.clientY - rect.top) / rect.height) * 100;

      requestAnimationFrame(() => {
        setTilt({
          rotateX: -y * 6.5,
          rotateY: x * 6.5,
          shineX,
          shineY,
        });
      });
    },
    [reducedMotion]
  );

  const handleMouseEnter = () => setHoveredIndex(index);
  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTilt({ rotateX: 0, rotateY: 0, shineX: 50, shineY: 50 });
  };

  // Base spatial depth: Brasserie is naturally elevated
  const baseTranslateZ = isPopular ? 14 : 0;
  const baseScale = isPopular ? 1.02 : 1.0;

  const transformStyle = isHovered && !reducedMotion
    ? `translate3d(0px, -12px, ${baseTranslateZ + 36}px) scale(${baseScale * 1.025}) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
    : isOtherHovered
    ? `translate3d(0px, 0px, ${baseTranslateZ - 10}px) scale(${baseScale * 0.985}) rotateX(0deg) rotateY(0deg)`
    : `translate3d(0px, 0px, ${baseTranslateZ}px) scale(${baseScale}) rotateX(0deg) rotateY(0deg)`;

  const price = annual ? plan.priceAnnual : plan.priceMonthly;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-3xl p-6 sm:p-7 lg:p-8 flex flex-col justify-between transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity,filter,box-shadow] select-none ${
        isPopular
          ? 'bg-gradient-to-b from-[#11141c]/90 via-[#0c0e14]/90 to-[#07080c]/95 border border-amber-400/50 shadow-[0_12px_45px_rgba(0,0,0,0.7),0_0_35px_rgba(245,158,11,0.16)] z-20'
          : 'bg-[#0b0d12]/85 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 shadow-[0_12px_36px_rgba(0,0,0,0.65)] hover:shadow-[0_12px_45px_rgba(6,182,212,0.14)] z-10'
      }`}
      style={{
        transform: transformStyle,
        opacity: isOtherHovered ? 0.88 : 1.0,
        filter: isOtherHovered ? 'blur(0.4px)' : 'none',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Specular light sheen on hover */}
      {isHovered && !reducedMotion && (
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none opacity-40 transition-opacity duration-200"
          style={{
            background: isPopular
              ? `radial-gradient(circle 240px at ${tilt.shineX}% ${tilt.shineY}%, rgba(245, 158, 11, 0.22), transparent 70%)`
              : `radial-gradient(circle 240px at ${tilt.shineX}% ${tilt.shineY}%, rgba(6, 182, 212, 0.22), transparent 70%)`,
          }}
        />
      )}

      {/* Top Most Popular Ribbon */}
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-black text-[10px] font-mono font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow-[0_4px_16px_rgba(245,158,11,0.4)]">
          <Sparkles className="w-3 h-3 text-black fill-black" />
          <span>MOST POPULAR</span>
        </div>
      )}

      {/* Card Content Top */}
      <div className="space-y-4">
        {/* Tier Name & Sub-badge */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xl lg:text-2xl font-bold font-display uppercase tracking-tight text-white">
            {plan.name}
          </h3>
          <span
            className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${
              isPopular
                ? 'bg-amber-400/10 text-amber-300 border-amber-400/30'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
            }`}
          >
            {index === 0 ? 'BOUTIQUE' : index === 1 ? 'RECOMMENDED' : 'SCALE'}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-[13px] text-zinc-400 font-sans leading-relaxed min-h-[40px]">
          {plan.description}
        </p>

        {/* Pricing figure */}
        <div className="pt-2 pb-1 border-b border-white/10">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight ${
                isPopular
                  ? 'bg-gradient-to-r from-amber-200 via-white to-amber-300 bg-clip-text text-transparent'
                  : 'text-white'
              }`}
            >
              {price}
            </span>
            {price !== 'Custom' ? (
              <span className="text-xs font-mono text-zinc-400">/ month</span>
            ) : (
              <span className="text-xs font-mono text-zinc-400">/ bespoke contract</span>
            )}
          </div>
          {annual && price !== 'Custom' && (
            <p className="text-[11px] font-mono text-amber-400/90 mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Billed annually (Save 20%)</span>
            </p>
          )}
        </div>

        {/* Feature List */}
        <div className="space-y-2.5 pt-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            {isPopular ? 'EVERYTHING IN BISTRO, PLUS:' : 'INCLUDED CAPABILITIES:'}
          </p>
          <div className="space-y-2">
            {plan.features.map((feat) => (
              <div key={feat} className="flex items-start gap-2.5 text-xs font-mono text-zinc-300 leading-snug">
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    isPopular
                      ? 'bg-amber-400/15 text-amber-400 border border-amber-400/40'
                      : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Button Bottom */}
      <div className="mt-7 pt-2">
        <button
          onClick={onOpenDemo}
          className={`w-full py-3.5 px-4 rounded-2xl font-mono font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            isPopular
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black shadow-[0_4px_22px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_30px_rgba(245,158,11,0.5)] hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-cyan-400/40 hover:text-cyan-300 active:scale-[0.98]'
          }`}
        >
          <span>{plan.cta}</span>
          <ChevronRight className={`w-3.5 h-3.5 ${isPopular ? 'text-black' : 'text-zinc-400'}`} />
        </button>
      </div>
    </div>
  );
}

export default function PricingSection({ onOpenDemo }) {
  const [annual, setAnnual] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const cardsWrapperRef = useRef(null);
  const cardRefs = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // DESKTOP PINNED CINEMATIC TIMELINE
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

        // 1. Header Focus Pull
        tl.fromTo(
          headerRef.current,
          { opacity: 0, y: 35, scale: 0.94, filter: 'blur(10px)' },
          { opacity: 1, y: 0, scale: 1.0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.16 },
          0
        );

        // 2. Pricing cards 3D deployment
        // Left Card (Bistro)
        if (cardRefs.current[0]) {
          tl.fromTo(
            cardRefs.current[0],
            { x: -70, y: 30, scale: 0.92, opacity: 0, filter: 'blur(8px)' },
            { x: 0, y: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
            0.04
          );
        }

        // Center Card (Brasserie - elevated)
        if (cardRefs.current[1]) {
          tl.fromTo(
            cardRefs.current[1],
            { y: 60, scale: 0.94, opacity: 0, filter: 'blur(10px)' },
            { y: 0, scale: 1.02, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
            0.06
          );
        }

        // Right Card (Enterprise)
        if (cardRefs.current[2]) {
          tl.fromTo(
            cardRefs.current[2],
            { x: 70, y: 30, scale: 0.92, opacity: 0, filter: 'blur(8px)' },
            { x: 0, y: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
            0.08
          );
        }

        // 3. Exit camera transition
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

      // MOBILE TIMELINE (Fluid, unpinned vertical flow)
      mm.add('(max-width: 768px)', () => {
        gsap.fromTo(
          headerRef.current,
          { opacity: 0, y: 25 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            scrollTrigger: {
              trigger: headerRef.current,
              start: 'top 85%',
            },
          }
        );

        cardRefs.current.forEach((c) => {
          if (!c) return;
          gsap.fromTo(
            c,
            { opacity: 0, y: 35 },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              scrollTrigger: {
                trigger: c,
                start: 'top 88%',
              },
            }
          );
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative w-full md:h-[100svh] md:min-h-[760px] bg-[#050608] border-t border-white/5 overflow-hidden flex items-center justify-center select-none py-16 md:py-0"
    >
      {/* ========================================================================= */}
      {/* 4K CINEMATIC RESTAURANT VIDEO BACKGROUND (Cash & Digital Payment) */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-cover object-center filter saturate-[1.1] contrast-[1.05]"
          src="/videos/14768199_2160_3840_25fps.mp4"
        />

        {/* Multi-layered cinematic overlays */}
        {/* Layer 1: Dark translucent base veil to preserve high-contrast card readability */}
        <div className="absolute inset-0 bg-[#050608]/75 backdrop-blur-[2px]" />

        {/* Layer 2: Top and bottom gradient vignettes */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050608] via-transparent to-[#050608]" />

        {/* Layer 3: Cyan/teal ambient radial glow (echoing calculator/POS device illumination in video) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_40%,rgba(6,182,212,0.14),transparent_55%)]" />

        {/* Layer 4: Warm amber/orange radial glow (echoing foreground hands/cash and warm lighting) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_65%,rgba(245,158,11,0.13),transparent_55%)]" />
      </div>

      {/* ========================================================================= */}
      {/* MAIN FOREGROUND CONTAINER */}
      {/* ========================================================================= */}
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full will-change-[transform,opacity,filter]"
        style={{ perspective: 1200 }}
      >
        {/* Header */}
        <div ref={headerRef} className="text-center max-w-3xl mx-auto mb-8 lg:mb-10 space-y-3">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0b0d12]/80 border border-amber-400/30 backdrop-blur-md shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-amber-300 uppercase font-semibold">
              TRANSPARENT PRICING
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-display uppercase tracking-tight text-white leading-[1.08]">
            SELECT YOUR{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              DINING PLAN.
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-zinc-300/90 text-sm sm:text-base font-sans max-w-xl mx-auto">
            No hidden setup fees. Upgrade, downgrade, or cancel anytime.
          </p>

          {/* Billing Interval Toggle */}
          <div className="flex items-center justify-center pt-2">
            <div className="bg-[#0b0d12]/90 border border-white/15 p-1 rounded-full flex items-center gap-1 shadow-lg backdrop-blur-xl">
              <button
                onClick={() => setAnnual(false)}
                className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer ${
                  !annual
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                MONTHLY
              </button>

              <button
                onClick={() => setAnnual(true)}
                className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  annual
                    ? 'bg-gradient-to-r from-amber-500/30 to-amber-400/20 text-amber-300 border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>ANNUAL</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-extrabold border border-amber-400/30">
                  SAVE 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3D Glass Cards Grid */}
        <div
          ref={cardsWrapperRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7 items-stretch"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {PRICING_PLANS.map((plan, index) => (
            <div
              key={plan.name}
              ref={(el) => (cardRefs.current[index] = el)}
              className="h-full flex flex-col will-change-[transform,opacity,filter]"
            >
              <PricingCard
                plan={plan}
                index={index}
                annual={annual}
                hoveredIndex={hoveredIndex}
                setHoveredIndex={setHoveredIndex}
                onOpenDemo={onOpenDemo}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
