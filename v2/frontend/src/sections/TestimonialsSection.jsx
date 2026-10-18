import React, { useRef, useEffect } from 'react';
import { Quote, Star } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function TestimonialsSection() {
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const card1Ref = useRef(null);
  const card2Ref = useRef(null);

  const reviews = [
    {
      quote:
        'Smart Menu transformed how our guests experience our tasting menu. Being able to update wine pairings live during service is invaluable.',
      author: 'Chef Marc Antoine',
      title: 'Executive Chef, L’Etoile (2 Michelin Stars)',
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=300&q=80',
    },
    {
      quote:
        'Our average check size jumped 34% in the first month. Guests love seeing 3D dish presentations right at their table before ordering.',
      author: 'Elena Rostova',
      title: 'General Manager, Villa Riva',
      image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=300&q=80',
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
            end: '+=160%',
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

        // 2. Review 1 sweeps in from left with tilt
        tl.fromTo(
          card1Ref.current,
          { x: -100, rotation: -4, opacity: 0, filter: 'blur(10px)' },
          { x: 0, rotation: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
          0.04
        );

        // 3. Review 2 sweeps in from right with opposing tilt
        tl.fromTo(
          card2Ref.current,
          { x: 100, rotation: 4, opacity: 0, filter: 'blur(10px)' },
          { x: 0, rotation: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
          0.06
        );

        // 4. Subtle parallax drift
        tl.to(card1Ref.current, { y: -12, ease: 'none', duration: 0.65 }, 0.18);
        tl.to(card2Ref.current, { y: 12, ease: 'none', duration: 0.65 }, 0.18);

        // 5. Exit camera blur
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

      // MOBILE TIMELINE: Fluid scroll without pinning
      mm.add('(max-width: 768px)', () => {
        if (headerRef.current) {
          gsap.fromTo(
            headerRef.current,
            { opacity: 0, y: 20 },
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
        }

        [card1Ref.current, card2Ref.current].forEach((card) => {
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
      id="testimonials"
      className="relative w-full min-h-screen py-16 sm:py-20 lg:py-0 lg:h-[100svh] lg:min-h-[720px] bg-[#07080c] border-t border-white/5 overflow-hidden flex items-center justify-center select-none"
    >
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full will-change-[transform,opacity,filter]"
      >
        <div ref={headerRef} className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 lg:mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase">
            <Quote className="w-3.5 h-3.5" />
            <span>FINE DINING TESTIMONIALS</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold font-display uppercase tracking-tight text-white leading-tight">
            TRUSTED BY WORLD-CLASS <span className="text-amber-400">RESTAURATEURS</span>.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
          <div
            ref={card1Ref}
            className="p-5 sm:p-7 lg:p-8 rounded-3xl bg-[#0b0c13] border border-white/10 flex flex-col justify-between space-y-6 shadow-2xl shadow-black/80 will-change-[transform,opacity,filter]"
          >
            <div className="space-y-4">
              <div className="flex gap-1">
                {[...Array(5)].map((_, idx) => (
                  <Star key={idx} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-zinc-300 font-sans text-sm lg:text-base italic leading-relaxed">
                "{reviews[0].quote}"
              </p>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-white/10">
              <img src={reviews[0].image} alt={reviews[0].author} className="w-12 h-12 rounded-full object-cover border border-amber-400/40" />
              <div>
                <h4 className="text-sm font-bold font-display text-white">{reviews[0].author}</h4>
                <p className="text-xs font-mono text-amber-400">{reviews[0].title}</p>
              </div>
            </div>
          </div>

          <div
            ref={card2Ref}
            className="p-5 sm:p-7 lg:p-8 rounded-3xl bg-[#0b0c13] border border-white/10 flex flex-col justify-between space-y-6 shadow-2xl shadow-black/80 will-change-[transform,opacity,filter]"
          >
            <div className="space-y-4">
              <div className="flex gap-1">
                {[...Array(5)].map((_, idx) => (
                  <Star key={idx} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-zinc-300 font-sans text-sm lg:text-base italic leading-relaxed">
                "{reviews[1].quote}"
              </p>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-white/10">
              <img src={reviews[1].image} alt={reviews[1].author} className="w-12 h-12 rounded-full object-cover border border-amber-400/40" />
              <div>
                <h4 className="text-sm font-bold font-display text-white">{reviews[1].author}</h4>
                <p className="text-xs font-mono text-amber-400">{reviews[1].title}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
