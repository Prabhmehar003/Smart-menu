import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, XCircle, Sparkles, Zap, ChevronRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * 3D Interactive Plan Card matching Signup Page layout & styling
 */
function PlanCard({
  plan,
  index,
  annual,
  isSelected,
  onSelect,
  onNavigate,
  hoveredIndex,
  setHoveredIndex,
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
  const isPro = plan.key === 'pro';

  const handleMouseMove = useCallback(
    (e) => {
      if (reducedMotion || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
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

  const baseTranslateZ = isPro ? 12 : 0;
  const baseScale = isPro ? 1.015 : 1.0;

  const transformStyle = isHovered && !reducedMotion
    ? `translate3d(0px, -10px, ${baseTranslateZ + 32}px) scale(${baseScale * 1.02}) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
    : isOtherHovered
    ? `translate3d(0px, 0px, ${baseTranslateZ - 8}px) scale(${baseScale * 0.985}) rotateX(0deg) rotateY(0deg)`
    : `translate3d(0px, 0px, ${baseTranslateZ}px) scale(${baseScale}) rotateX(0deg) rotateY(0deg)`;

  const price = annual ? plan.priceAnnual : plan.priceMonthly;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onSelect}
      className={`relative rounded-3xl p-6 sm:p-7 lg:p-8 flex flex-col justify-between transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity,filter,box-shadow] select-none cursor-pointer border-2 ${
        isPro
          ? isSelected
            ? 'border-lime-400 bg-lime-950/20 shadow-[0_16px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(163,230,53,0.18)] z-20'
            : 'border-neutral-800 bg-[#0b0d12]/85 backdrop-blur-xl hover:border-lime-400/50 shadow-[0_12px_36px_rgba(0,0,0,0.65)] z-10'
          : isSelected
          ? 'border-neutral-200 bg-neutral-900/90 shadow-[0_16px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(255,255,255,0.08)] z-20'
          : 'border-neutral-800 bg-[#0b0d12]/85 backdrop-blur-xl hover:border-neutral-700 shadow-[0_12px_36px_rgba(0,0,0,0.65)] z-10'
      }`}
      style={{
        transform: transformStyle,
        opacity: isOtherHovered ? 0.9 : 1.0,
        filter: isOtherHovered ? 'blur(0.3px)' : 'none',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Specular sheen on hover */}
      {isHovered && !reducedMotion && (
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none opacity-40 transition-opacity duration-200"
          style={{
            background: isPro
              ? `radial-gradient(circle 240px at ${tilt.shineX}% ${tilt.shineY}%, rgba(163, 230, 53, 0.22), transparent 70%)`
              : `radial-gradient(circle 240px at ${tilt.shineX}% ${tilt.shineY}%, rgba(255, 255, 255, 0.16), transparent 70%)`,
          }}
        />
      )}

      {/* Recommended Ribbon on Pro Plan */}
      {isPro && (
        <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-lime-400 via-emerald-400 to-lime-300 text-black text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-[0_4px_16px_rgba(163,230,53,0.35)] flex items-center gap-1 font-mono tracking-widest">
          <Sparkles className="w-3 h-3 text-black fill-black" />
          <span>RECOMMENDED</span>
        </div>
      )}

      {/* Card Content Top */}
      <div>
        {/* Title, Badge & Radio Indicator */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-sans">
              {plan.name}
            </span>
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                isPro
                  ? 'bg-lime-400/20 text-lime-400 border-lime-400/40'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700'
              }`}
            >
              {plan.badge}
            </span>
          </div>

          {/* Selection Radio Circle */}
          <div
            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? isPro
                  ? 'border-lime-400 bg-lime-400 text-black'
                  : 'border-white bg-white text-black'
                : 'border-neutral-600'
            }`}
          >
            {isSelected && <div className="h-2 w-2 rounded-full bg-black" />}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-[13px] mb-4 text-neutral-300 font-sans leading-relaxed min-h-[44px]">
          {plan.description}
        </p>

        {/* Pricing Figure */}
        <div className="pt-2 pb-3 mb-4 border-b border-white/10">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                isPro
                  ? 'bg-gradient-to-r from-lime-200 via-white to-lime-300 bg-clip-text text-transparent'
                  : 'text-white'
              }`}
            >
              {price}
            </span>
            <span className="text-xs font-mono text-zinc-400">/ month</span>
          </div>
          {annual && (
            <p
              className={`text-[11px] font-mono mt-1 flex items-center gap-1 ${
                isPro ? 'text-lime-400' : 'text-amber-400'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Billed annually (Save 20%)</span>
            </p>
          )}
        </div>

        {/* Feature List */}
        <div className="space-y-2.5 border-t border-neutral-800/80 pt-3.5 text-xs font-sans">
          {plan.features.map((feat, fIdx) => (
            <div
              key={fIdx}
              className={`flex items-center gap-2.5 ${
                feat.enabled
                  ? feat.highlight === 'lime'
                    ? 'text-lime-300 font-semibold'
                    : 'text-white'
                  : 'text-neutral-500 line-through'
              }`}
            >
              {feat.enabled ? (
                isPro ? (
                  <CheckCircle2 className="w-4 h-4 text-lime-400 flex-shrink-0" />
                ) : (
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                )
              ) : (
                <XCircle className="w-4 h-4 text-neutral-600 flex-shrink-0" />
              )}
              <span>{feat.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA & Selection Status */}
      <div className="mt-7 pt-4 border-t border-neutral-800/80 space-y-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(plan.key);
          }}
          className={`w-full py-3.5 px-4 rounded-2xl font-mono font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            isPro
              ? 'bg-gradient-to-r from-lime-400 via-emerald-400 to-lime-300 text-black shadow-[0_4px_22px_rgba(163,230,53,0.35)] hover:shadow-[0_4px_30px_rgba(163,230,53,0.5)] hover:scale-[1.01] active:scale-[0.98]'
              : 'bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-white/40 active:scale-[0.98]'
          }`}
        >
          <span>{plan.cta}</span>
          <ChevronRight className={`w-3.5 h-3.5 ${isPro ? 'text-black' : 'text-zinc-400'}`} />
        </button>

        <div className="text-center">
          <span
            className={`text-[11px] font-mono font-semibold ${
              isSelected
                ? isPro
                  ? 'text-lime-400'
                  : 'text-white'
                : 'text-neutral-500'
            }`}
          >
            {isSelected
              ? isPro
                ? '✓ Selected Pro Plan'
                : '● Selected Basic Plan'
              : `Click to select ${plan.name}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PricingSection({ onOpenDemo }) {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const cardsWrapperRef = useRef(null);
  const cardRefs = useRef([]);
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Play/pause and lazy load video via IntersectionObserver
  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    video.muted = true;
    video.defaultMuted = true;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {});
            }
          } else {
            video.pause();
          }
        });
      },
      { rootMargin: '300px 0px', threshold: 0.01 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const handleNavigate = (planKey) => {
    navigate(`/signup?plan=${planKey}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const PLANS = [
    {
      key: 'basic',
      name: 'Basic',
      badge: 'Digital Menu',
      priceAnnual: '$39',
      priceMonthly: '$49',
      description:
        'Only digital menu provided for your restaurant. Diners scan table QR codes to view dishes and prices on their mobile devices.',
      features: [
        { text: 'Dynamic Table QR Cards', enabled: true },
        { text: 'HD Digital Menu Showcase', enabled: true },
        { text: 'Dish Descriptions & Dietary Tags', enabled: true },
        { text: 'Direct Food Ordering Disabled', enabled: false },
      ],
      cta: 'Start Basic Plan',
    },
    {
      key: 'pro',
      name: 'Pro Plan',
      badge: 'Menu + Ordering',
      priceAnnual: '$79',
      priceMonthly: '$99',
      description: (
        <>
          Digital menu <strong className="text-lime-400">PLUS interactive food ordering</strong>. Customers can view the menu AND place orders directly from their tables.
        </>
      ),
      features: [
        { text: 'Everything in Basic Plan', enabled: true },
        { text: 'Food Ordering Feature Enabled', enabled: true, highlight: 'lime' },
        { text: 'Live Table Cart & Custom Dish Notes', enabled: true },
        { text: 'Real-Time Kitchen Orders Dashboard', enabled: true },
        { text: 'Instant Digital Invoices & Receipts', enabled: true },
      ],
      cta: 'Start Pro Plan',
    },
  ];

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

        // 2. Left Card (Basic)
        if (cardRefs.current[0]) {
          tl.fromTo(
            cardRefs.current[0],
            { x: -50, y: 30, scale: 0.94, opacity: 0, filter: 'blur(8px)' },
            { x: 0, y: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
            0.04
          );
        }

        // 3. Right Card (Pro Plan)
        if (cardRefs.current[1]) {
          tl.fromTo(
            cardRefs.current[1],
            { x: 50, y: 30, scale: 0.94, opacity: 0, filter: 'blur(8px)' },
            { x: 0, y: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
            0.06
          );
        }

        // 4. Exit camera transition
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
      {/* 4K CINEMATIC RESTAURANT VIDEO BACKGROUND */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          ref={videoRef}
          loop
          muted
          playsInline
          preload="none"
          onCanPlay={() => setVideoLoaded(true)}
          className="w-full h-full object-cover object-center filter saturate-[1.1] contrast-[1.05] transition-opacity duration-700 ease-out"
          style={{ opacity: videoLoaded ? 1 : 0 }}
          src="/videos/14768199_2160_3840_25fps.mp4"
        />

        {/* Multi-layered cinematic overlays */}
        <div className="absolute inset-0 bg-[#050608]/75 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050608] via-transparent to-[#050608]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_40%,rgba(6,182,212,0.14),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_65%,rgba(163,230,53,0.12),transparent_55%)]" />
      </div>

      {/* MAIN FOREGROUND CONTAINER */}
      <div
        ref={containerRef}
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full will-change-[transform,opacity,filter]"
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

        {/* 2-Card Layout matching Signup Page (Basic & Pro Plan) */}
        <div
          ref={cardsWrapperRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto items-stretch"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {PLANS.map((plan, index) => (
            <div
              key={plan.key}
              ref={(el) => (cardRefs.current[index] = el)}
              className="h-full flex flex-col will-change-[transform,opacity,filter]"
            >
              <PlanCard
                plan={plan}
                index={index}
                annual={annual}
                isSelected={selectedPlan === plan.key}
                onSelect={() => setSelectedPlan(plan.key)}
                onNavigate={handleNavigate}
                hoveredIndex={hoveredIndex}
                setHoveredIndex={setHoveredIndex}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
