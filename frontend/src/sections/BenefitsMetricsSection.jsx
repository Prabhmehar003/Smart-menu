import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, Calculator } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { METRICS } from '../lib/constants';

gsap.registerPlugin(ScrollTrigger);

export default function BenefitsMetricsSection() {
  const [tables, setTables] = useState(25);
  const [avgCheck, setAvgCheck] = useState(45);

  const currentMonthlyRevenue = tables * 3 * 30 * avgCheck;
  const calculatedIncrease = currentMonthlyRevenue * 0.28;

  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const metricCardRefs = useRef([]);
  const calculatorCardRef = useRef(null);

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

        // 2. Metrics Cards enter with spatial depth stagger
        metricCardRefs.current.forEach((card, index) => {
          if (!card) return;
          tl.fromTo(
            card,
            { y: 50, scale: 0.88, opacity: 0, filter: 'blur(8px)' },
            { y: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
            0.04 + index * 0.03
          );
        });

        // 3. Calculator Card glides into center view
        tl.fromTo(
          calculatorCardRef.current,
          { y: 60, scale: 0.92, opacity: 0, filter: 'blur(10px)' },
          { y: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.2 },
          0.08
        );

        // 4. Exit camera blur
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

      // MOBILE TIMELINE
      mm.add('(max-width: 768px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: '+=120%',
            pin: true,
            scrub: 0.8,
          },
        });

        tl.fromTo(headerRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 }, 0);
        metricCardRefs.current.forEach((c, i) => {
          if (!c) return;
          tl.fromTo(c, { y: 25, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 }, 0.08 + i * 0.05);
        });
        tl.fromTo(calculatorCardRef.current, { y: 25, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 }, 0.2);
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="benefits"
      className="relative w-full h-[100svh] min-h-[760px] bg-[#050608] border-t border-white/5 overflow-hidden flex items-center justify-center select-none"
    >
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-6 relative z-10 w-full will-change-[transform,opacity,filter]"
      >
        {/* Header */}
        <div ref={headerRef} className="text-center max-w-3xl mx-auto mb-8 lg:mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>MEASURABLE RESTAURANT ROI</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold font-display uppercase tracking-tight text-white leading-tight">
            PROVEN IMPACT ON YOUR <span className="text-amber-400">BOTTOM LINE</span>.
          </h2>
          <p className="text-zinc-400 text-sm md:text-base font-sans">
            Fine dining venues using Smart Menu see faster table turnaround, higher ticket averages, and zero reprinting overhead.
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8 lg:mb-10">
          {METRICS.map((metric, i) => (
            <div
              key={metric.label}
              ref={(el) => (metricCardRefs.current[i] = el)}
              className="p-5 sm:p-6 lg:p-7 rounded-3xl bg-[#0a0b12] border border-white/10 text-center hover:border-amber-500/30 transition-all shadow-xl will-change-[transform,opacity,filter]"
            >
              <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400 mb-1.5">
                {metric.value}
              </div>
              <div className="text-[11px] sm:text-xs font-mono text-zinc-400 uppercase tracking-wider">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Interactive ROI Calculator Card */}
        <div
          ref={calculatorCardRef}
          className="p-6 sm:p-8 lg:p-10 rounded-3xl bg-gradient-to-br from-[#0c0e17] via-[#08090f] to-[#0c0e17] border border-amber-500/30 shadow-2xl shadow-black/90 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-center will-change-[transform,opacity,filter]"
        >
          <div className="md:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase">
              <Calculator className="w-4 h-4" />
              <span>RESTAURANT ROI CALCULATOR</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold font-display uppercase text-white">Calculate Your Monthly Revenue Growth</h3>

            {/* Slider 1 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Number of Dining Tables:</span>
                <span className="text-amber-400 font-bold">{tables} Tables</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={tables}
                onChange={(e) => setTables(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Slider 2 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Average Check per Table:</span>
                <span className="text-amber-400 font-bold">${avgCheck}</span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                step="5"
                value={avgCheck}
                onChange={(e) => setAvgCheck(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="md:col-span-5 p-5 sm:p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2.5">
            <span className="text-xs font-mono text-amber-300 uppercase tracking-widest block font-semibold">
              ESTIMATED MONTHLY GAIN
            </span>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-mono text-amber-400">
              +${Math.round(calculatedIncrease).toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Based on +28% average ticket size increase from high-res 3D dish previews.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
