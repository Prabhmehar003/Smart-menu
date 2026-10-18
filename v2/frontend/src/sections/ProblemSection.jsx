import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Printer, AlertTriangle, Globe, ArrowDownRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PROBLEM_POINTS } from '../lib/constants';

gsap.registerPlugin(ScrollTrigger);

/**
 * 3D Interactive Floating Glass Card with Cursor-tracked Physics
 */
function ProblemCard({
  point,
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

  // Base spatial depth variation between the 3 cards (Card 02 has slight depth offset)
  const defaultTranslateZ = index === 1 ? -8 : 0;
  const defaultTranslateY = index === 1 ? 6 : 0;

  const handleMouseMove = useCallback(
    (e) => {
      if (reducedMotion || !localCardRef.current) return;
      const rect = localCardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5

      // Restrained, realistic physical tilt (max ~7 degrees)
      requestAnimationFrame(() => {
        setTilt({
          rotateX: -y * 8.5,
          rotateY: x * 8.5,
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

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'Printer':
        return <Printer className="w-5 h-5 text-amber-400" />;
      case 'AlertTriangle':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'Globe':
        return <Globe className="w-5 h-5 text-amber-400" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    }
  };

  // Dynamic 3D transform computation
  const transformStyle = isHovered && !reducedMotion
    ? `translate3d(0px, -10px, 24px) scale(1.03) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
    : isOtherHovered
    ? `translate3d(0px, ${defaultTranslateY}px, ${defaultTranslateZ - 6}px) scale(0.985) rotateX(0deg) rotateY(0deg)`
    : `translate3d(0px, ${defaultTranslateY}px, ${defaultTranslateZ}px) scale(1) rotateX(0deg) rotateY(0deg)`;

  return (
    <div
      ref={(el) => {
        localCardRef.current = el;
        if (cardRefCallback) cardRefCallback(el);
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 lg:p-8 flex flex-col justify-between cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity,filter,box-shadow] select-none ${
        isHovered ? 'z-30' : 'z-10'
      }`}
      style={{
        transform: transformStyle,
        opacity: isOtherHovered ? 0.90 : 1.0,
        backgroundColor: isHovered ? 'rgba(10, 12, 18, 0.88)' : 'rgba(8, 9, 14, 0.72)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: isHovered ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isHovered
          ? '0 32px 70px -10px rgba(0, 0, 0, 0.95), 0 0 40px rgba(245, 158, 11, 0.16), inset 0 1px 1px rgba(255, 255, 255, 0.25), inset 0 0 20px rgba(245, 158, 11, 0.04)'
          : '0 20px 50px -10px rgba(0, 0, 0, 0.85), inset 0 1px 1px rgba(255, 255, 255, 0.12)',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Localized radial darkening & warm glow behind the card on hover */}
      <div
        className="absolute -inset-8 rounded-[40px] pointer-events-none transition-opacity duration-400 ease-out"
        style={{
          background: 'radial-gradient(circle, rgba(0, 0, 0, 0.85) 0%, rgba(245, 158, 11, 0.08) 50%, transparent 75%)',
          filter: 'blur(30px)',
          opacity: isHovered ? 1 : 0,
          zIndex: -1,
        }}
      />

      {/* Internal warm rim light highlight along card top border */}
      <div
        className="absolute top-0 left-8 right-8 h-[1px] pointer-events-none transition-opacity duration-300"
        style={{
          background: isHovered
            ? 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.9) 50%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
          opacity: isHovered ? 1 : 0.6,
        }}
      />

      {/* Card Content Area */}
      <div>
        {/* Subtle glass icon container with light amber glow */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300"
          style={{
            backgroundColor: isHovered ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.10)',
            border: isHovered ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(245, 158, 11, 0.20)',
            boxShadow: isHovered ? '0 0 20px rgba(245, 158, 11, 0.30)' : 'none',
            transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
          }}
        >
          {getIcon(point.icon)}
        </div>

        {/* Card Title */}
        <h3 className="text-lg lg:text-xl font-bold font-display uppercase tracking-wide text-white mb-3 flex items-center justify-between">
          <span className={`transition-colors duration-200 ${isHovered ? 'text-amber-300' : 'text-white'}`}>
            {point.title}
          </span>
          <ArrowDownRight
            className={`w-5 h-5 transition-transform duration-300 ${
              isHovered ? 'text-amber-400 translate-x-0.5 translate-y-0.5' : 'text-zinc-500'
            }`}
          />
        </h3>

        {/* Card Description */}
        <p className="text-zinc-300/90 text-xs sm:text-sm font-sans leading-relaxed">
          {point.description}
        </p>
      </div>

      {/* Card Footer Bar */}
      <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
        <span className="text-zinc-400">PROBLEM 0{index + 1}</span>
        <span className={`font-bold tracking-wider transition-colors duration-200 ${isHovered ? 'text-amber-300' : 'text-amber-400/90'}`}>
          SMART MENU REPLACEMENT
        </span>
      </div>
    </div>
  );
}

export default function ProblemSection() {
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const badgeRef = useRef(null);
  const headlineRef = useRef(null);
  const subtextRef = useRef(null);
  const cardRefs = useRef([]);
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

  // GSAP Pinned ScrollTrigger Scroll Reveal
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

        // 1. Header Typography Camera-Focus Reveal (Badge, Headline, Subtitle)
        tl.fromTo(
          badgeRef.current,
          { opacity: 0, y: -12, filter: 'blur(6px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.14 },
          0.02
        );

        tl.fromTo(
          headlineRef.current,
          { opacity: 0, y: 30, scale: 0.95, filter: 'blur(8px)', letterSpacing: '0.03em' },
          { opacity: 1, y: 0, scale: 1.0, filter: 'blur(0px)', letterSpacing: 'normal', ease: 'power2.out', duration: 0.16 },
          0.04
        );

        tl.fromTo(
          subtextRef.current,
          { opacity: 0, y: 18, filter: 'blur(6px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.16 },
          0.06
        );

        // 2. Sequential card entrance with ~120ms staggered curves:
        // Card 01 -> Card 02 -> Card 03
        cardRefs.current.forEach((card, idx) => {
          if (!card) return;
          tl.fromTo(
            card,
            { opacity: 0, y: 28, scale: 0.97, filter: 'blur(6px)' },
            { opacity: 1, y: 0, scale: 1.0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
            0.06 + idx * 0.04
          );
        });

        // 3. Main Reading Window: cards remain stable and fully interactive
        // 4. Exit transition: smooth camera focus pull to hand off to next section
        tl.to(
          containerRef.current,
          {
            scale: 0.95,
            filter: 'blur(10px)',
            opacity: 0.25,
            ease: 'power2.in',
            duration: 0.15,
          },
          0.85
        );
      });

      // MOBILE TIMELINE (Responsive & Touch Friendly, fluid scroll without pinning)
      mm.add('(max-width: 768px)', () => {
        if (headlineRef.current) {
          gsap.fromTo(
            headlineRef.current,
            { opacity: 0, y: 20 },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              scrollTrigger: {
                trigger: headlineRef.current,
                start: 'top 85%',
              },
            }
          );
        }

        cardRefs.current.forEach((card) => {
          if (!card) return;
          gsap.fromTo(
            card,
            { y: 24, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.5,
              scrollTrigger: {
                trigger: card,
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
      id="problem"
      className="relative w-full min-h-screen py-16 sm:py-20 lg:py-0 lg:h-[100svh] lg:min-h-[740px] overflow-hidden flex items-center justify-center select-none bg-[#050508]"
    >
      {/* =======================================================
          1. CINEMATIC BACKGROUND VIDEO
          Full-width, autoplay, muted, loop, object-cover
         ======================================================= */}
      <video
        ref={videoRef}
        src="/videos/9698565-hd_1920_1080_24fps.mp4"
        loop
        muted
        playsInline
        preload="none"
        onCanPlay={() => setVideoLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none z-0 transition-opacity duration-700 ease-out"
        style={{
          opacity: videoLoaded ? 1 : 0,
          filter: 'contrast(1.05) saturate(1.04) brightness(0.96)',
        }}
      />

      {/* =======================================================
          2. CINEMATIC OVERLAY LAYER SYSTEM
          Preserves recognizable table, plate, floral napkin, paper menu
         ======================================================= */}
      {/* 2a: Dark translucent charcoal overlay */}
      <div className="absolute inset-0 bg-[#06070a]/55 pointer-events-none z-[1]" />

      {/* 2b: Top and Bottom gradient vignettes to seamlessly blend into sections above & below */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050508] via-transparent to-[#05060a] pointer-events-none z-[2]" />

      {/* 2c: Soft warm ambient restaurant light accent glow (inspired by video highlights) */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[650px] h-[450px] rounded-full pointer-events-none z-[2]"
        style={{
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, rgba(244, 63, 94, 0.03) 45%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />

      {/* =======================================================
          3. MAIN CONTENT CONTAINER & 3D FLOATING CARDS
         ======================================================= */}
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full will-change-[transform,opacity,filter]"
      >
        {/* Section Header */}
        <div className="max-w-3xl mb-10 lg:mb-12 space-y-3">
          {/* Badge with subtle coral / warm highlight */}
          <div
            ref={badgeRef}
            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono tracking-widest uppercase shadow-sm shadow-rose-500/10 will-change-[transform,opacity,filter]"
          >
            <span>THE TRADITIONAL FRICTION</span>
          </div>

          <h2
            ref={headlineRef}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display uppercase tracking-tight text-white leading-tight will-change-[transform,opacity,filter]"
          >
            PAPER MENUS ARE BREAKING YOUR <span className="text-amber-400">DINING ROOM</span>.
          </h2>

          <p
            ref={subtextRef}
            className="text-zinc-300 text-sm sm:text-base md:text-lg font-sans leading-relaxed will-change-[transform,opacity,filter]"
          >
            Static paper menus cost money, slow down orders, cause dietary confusion, and fail to reflect real-time kitchen availability.
          </p>
        </div>

        {/* 3 Problem Cards Grid with 3D Depth & Perspective */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch"
          style={{ perspective: '1400px' }}
        >
          {PROBLEM_POINTS.map((point, index) => (
            <ProblemCard
              key={point.title}
              point={point}
              index={index}
              hoveredIndex={hoveredIndex}
              setHoveredIndex={setHoveredIndex}
              cardRefCallback={(el) => (cardRefs.current[index] = el)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
