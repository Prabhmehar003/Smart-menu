import React, { useRef, useEffect } from 'react';
import { ArrowRight, Sparkles, UtensilsCrossed } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function FinalCTASection({ onOpenDemo }) {
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const iconRef = useRef(null);
  const headlineRef = useRef(null);
  const ctaBtnRef = useRef(null);
  const bloomHaloRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // DESKTOP PINNED CINEMATIC TIMELINE
      mm.add('(min-width: 769px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: '+=150%',
            pin: true,
            scrub: 1,
            anticipatePin: 1,
          },
        });

        // 1. Golden Radial Bloom Backdrop
        tl.fromTo(
          bloomHaloRef.current,
          { scale: 0.4, opacity: 0 },
          { scale: 3.2, opacity: 0.6, ease: 'power2.out', duration: 0.25 },
          0
        );

        // 2. Icon Container
        tl.fromTo(
          iconRef.current,
          { scale: 0.6, opacity: 0, rotation: -15, filter: 'blur(8px)' },
          { scale: 1.0, opacity: 1, rotation: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.16 },
          0.02
        );

        // 3. Headline Focus Pull
        tl.fromTo(
          headlineRef.current,
          { y: 35, scale: 0.94, opacity: 0, filter: 'blur(10px)' },
          { y: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
          0.04
        );

        // 4. Button entrance
        tl.fromTo(
          ctaBtnRef.current,
          { y: 25, scale: 0.92, opacity: 0 },
          { y: 0, scale: 1.0, opacity: 1, ease: 'power2.out', duration: 0.18 },
          0.08
        );
      });

      // MOBILE TIMELINE: Fluid responsive scroll without pinning
      mm.add('(max-width: 768px)', () => {
        if (headlineRef.current) {
          gsap.fromTo(
            headlineRef.current,
            { y: 20, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.6,
              scrollTrigger: {
                trigger: headlineRef.current,
                start: 'top 85%',
              },
            }
          );
        }
        if (ctaBtnRef.current) {
          gsap.fromTo(
            ctaBtnRef.current,
            { y: 15, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.5,
              scrollTrigger: {
                trigger: ctaBtnRef.current,
                start: 'top 90%',
              },
            }
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-screen py-20 sm:py-24 lg:py-0 lg:h-[100svh] lg:min-h-[640px] bg-[#040407] overflow-hidden border-t border-white/5 flex items-center justify-center select-none"
    >
      {/* Background Radial Bloom */}
      <div
        ref={bloomHaloRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(245, 158, 11, 0.05) 50%, transparent 75%)',
          filter: 'blur(90px)',
        }}
      />

      <div
        ref={containerRef}
        className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center space-y-6 lg:space-y-8 will-change-[transform,opacity,filter]"
      >
        <div
          ref={iconRef}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/20 will-change-[transform,opacity,filter]"
        >
          <UtensilsCrossed className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400" />
        </div>

        <div ref={headlineRef} className="space-y-3 sm:space-y-4 will-change-[transform,opacity,filter]">
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold font-display uppercase tracking-tight text-white leading-tight">
            READY TO REIMAGINE YOUR <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">
              RESTAURANT EXPERIENCE?
            </span>
          </h2>

          <p className="text-zinc-300 font-sans text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Join leading fine dining venues using Smart Menu to elevate guest dining, increase average order value, and streamline service.
          </p>
        </div>

        <div ref={ctaBtnRef} className="pt-2 flex flex-wrap justify-center items-center gap-4 will-change-[transform,opacity,filter]">
          <button
            onClick={onOpenDemo}
            className="w-full sm:w-auto justify-center px-8 sm:px-11 py-4 sm:py-5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-mono font-bold text-sm uppercase tracking-wider shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 active:scale-98 transition-all flex items-center gap-3 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-black" />
            <span>BUILD YOUR MENU NOW</span>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
    </section>
  );
}
