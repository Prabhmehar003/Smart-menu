import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Star, QrCode, ShoppingBag, Flame, Sparkles, Award } from 'lucide-react';

export default function SmartPhone3DEcosystem({ mousePos = { x: 0, y: 0 } }) {
  const [time, setTime] = useState(0);

  // Smooth continuous floating clock
  useEffect(() => {
    let animId;
    const update = () => {
      setTime(Date.now() * 0.001);
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Continuous organic floating values (4-8px Y, 2-4px X, 1-2deg rotation)
  const phoneFloatY = Math.sin(time * 1.1) * 6;
  const phoneFloatX = Math.cos(time * 0.8) * 3;
  const phoneRotateSway = Math.sin(time * 0.9) * 1.2;

  // Mouse Parallax Offsets
  const phoneParallaxX = mousePos.x * 16;
  const phoneParallaxY = -mousePos.y * 12;

  const cardParallaxX = mousePos.x * 26;
  const cardParallaxY = -mousePos.y * 20;

  // Base Phone 3D Rotation (8-15 deg Y, subtle X tilt)
  const phoneBaseRotateX = 8;
  const phoneBaseRotateY = -12;
  const phoneBaseRotateZ = 1.5;

  return (
    <div 
      className="w-full h-full relative flex items-center justify-center pointer-events-none select-none"
      style={{ perspective: '1200px' }}
    >
      {/* AMBIENT GLOW BACKDROP */}
      <div 
        className="absolute w-[420px] h-[580px] rounded-full bg-amber-500/15 blur-[120px] pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${phoneParallaxX * 0.5}px, ${phoneParallaxY * 0.5}px, -100px)`,
        }}
      />

      {/* FLOATING PARTICLES (MIDGROUND) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(24)].map((_, i) => {
          const particleY = (Math.sin(time * 0.8 + i) * 12) + (i * 25 - 280);
          const particleX = (Math.cos(time * 0.6 + i * 1.5) * 10) + ((i % 5) * 80 - 160);
          return (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-amber-400/60 blur-[0.5px]"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate3d(${particleX}px, ${particleY}px, ${i * 10 - 50}px)`,
                opacity: 0.3 + Math.sin(time * 2 + i) * 0.3,
              }}
            />
          );
        })}
      </div>

      {/* 3D SMARTPHONE CONTAINER */}
      <div
        className="relative z-20 transition-transform duration-100 ease-out will-change-transform"
        style={{
          transformStyle: 'preserve-3d',
          transform: `
            translate3d(${phoneFloatX + phoneParallaxX}px, ${phoneFloatY + phoneParallaxY}px, 0px)
            rotateX(${phoneBaseRotateX + mousePos.y * -4}deg)
            rotateY(${phoneBaseRotateY + mousePos.x * 5}deg)
            rotateZ(${phoneBaseRotateZ + phoneRotateSway}deg)
          `,
        }}
      >
        {/* Soft Diffused Shadow Behind Phone */}
        <div
          className="absolute inset-0 rounded-[44px] bg-black/80 blur-2xl transform translate-z-[-40px] translate-y-8 scale-95 pointer-events-none"
        />

        {/* PHYSICAL 3D PHONE CHASSIS */}
        <div
          className="relative w-[280px] sm:w-[300px] h-[560px] sm:h-[600px] rounded-[44px] bg-[#0c0d14] p-3 border-2 border-amber-500/40 shadow-2xl shadow-black/90 pointer-events-auto overflow-hidden"
          style={{
            transformStyle: 'preserve-3d',
            boxShadow: `
              -12px 18px 40px rgba(0, 0, 0, 0.85),
              0 0 35px rgba(245, 158, 11, 0.2),
              inset 0 0 2px rgba(255, 255, 255, 0.25)
            `,
          }}
        >
          {/* 3D Metallic Side Thickness Edge Panel Simulation */}
          <div 
            className="absolute top-0 bottom-0 left-full w-4 bg-gradient-to-r from-[#181a24] via-[#0e1017] to-[#07080b] rounded-r-md border-r border-amber-500/30"
            style={{
              transformOrigin: 'left center',
              transform: 'rotateY(90deg)',
            }}
          />

          {/* Top Speaker & Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 rounded-full bg-black z-40 flex items-center justify-center border border-white/10">
            <div className="w-10 h-1 rounded-full bg-zinc-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 ml-3 border border-zinc-700" />
          </div>

          {/* PHONE DISPLAY SCREEN */}
          <div className="relative w-full h-full rounded-[34px] bg-[#090a0f] overflow-hidden flex flex-col justify-between border border-white/10 text-white">
            {/* Glass Reflection Overlay Sheen */}
            <div 
              className="absolute inset-0 z-30 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)',
              }}
            />

            {/* Screen Header Bar */}
            <div className="p-4 pt-7 bg-gradient-to-b from-[#141620] to-[#090a0f] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-md">
                  <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold font-display uppercase tracking-wider text-white">
                    LE BISTRO D'OR
                  </h4>
                  <p className="text-[9px] text-amber-400/90 font-mono">Table 04 • Verified</p>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] font-mono text-amber-300 flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Smart Menu</span>
              </div>
            </div>

            {/* Categories Bar */}
            <div className="px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/5 bg-[#0d0e14]">
              {['Starred', 'Pasta', 'Mains', 'Desserts', 'Wine'].map((cat, i) => (
                <button
                  key={cat}
                  className={`px-3 py-1 rounded-full text-[10px] font-mono transition-colors whitespace-nowrap ${
                    i === 1
                      ? 'bg-amber-400 text-black font-bold shadow-md shadow-amber-400/20'
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Featured Dish Card */}
            <div className="p-3.5 flex-1 flex flex-col justify-between">
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
                <img
                  src="https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80"
                  alt="Truffle Tagliolini"
                  className="w-full h-34 object-cover transform group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-transparent to-transparent" />
                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-amber-500/90 text-black text-[9px] font-mono font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-black" />
                  <span>Chef's Special</span>
                </div>
                <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-amber-400 text-[10px] font-mono font-bold border border-amber-400/30 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>4.9</span>
                </div>
              </div>

              <div className="mt-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-display text-white">Truffle Tagliolini</h3>
                  <span className="text-sm font-bold font-mono text-amber-400">$24.50</span>
                </div>
                <p className="text-[10px] text-zinc-400 line-clamp-2 font-sans leading-relaxed">
                  Handcrafted pasta, black winter truffle, Parmigiano Reggiano 24-mo, cultured butter.
                </p>
              </div>

              {/* Action Button */}
              <button className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 hover:opacity-95 transition-opacity">
                <ShoppingBag className="w-3.5 h-3.5 text-black" />
                <span>Add to Order</span>
              </button>
            </div>

            {/* Screen Footer Bar */}
            <div className="p-3 bg-[#0d0e14] border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-zinc-400">
              <div className="flex items-center gap-1 text-amber-400">
                <QrCode className="w-3 h-3" />
                <span>NFC & QR Active</span>
              </div>
              <span>Powered by Smart Menu</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3D FLOATING UI CARDS (LAYERED FOREGROUND & MIDGROUND) */}
      <div 
        className="absolute inset-0 pointer-events-none z-30"
        style={{ perspective: '1200px' }}
      >
        {/* CARD 1: TODAY'S SPECIAL (TOP RIGHT - FOREGROUND OVERLAPPING PHONE EDGE) */}
        <div
          className="absolute top-[10%] right-[3%] sm:right-[8%] transition-transform duration-150 ease-out will-change-transform pointer-events-auto"
          style={{
            transformStyle: 'preserve-3d',
            transform: `
              translate3d(${cardParallaxX * 1.2 + Math.cos(time * 0.9) * 4}px, ${cardParallaxY * 1.2 + Math.sin(time * 1.2) * 5}px, 60px)
              rotateY(-8deg) rotateX(5deg)
            `,
          }}
        >
          <div className="px-4 py-3 rounded-2xl bg-[#0e1017]/92 backdrop-blur-xl border border-amber-500/40 shadow-2xl shadow-amber-500/20 flex items-center gap-3 text-white">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <div className="text-[9px] font-mono tracking-widest text-amber-400 uppercase font-bold">
                TODAY'S SPECIAL
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-display">Artisan Burrata</span>
                <span className="text-xs font-mono font-extrabold text-amber-400">$18.90</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: CHEF'S CHOICE (TOP LEFT - MIDGROUND) */}
        <div
          className="absolute top-[14%] left-[6%] sm:left-[12%] transition-transform duration-150 ease-out will-change-transform pointer-events-auto"
          style={{
            transformStyle: 'preserve-3d',
            transform: `
              translate3d(${cardParallaxX * 0.9 + Math.sin(time * 0.8) * 5}px, ${cardParallaxY * 0.9 + Math.cos(time * 1.1) * 4}px, 30px)
              rotateY(-10deg) rotateX(4deg)
            `,
          }}
        >
          <div className="px-4 py-2.5 rounded-2xl bg-[#0a0b10]/95 backdrop-blur-md border border-amber-500/35 shadow-xl flex items-center gap-2.5 text-white">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-mono text-amber-300 font-bold uppercase tracking-wider">
              Chef's Choice • 4.9 ★
            </span>
          </div>
        </div>

        {/* CARD 3: HANDCRAFTED PASTA CATEGORY (BOTTOM LEFT - MIDGROUND) */}
        <div
          className="absolute bottom-[16%] left-[6%] sm:left-[12%] transition-transform duration-150 ease-out will-change-transform pointer-events-auto"
          style={{
            transformStyle: 'preserve-3d',
            transform: `
              translate3d(${cardParallaxX * 1.1 + Math.cos(time * 1.0) * 5}px, ${cardParallaxY * 1.1 + Math.sin(time * 0.9) * 4}px, 40px)
              rotateY(-6deg) rotateX(6deg)
            `,
          }}
        >
          <div className="px-4 py-3 rounded-2xl bg-[#0e1017]/95 backdrop-blur-xl border border-white/15 shadow-2xl flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold text-xs shrink-0">
              <Award className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block text-[8px] font-mono text-zinc-400 uppercase font-semibold">CATEGORY</span>
              <span className="text-xs font-bold font-display text-amber-200">Handcrafted Pasta</span>
            </div>
          </div>
        </div>

        {/* CARD 4: SCAN TO VIEW QR (BOTTOM RIGHT - FOREGROUND OVERLAPPING PHONE CORNER) */}
        <div
          className="absolute bottom-[12%] right-[2%] sm:right-[5%] transition-transform duration-150 ease-out will-change-transform pointer-events-auto"
          style={{
            transformStyle: 'preserve-3d',
            transform: `
              translate3d(${cardParallaxX * 1.3 + Math.sin(time * 1.2) * 5}px, ${cardParallaxY * 1.3 + Math.cos(time * 1.0) * 5}px, 70px)
              rotateY(-12deg) rotateX(8deg)
            `,
          }}
        >
          <div className="px-4 py-3 rounded-2xl bg-[#0b0c12]/95 backdrop-blur-2xl border border-amber-400/50 shadow-2xl shadow-amber-500/25 flex items-center gap-3 text-white">
            <div className="w-9 h-9 rounded-xl bg-white p-0.5 shadow-md flex items-center justify-center shrink-0">
              <QrCode className="w-full h-full text-black" />
            </div>
            <div>
              <span className="block text-[10px] font-mono text-amber-400 font-extrabold uppercase tracking-wider">
                SCAN TO VIEW MENU
              </span>
              <span className="text-[8px] font-mono text-zinc-400">Instant Camera Access</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
