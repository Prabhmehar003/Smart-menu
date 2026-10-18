import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HOW_IT_WORKS_STEPS } from '../lib/constants';

gsap.registerPlugin(ScrollTrigger);

/**
 * Format step titles with intentional editorial line breaks matching design reference
 */
function formatStepTitle(title) {
  switch (title) {
    case 'Setup Restaurant Profile':
      return 'SETUP\nRESTAURANT\nPROFILE';
    case 'Curate Digital Menu':
      return 'CURATE DIGITAL\nMENU';
    case 'Deploy Table QR Codes':
      return 'DEPLOY TABLE QR\nCODES';
    case 'Instant Guest Dining':
      return 'INSTANT GUEST\nDINING';
    default:
      return title.toUpperCase();
  }
}

/**
 * 3D Interactive Floating Glass Step Card with Cursor-tracked Physics
 */
function StepCard({
  step,
  index,
  hoveredIndex,
  setHoveredIndex,
  cardRefCallback,
}) {
  const localCardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
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

  const handleMouseMove = useCallback(
    (e) => {
      if (reducedMotion || !localCardRef.current) return;
      const rect = localCardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5

      // Subtle, refined physical tilt (max ~3.5 degrees)
      requestAnimationFrame(() => {
        setTilt({
          rotateX: -y * 7.0,
          rotateY: x * 7.0,
        });
      });
    },
    [reducedMotion]
  );

  const handleMouseEnter = () => {
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  // Base resting style
  let transformStyle = 'translate3d(0, 0, 0) scale(1) rotateX(0deg) rotateY(0deg)';
  let zIndex = 10;
  let opacityClass = 'opacity-100';

  if (!reducedMotion) {
    if (isHovered) {
      transformStyle = `translate3d(0, -12px, 24px) scale(1.035) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`;
      zIndex = 30;
    } else if (isOtherHovered) {
      transformStyle = 'translate3d(0, 0, -8px) scale(0.985)';
      zIndex = 5;
      opacityClass = 'opacity-90';
    }
  }

  return (
    <div
      ref={(el) => {
        localCardRef.current = el;
        if (cardRefCallback) cardRefCallback(el);
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 flex flex-col justify-between transition-all duration-500 ease-out cursor-pointer group select-none backdrop-blur-md will-change-[transform,opacity,filter] ${opacityClass}`}
      style={{
        transform: transformStyle,
        zIndex,
        background: isHovered
          ? 'linear-gradient(145deg, rgba(18, 22, 32, 0.88) 0%, rgba(12, 14, 22, 0.82) 100%)'
          : 'linear-gradient(145deg, rgba(11, 13, 19, 0.78) 0%, rgba(8, 9, 14, 0.72) 100%)',
        borderColor: isHovered ? 'rgba(245, 158, 11, 0.55)' : 'rgba(255, 255, 255, 0.10)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderTopColor: isHovered ? 'rgba(251, 191, 36, 0.75)' : 'rgba(255, 255, 255, 0.20)',
        boxShadow: isHovered
          ? '0 30px 65px -12px rgba(0, 0, 0, 0.95), 0 0 35px rgba(245, 158, 11, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.15)'
          : '0 20px 45px -10px rgba(0, 0, 0, 0.85), inset 0 1px 1px rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Localized radial darkening & amber aura behind the active card */}
      <div
        className={`absolute -inset-3 rounded-[32px] -z-10 transition-opacity duration-500 pointer-events-none ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(circle at center, rgba(245, 158, 11, 0.12) 0%, rgba(0, 0, 0, 0.55) 60%, transparent 80%)',
          filter: 'blur(16px)',
        }}
      />

      {/* Top Content: Step Number & Title */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <span
            className={`text-4xl sm:text-5xl font-extrabold font-mono transition-all duration-300 tracking-tight block ${
              isHovered
                ? 'text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-105'
                : 'text-amber-400/80 group-hover:text-amber-300'
            }`}
          >
            {step.step}
          </span>
          <span
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isHovered
                ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b] scale-125'
                : 'bg-white/20 group-hover:bg-amber-400/60'
            }`}
          />
        </div>

        <h3 className="text-lg sm:text-xl font-bold font-display uppercase tracking-wide text-white mb-3 leading-snug whitespace-pre-line drop-shadow-sm">
          {formatStepTitle(step.title)}
        </h3>

        <p className="text-zinc-300/80 group-hover:text-zinc-200 text-xs sm:text-sm font-sans leading-relaxed transition-colors duration-300">
          {step.desc}
        </p>
      </div>

      {/* Bottom Milestone Bar */}
      <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-zinc-400 transition-colors duration-300 group-hover:text-zinc-300">
        <span className="tracking-wider">STEP {step.step} OF 04</span>
        <span
          className={`flex items-center gap-1.5 transition-colors duration-300 ${
            isHovered ? 'text-amber-400 font-semibold' : 'text-zinc-500'
          }`}
        >
          <span>READY</span>
          <ArrowRight
            className={`w-3.5 h-3.5 transition-transform duration-300 ${
              isHovered ? 'translate-x-1 text-amber-400' : 'text-zinc-500'
            }`}
          />
        </span>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const stepRefs = useRef([]);
  const videoRef = useRef(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
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

        // 1. Header Focus Pull Reveal
        tl.fromTo(
          headerRef.current,
          { opacity: 0, y: 35, scale: 0.94, filter: 'blur(10px)' },
          { opacity: 1, y: 0, scale: 1.0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.16 },
          0
        );

        // 2. Sequential Step Cards Stagger
        stepRefs.current.forEach((el, index) => {
          if (!el) return;
          tl.fromTo(
            el,
            { y: 40 + index * 10, scale: 0.92, opacity: 0, filter: 'blur(8px)' },
            { y: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
            0.04 + index * 0.03
          );
        });

        // 3. Section Exit Camera Shift
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

      // MOBILE TIMELINE: Fluid Responsive Scroll Reveal Without Viewport Pinning
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

        stepRefs.current.forEach((el, idx) => {
          if (!el) return;
          tl.fromTo(
            el,
            { y: 30, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 0.35 },
            0.1 + idx * 0.08
          );
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative w-full min-h-screen py-16 sm:py-20 lg:py-0 lg:h-[100svh] lg:min-h-[720px] bg-[#05060a] border-t border-white/5 overflow-hidden flex items-center justify-center select-none"
    >
      {/* 1. 4K Cinematic Background Video Layer */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <video
          ref={videoRef}
          src="/videos/3626148-uhd_4096_2160_25fps.mp4"
          muted
          loop
          playsInline
          preload="none"
          onCanPlay={() => setVideoLoaded(true)}
          className="w-full h-full object-cover object-center scale-105 will-change-transform transition-opacity duration-700 ease-out"
          style={{ opacity: videoLoaded ? 0.8 : 0 }}
        >
          <source src="/videos/3626148-uhd_4096_2160_25fps.mp4" type="video/mp4" />
        </video>

        {/* Multi-Layer Translucent Cinematic Overlays */}
        {/* Layer A: Dark Charcoal Translucent Base (preserves cafe atmosphere, laptop screen & coffee) */}
        <div className="absolute inset-0 bg-[#06070a]/55 backdrop-brightness-[0.88]" />

        {/* Layer B: Top and Bottom Seamless Section Vignettes */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#05060a] via-transparent to-[#05060a] opacity-90" />

        {/* Layer C: Center Radial Contrast Vignette for Razor-Sharp Typography & Cards */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(5,6,10,0.70)_100%)]" />

        {/* Layer D: Subtle Warm Amber Atmospheric Glow Matching Cafe Lighting */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[360px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      </div>

      {/* 2. Interactive Foreground UI Container */}
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full will-change-[transform,opacity,filter]"
      >
        {/* Section Header */}
        <div ref={headerRef} className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 lg:mb-14 space-y-3">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-mono tracking-widest uppercase shadow-sm shadow-amber-500/20 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>EFFORTLESS IMPLEMENTATION</span>
          </div>

          {/* Main Heading with Signature Amber Accent */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold font-display uppercase tracking-tight text-white leading-tight drop-shadow-md">
            <span>FOUR SIMPLE STEPS TO </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.25)]">
              DIGITAL DINING.
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-zinc-300 text-xs sm:text-sm md:text-base font-sans max-w-2xl mx-auto leading-relaxed drop-shadow">
            From setup to live table ordering in under 15 minutes. No hardware installations required.
          </p>
        </div>

        {/* Four Floating 3D Glass Cards */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative"
          style={{ perspective: '1200px' }}
        >
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <StepCard
              key={step.step}
              step={step}
              index={index}
              hoveredIndex={hoveredIndex}
              setHoveredIndex={setHoveredIndex}
              cardRefCallback={(el) => (stepRefs.current[index] = el)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
