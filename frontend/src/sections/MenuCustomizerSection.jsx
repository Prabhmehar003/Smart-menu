import React, { useState, useRef, useEffect } from 'react';
import { Palette, RefreshCw } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MENU_ITEMS } from '../lib/constants';

gsap.registerPlugin(ScrollTrigger);

export default function MenuCustomizerSection() {
  const [items, setItems] = useState(MENU_ITEMS);
  const [theme, setTheme] = useState('amber');

  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const leftColRef = useRef(null);
  const rightColRef = useRef(null);

  const themeColors = {
    amber: { bg: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-400/40', accent: 'text-amber-400', btn: 'bg-amber-400 text-black' },
    emerald: { bg: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-400/40', accent: 'text-emerald-400', btn: 'bg-emerald-400 text-black' },
    rose: { bg: 'from-rose-500/20 to-rose-600/10', border: 'border-rose-400/40', accent: 'text-rose-400', btn: 'bg-rose-400 text-black' },
  };

  const activeTheme = themeColors[theme];

  const handlePriceChange = (id, newPrice) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, price: `$${newPrice}` } : item)));
  };

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

        // 2. Dashboard docks in from left
        tl.fromTo(
          leftColRef.current,
          { x: -80, opacity: 0, filter: 'blur(8px)' },
          { x: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
          0.04
        );

        // 3. Live mobile mockup docks in from right with 3D tilt
        tl.fromTo(
          rightColRef.current,
          { x: 80, scale: 0.9, opacity: 0, filter: 'blur(10px)' },
          { x: 0, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
          0.06
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
        tl.fromTo(leftColRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.35 }, 0.1);
        tl.fromTo(rightColRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.35 }, 0.15);
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="customizer"
      className="relative w-full h-[100svh] min-h-[760px] bg-[#050608] border-t border-white/5 overflow-hidden flex items-center justify-center select-none"
    >
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-6 relative z-10 w-full will-change-[transform,opacity,filter]"
      >
        {/* Header */}
        <div ref={headerRef} className="text-center max-w-3xl mx-auto mb-10 lg:mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase">
            <Palette className="w-3.5 h-3.5" />
            <span>INTERACTIVE BUILDER DEMO</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold font-display uppercase tracking-tight text-white leading-tight">
            TRY THE LIVE <span className="text-amber-400">MENU BUILDER</span>.
          </h2>
          <p className="text-zinc-400 text-sm md:text-base font-sans">
            Adjust prices, toggle themes, or add dietary tags below. See how changes sync instantly to your guest's screen.
          </p>
        </div>

        {/* Builder Playground Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* Controls Column (Left 6) */}
          <div
            ref={leftColRef}
            className="lg:col-span-6 p-6 sm:p-7 rounded-3xl bg-[#0a0b12] border border-white/10 space-y-5 shadow-2xl shadow-black/80 will-change-[transform,opacity,filter]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <h3 className="text-base font-bold font-display uppercase text-white">Menu Editor Dashboard</h3>
              <div className="flex items-center gap-2">
                {['amber', 'emerald', 'rose'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    aria-label={`Select ${t} theme`}
                    className={`w-6 h-6 rounded-full border-2 capitalize text-[9px] font-mono flex items-center justify-center transition-all cursor-pointer ${
                      theme === t ? 'border-white scale-110' : 'border-transparent opacity-60'
                    } ${t === 'amber' ? 'bg-amber-400' : t === 'emerald' ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  />
                ))}
              </div>
            </div>

            {/* Editable Items */}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <img src={item.image} alt={item.name} className="w-11 h-11 rounded-lg object-cover" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold font-display text-white">{item.name}</h4>
                      <span className="text-[11px] font-mono text-zinc-400">{item.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      defaultValue={parseFloat(item.price.replace('$', ''))}
                      onChange={(e) => handlePriceChange(item.id, e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-black/60 border border-white/20 text-xs font-mono text-amber-400 text-right font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Real-time WebSocket Sync active (0ms delay)</span>
            </div>
          </div>

          {/* Live Mobile View (Right 6) */}
          <div ref={rightColRef} className="lg:col-span-6 flex justify-center will-change-[transform,opacity,filter]">
            <div className={`w-[320px] sm:w-[340px] p-5 sm:p-6 rounded-[38px] bg-gradient-to-b ${activeTheme.bg} border-2 ${activeTheme.border} shadow-2xl shadow-black/90 space-y-3.5 relative`}>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-bold font-display uppercase text-white">LIVE GUEST VIEW</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${activeTheme.btn}`}>
                  Active
                </span>
              </div>

              {/* Items List in Guest View */}
              <div className="space-y-2.5">
                {items.map((item) => (
                  <div key={item.id} className="p-2.5 rounded-2xl bg-black/60 border border-white/10 flex items-center gap-3">
                    <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold font-display text-white truncate">{item.name}</h5>
                        <span className={`text-xs font-mono font-bold ${activeTheme.accent}`}>{item.price}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-1 font-sans mt-0.5">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
