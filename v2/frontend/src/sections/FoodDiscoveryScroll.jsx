import React, { useRef, useEffect } from 'react';
import { ArrowUpRight, Flame, Star, Sparkles, Wine, Utensils } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const DISHES = [
  {
    name: 'Truffle Tagliolini',
    category: 'Signature pasta',
    price: '$24.50',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1000&q=85',
    tag: 'Winter Black Truffle',
  },
  {
    name: 'Citrus Burrata',
    category: 'Seasonal starter',
    price: '$18.90',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1000&q=85',
    tag: 'Puglia Burrata',
  },
  {
    name: 'Fire-Grilled Salmon',
    category: 'Chef’s selection',
    price: '$29.00',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1000&q=85',
    tag: 'Wild Alaskan',
  },
  {
    name: 'Dark Chocolate Torte',
    category: 'Dessert course',
    price: '$12.00',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1000&q=85',
    tag: '72% Valrhona',
  },
];

export default function FoodDiscoveryScroll() {
  const containerRef = useRef(null);
  const sectionContentRef = useRef(null);
  const headingRef = useRef(null);
  const railRef = useRef(null);
  const dishCardRefs = useRef([]);
  const floatingCard1Ref = useRef(null);
  const floatingCard2Ref = useRef(null);
  const progressBarRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // DESKTOP CINEMATIC TIMELINE
      mm.add('(min-width: 769px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top top',
            end: '+=240%',
            pin: true,
            scrub: 1,
            anticipatePin: 1,
          },
        });

        // 1. Quick initial sharpening & emergence from circular portal
        tl.fromTo(
          sectionContentRef.current,
          { opacity: 0.2, filter: 'blur(14px)', scale: 1.08 },
          { opacity: 1, filter: 'blur(0px)', scale: 1.0, ease: 'power2.out', duration: 0.15 },
          0
        );

        // 2. Large branding / text scales from larger state into final position
        tl.fromTo(
          headingRef.current,
          { scale: 1.2, y: 40, filter: 'blur(10px)', opacity: 0 },
          { scale: 1.0, y: 0, filter: 'blur(0px)', opacity: 1, ease: 'power2.out', duration: 0.18 },
          0.02
        );

        // 3. Floating Editorial Photographs / Cards entering from DIFFERENT directions:
        // Dish 1: Enters from top-left with negative rotation
        if (dishCardRefs.current[0]) {
          tl.fromTo(
            dishCardRefs.current[0],
            { x: -140, y: -160, rotation: -9, scale: 0.85, opacity: 0.2, filter: 'blur(8px)' },
            { x: 0, y: 0, rotation: -1.5, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.2 },
            0.04
          );
        }

        // Dish 2: Enters from bottom-left with positive rotation
        if (dishCardRefs.current[1]) {
          tl.fromTo(
            dishCardRefs.current[1],
            { x: -40, y: 180, rotation: 7, scale: 0.88, opacity: 0.2, filter: 'blur(8px)' },
            { x: 0, y: 0, rotation: 1.5, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.2 },
            0.06
          );
        }

        // Dish 3: Enters diagonally from bottom-right
        if (dishCardRefs.current[2]) {
          tl.fromTo(
            dishCardRefs.current[2],
            { x: 150, y: 160, rotation: -6, scale: 0.86, opacity: 0.2, filter: 'blur(8px)' },
            { x: 0, y: 0, rotation: -1, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.2 },
            0.08
          );
        }

        // Dish 4: Enters from top-right, passing partially outside the viewport
        if (dishCardRefs.current[3]) {
          tl.fromTo(
            dishCardRefs.current[3],
            { x: 200, y: -140, rotation: 10, scale: 0.8, opacity: 0.2, filter: 'blur(10px)' },
            { x: 0, y: 0, rotation: 2, scale: 1.0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.2 },
            0.1
          );
        }

        // Floating Spatial Accent Card 1 (Sommelier pairing badge)
        if (floatingCard1Ref.current) {
          tl.fromTo(
            floatingCard1Ref.current,
            { x: -80, y: -100, rotation: -12, scale: 0.75, opacity: 0 },
            { x: 0, y: 0, rotation: -4, scale: 1, opacity: 0.95, ease: 'power2.out', duration: 0.2 },
            0.06
          );
        }

        // Floating Spatial Accent Card 2 (Chef note badge)
        if (floatingCard2Ref.current) {
          tl.fromTo(
            floatingCard2Ref.current,
            { x: 100, y: 120, rotation: 10, scale: 0.75, opacity: 0 },
            { x: 0, y: 0, rotation: 3, scale: 1, opacity: 0.95, ease: 'power2.out', duration: 0.2 },
            0.08
          );
        }

        // 4. Horizontal Rail Parallax Track Scrubbing (Crisp traversal across courses)
        tl.to(
          railRef.current,
          {
            xPercent: -56,
            ease: 'none',
            duration: 0.65,
          },
          0.2
        );

        // Continuous progress bar fill
        tl.fromTo(
          progressBarRef.current,
          { scaleX: 0 },
          { scaleX: 1, ease: 'none', duration: 0.65 },
          0.2
        );

        // 5. Section exit preparation: Camera focus recedes into ambient blur for next section
        tl.to(
          sectionContentRef.current,
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

      // MOBILE LIGHTWEIGHT TIMELINE
      mm.add('(max-width: 768px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top top',
            end: '+=140%',
            pin: true,
            scrub: 0.8,
          },
        });

        tl.fromTo(
          sectionContentRef.current,
          { opacity: 0.3, filter: 'blur(6px)' },
          { opacity: 1, filter: 'blur(0px)', duration: 0.15 },
          0
        );

        tl.fromTo(
          headingRef.current,
          { scale: 1.1, y: 25, opacity: 0 },
          { scale: 1.0, y: 0, opacity: 1, duration: 0.18 },
          0.02
        );

        dishCardRefs.current.forEach((card, idx) => {
          if (!card) return;
          const yDir = idx % 2 === 0 ? -20 : 20;
          tl.fromTo(
            card,
            { y: yDir, opacity: 0.3, scale: 0.95 },
            { y: 0, opacity: 1, scale: 1, duration: 0.18 },
            0.04 + idx * 0.03
          );
        });

        tl.to(
          railRef.current,
          {
            xPercent: -64,
            ease: 'none',
            duration: 0.65,
          },
          0.18
        );

        tl.fromTo(
          progressBarRef.current,
          { scaleX: 0 },
          { scaleX: 1, ease: 'none', duration: 0.65 },
          0.18
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      id="food-discovery"
      className="relative w-full h-[100svh] min-h-[620px] sm:min-h-[720px] bg-[#050508] border-y border-white/5 overflow-hidden select-none"
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_45%,rgba(245,158,11,0.12),transparent_35%),linear-gradient(180deg,#050508_0%,#090a0f_100%)] pointer-events-none" />

      {/* Main Section Content Wrapper (Controls blur & scale focus pull) */}
      <div
        ref={sectionContentRef}
        className="relative z-10 w-full h-full flex flex-col justify-center px-4 sm:px-6 will-change-[transform,opacity,filter]"
      >
        {/* Floating Editorial Accent Card A: Sommelier pairing note */}
        <div
          ref={floatingCard1Ref}
          className="hidden xl:flex absolute top-16 right-16 z-30 items-center gap-3 p-3.5 rounded-2xl bg-[#0e111a]/85 border border-amber-400/30 backdrop-blur-xl shadow-2xl shadow-black/80 pointer-events-none"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
            <Wine className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-amber-400 block">SOMMELIER CELLAR</span>
            <span className="text-xs font-bold font-display text-white">Curated Wine Pairings</span>
          </div>
        </div>

        {/* Floating Editorial Accent Card B: Chef's Table note */}
        <div
          ref={floatingCard2Ref}
          className="hidden xl:flex absolute bottom-16 left-12 z-30 items-center gap-3 p-3 rounded-2xl bg-[#0c0d15]/85 border border-white/15 backdrop-blur-xl shadow-2xl pointer-events-none"
        >
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <Utensils className="w-4 h-4 text-zinc-300" />
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 block">HARVEST 2024</span>
            <span className="text-xs font-bold font-display text-zinc-200">100% Farm-To-Table</span>
          </div>
        </div>

        {/* Section Header */}
        <div
          ref={headingRef}
          className="max-w-7xl mx-auto w-full mb-6 sm:mb-8 md:mb-12 will-change-[transform,opacity,filter]"
        >
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 sm:py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-mono tracking-[0.22em] uppercase">
                <Flame className="w-3.5 h-3.5" />
                <span>Curated for your table</span>
              </div>
              <h2 className="mt-3 sm:mt-4 max-w-2xl text-3xl sm:text-5xl md:text-6xl font-extrabold font-display uppercase leading-[0.95] sm:leading-[0.92] tracking-tight text-white">
                A menu worth <span className="text-amber-400">exploring.</span>
              </h2>
            </div>
            <p className="hidden md:block max-w-xs text-right text-sm leading-relaxed text-zinc-400 font-sans">
              Scroll through a living menu experience, designed to make every course feel considered.
            </p>
          </div>
        </div>

        {/* Pinned Floating Editorial Dishes Track */}
        <div
          ref={railRef}
          className="relative flex w-max gap-4 sm:gap-6 md:gap-8 pl-[2vw] sm:pl-[4vw] will-change-transform"
        >
          {DISHES.map((dish, index) => (
            <article
              key={dish.name}
              ref={(el) => (dishCardRefs.current[index] = el)}
              className="group relative w-[min(82vw,360px)] shrink-0 overflow-hidden rounded-[22px] sm:rounded-[30px] border border-white/15 bg-[#0f1118] shadow-2xl shadow-black/80 will-change-[transform,opacity,filter] transition-shadow duration-500 hover:shadow-amber-500/10 hover:border-amber-400/40"
            >
              <div className="relative h-[38vh] sm:h-[46vh] min-h-[250px] sm:min-h-[300px] max-h-[440px] overflow-hidden">
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c12] via-[#0b0c12]/20 to-transparent" />

                {/* Star Badge */}
                <div className="absolute top-4 left-4 sm:top-5 sm:left-5 flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-black/60 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] font-mono font-bold tracking-wider text-amber-300 backdrop-blur-md">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  4.9
                </div>

                {/* Ingredient Tag */}
                <span className="absolute top-4 right-4 sm:top-5 sm:right-5 text-[9px] sm:text-[10px] font-mono text-white/70 bg-black/50 border border-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full backdrop-blur-md">
                  {dish.tag}
                </span>

                {/* Course Number */}
                <span className="absolute right-4 bottom-3 sm:right-5 sm:bottom-4 text-2xl sm:text-3xl font-extrabold font-mono text-white/10 select-none">
                  0{index + 1}
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-semibold">
                  {dish.category}
                </p>
                <div className="mt-1.5 sm:mt-2 flex items-end justify-between gap-3 sm:gap-4">
                  <h3 className="text-lg sm:text-2xl font-bold font-display text-white group-hover:text-amber-300 transition-colors">
                    {dish.name}
                  </h3>
                  <span className="shrink-0 text-lg sm:text-xl font-extrabold font-mono text-amber-400">
                    {dish.price}
                  </span>
                </div>
              </div>

              <div className="absolute right-4 sm:right-5 bottom-20 sm:bottom-24 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </article>
          ))}
        </div>

        {/* Scroll Progress Indicator Bar */}
        <div className="relative mx-auto mt-8 flex w-[min(84vw,620px)] items-center gap-3 text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
          <span>COURSES</span>
          <div className="h-[2px] flex-1 bg-white/10 overflow-hidden rounded-full">
            <div
              ref={progressBarRef}
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 origin-left"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
          <span>SCROLL PROGRESS</span>
        </div>
      </div>
    </section>
  );
}
