import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, CheckCircle2 } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function QRExperienceSection() {
  const [tableNum, setTableNum] = useState('04');
  const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/menu?table=${tableNum}` : `https://smartmenu.live/menu?table=${tableNum}`;

  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const leftColRef = useRef(null);
  const rightColRef = useRef(null);

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

        // 1. Left details column enters with focus pull
        tl.fromTo(
          leftColRef.current,
          { x: -70, opacity: 0, filter: 'blur(10px)' },
          { x: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.18 },
          0
        );

        // 2. Right Table Standee Mockup zooms in into camera focal plane
        tl.fromTo(
          rightColRef.current,
          { scale: 0.86, y: 40, opacity: 0, filter: 'blur(12px)' },
          { scale: 1.0, y: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', duration: 0.2 },
          0.04
        );

        // 3. Exit camera blur
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

        tl.fromTo(leftColRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.3 }, 0);
        tl.fromTo(rightColRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.35 }, 0.1);
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="qr-experience"
      className="relative w-full h-[100svh] min-h-[720px] bg-[#07080d] border-t border-white/5 overflow-hidden flex items-center justify-center select-none"
    >
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-6 relative z-10 w-full will-change-[transform,opacity,filter]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Text */}
          <div ref={leftColRef} className="lg:col-span-6 space-y-5 will-change-[transform,opacity,filter]">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase">
              <QrCode className="w-3.5 h-3.5" />
              <span>ZERO FRICTION GUEST ACCESS</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold font-display uppercase tracking-tight text-white leading-tight">
              TABLESIDE QR & NFC <span className="text-amber-400">DINING</span>.
            </h2>
            <p className="text-zinc-400 text-sm md:text-base font-sans leading-relaxed">
              Guests simply aim their smartphone camera at the table QR code. No app downloads, no registration walls. Instant menu loading in under 1 second.
            </p>

            <div className="space-y-3 pt-2">
              {[
                'Instant Camera Auto-Scan (iOS & Android)',
                'Table-Specific Session Verification',
                'NFC Touch Tap Support',
                'Multi-Guest Shared Bill Cart',
              ].map((text) => (
                <div key={text} className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Interactive QR Table Standee Mockup */}
          <div ref={rightColRef} className="lg:col-span-6 flex justify-center will-change-[transform,opacity,filter]">
            <div className="p-7 sm:p-8 rounded-3xl bg-[#0c0e17] border border-amber-500/40 shadow-2xl shadow-black/90 flex flex-col items-center text-center space-y-5 max-w-sm w-full">
              <div className="flex items-center justify-between w-full border-b border-white/10 pb-3">
                <span className="text-xs font-mono text-zinc-400">TABLE STANDEE MOCKUP</span>
                <select
                  value={tableNum}
                  onChange={(e) => setTableNum(e.target.value)}
                  className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-amber-400"
                >
                  <option value="01">Table 01</option>
                  <option value="04">Table 04</option>
                  <option value="12">VIP Room 12</option>
                </select>
              </div>

              {/* QR Render */}
              <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-amber-400/80">
                <QRCodeSVG value={qrUrl} size={170} fgColor="#090a0f" />
              </div>

              <div>
                <h4 className="text-base sm:text-lg font-bold font-display uppercase text-white">SCAN TO BROWSE MENU</h4>
                <p className="text-xs font-mono text-amber-400 mt-1">LE BISTRO D'OR • TABLE {tableNum}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
