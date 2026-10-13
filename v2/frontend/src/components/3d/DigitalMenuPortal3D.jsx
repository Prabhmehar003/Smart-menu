import React, { useState } from 'react';
import { UtensilsCrossed, Star, QrCode, ShoppingBag, Flame, Sparkles, Award, ChevronRight } from 'lucide-react';

export default function DigitalMenuPortal3D({ mousePos = { x: 0, y: 0 } }) {
  const [isHovered, setIsHovered] = useState(false);
  const activeMousePos = isHovered ? mousePos : { x: 0, y: 0 };

  // The portal remains still at rest and only responds to a deliberate hover.
  const portalFloatY = 0;
  const portalFloatX = 0;
  const portalRotateSway = 0;

  // Mouse Parallax Offsets per depth tier
  const portalParallaxX = activeMousePos.x * 12;
  const portalParallaxY = -activeMousePos.y * 9;

  const foodParallaxX = activeMousePos.x * 16;
  const foodParallaxY = -activeMousePos.y * 12;

  const cardParallaxX = activeMousePos.x * 24;
  const cardParallaxY = -activeMousePos.y * 18;

  const qrParallaxX = activeMousePos.x * 32;
  const qrParallaxY = -activeMousePos.y * 24;

  // Base 3D Rotation angles (sleek 3/4 acrylic menu perspective)
  const portalRotateX = 6.5;
  const portalRotateY = -10.5;
  const portalRotateZ = 1.0;

  return (
    <div 
      className="w-full h-full relative flex items-center justify-center pointer-events-none select-none"
      style={{ perspective: '1200px' }}
    >
      {/* LAYER 1: AMBIENT GLOW BACKDROP */}
      <div 
        className="absolute w-[480px] h-[540px] rounded-full bg-amber-500/18 blur-[135px] pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${portalParallaxX * 0.4}px, ${portalParallaxY * 0.4}px, -130px)`,
        }}
      />

      {/* MIDGROUND FLOATING LIGHT PARTICLES */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(18)].map((_, i) => {
          const particleY = i * 30 - 270;
          const particleX = (i % 5) * 95 - 190;
          return (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-amber-400/55 blur-[0.5px]"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate3d(${particleX}px, ${particleY}px, ${i * 8 - 40}px)`,
                opacity: 0.35,
              }}
            />
          );
        })}
      </div>

      {/* MAIN 3D ECOSYSTEM WRAPPER */}
      <div
        className="relative z-20 transition-transform duration-100 ease-out will-change-transform flex items-center justify-center"
        style={{
          transformStyle: 'preserve-3d',
          transform: `
            translate3d(${portalFloatX + portalParallaxX}px, ${portalFloatY + portalParallaxY}px, 0px)
            rotateX(${portalRotateX + activeMousePos.y * -3.5}deg)
            rotateY(${portalRotateY + activeMousePos.x * 4.5}deg)
            rotateZ(${portalRotateZ + portalRotateSway}deg)
          `,
        }}
      >
        {/* Soft Diffused Deep Shadow Behind Portal */}
        <div
          className="absolute inset-0 rounded-[40px] bg-black/90 blur-3xl transform translate-z-[-50px] translate-y-12 scale-95 pointer-events-none"
        />

        {/* LAYER 2: HIGH-DEFINITION 3D PHYSICAL GLASS MENU PORTAL */}
        <div
          className="relative w-[330px] sm:w-[370px] lg:w-[410px] rounded-[38px] bg-gradient-to-b from-[#121422]/96 via-[#0a0c16]/96 to-[#06070e]/98 backdrop-blur-3xl p-4 sm:p-5 border border-amber-500/40 shadow-2xl pointer-events-auto overflow-hidden text-white"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            transformStyle: 'preserve-3d',
            boxShadow: `
              -20px 28px 60px rgba(0, 0, 0, 0.95),
              0 0 45px rgba(245, 158, 11, 0.22),
              inset 0 1px 2px rgba(255, 255, 255, 0.25),
              inset 0 0 20px rgba(245, 158, 11, 0.05)
            `,
          }}
        >
          {/* 3D Glass Thickness Side Edge Panel */}
          <div 
            className="absolute top-0 bottom-0 left-full w-5 bg-gradient-to-r from-[#1b1e2e] via-[#0e101b] to-[#05060a] rounded-r-lg border-r border-amber-500/30"
            style={{
              transformOrigin: 'left center',
              transform: 'rotateY(90deg)',
            }}
          />

          {/* Luxury Sheen Diagonal Glass Reflection Gradient */}
          <div 
            className="absolute inset-0 z-30 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 40%, transparent 75%)',
            }}
          />

          {/* PORTAL HEADER BAR */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/20 border border-amber-500/45 flex items-center justify-center shadow-lg shadow-amber-500/10">
                <UtensilsCrossed className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold font-display uppercase tracking-widest text-white flex items-center gap-1.5">
                  <span>SMART MENU</span>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400" />
                </h3>
                <p className="text-[10px] text-amber-400/90 font-mono tracking-wide">Table 04 • Live Digital Touchpoint</p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-[10px] font-mono text-amber-300 font-semibold flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Interactive</span>
            </div>
          </div>

          {/* CATEGORIES TAB NAVIGATION */}
          <div className="my-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/5">
            {['Starters', 'Pasta', 'Mains', 'Desserts'].map((cat, i) => (
              <button
                key={cat}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                  i === 1
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/30 scale-105'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* LAYER 3: PROTRUDING FEATURED FOOD SHOWCASE DISH */}
          <div 
            className="relative rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl my-3 group transition-transform duration-300"
            style={{
              transformStyle: 'preserve-3d',
              transform: `translate3d(${foodParallaxX * 0.25}px, ${foodParallaxY * 0.25}px, 28px)`,
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.8), 0 0 25px rgba(245, 158, 11, 0.2)',
            }}
          >
            <img
              src="https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80"
              alt="Truffle Tagliolini"
              className="w-full h-42 sm:h-46 object-cover transform group-hover:scale-105 transition-transform duration-700"
            />
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#090b14] via-transparent to-transparent opacity-90" />

            {/* Chef Special Badge */}
            <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[10px] font-mono font-extrabold flex items-center gap-1.5 shadow-md shadow-amber-500/25">
              <Flame className="w-3.5 h-3.5 text-black fill-black" />
              <span>CHEF'S SPECIAL</span>
            </div>

            {/* Rating Badge */}
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/85 backdrop-blur-md text-amber-400 text-[11px] font-mono font-bold border border-amber-400/40 flex items-center gap-1 shadow-md">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>4.9 ★</span>
            </div>

            {/* In-Image Dish Overlay Title */}
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
              <div>
                <span className="text-[10px] font-mono text-amber-300/90 font-semibold uppercase tracking-wider block">Signature Dish</span>
                <span className="text-base font-bold font-display text-white drop-shadow-sm">Truffle Tagliolini</span>
              </div>
              <span className="text-base font-extrabold font-mono text-amber-400 drop-shadow-md">$24.50</span>
            </div>
          </div>

          {/* ITEM DESCRIPTION */}
          <div className="space-y-1.5 px-1 py-1">
            <p className="text-xs text-zinc-300 font-sans leading-relaxed font-normal">
              Handcrafted pasta, black winter truffle, Parmigiano Reggiano, cultured butter.
            </p>
          </div>

          {/* PRIMARY ACTION BUTTON */}
          <button className="mt-3.5 w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-mono font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.015] active:scale-[0.985] transition-all cursor-pointer">
            <ShoppingBag className="w-4 h-4 text-black" />
            <span>ADD TO ORDER</span>
            <ChevronRight className="w-4 h-4 text-black" />
          </button>

          {/* FOOTER BAR */}
          <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <QrCode className="w-3.5 h-3.5" />
              <span>NFC & QR Table Access</span>
            </div>
            <span className="text-zinc-500">Smart Menu OS</span>
          </div>
        </div>

        {/* MULTI-TIER FLOATING CARDS (POSITIONED CLEARLY AROUND THE MENU CARD TO PREVENT OVERLAP) */}

        {/* CARD 1: TODAY'S SPECIAL (TOP RIGHT OUTSIDE SATELLITE - Z: 45px) */}
        <div
          className="absolute -top-4 -right-12 sm:-right-20 lg:-right-24 transition-transform duration-150 ease-out will-change-transform pointer-events-auto"
          style={{
            transformStyle: 'preserve-3d',
            transform: `
              translate3d(${cardParallaxX * 1.15}px, ${cardParallaxY * 1.15}px, 45px)
              rotateY(-7deg) rotateX(4deg)
            `,
          }}
        >
          <div className="px-4 py-3 rounded-2xl bg-[#0d0f1a]/96 backdrop-blur-2xl border border-amber-500/45 shadow-2xl shadow-amber-500/25 flex items-center gap-3 text-white">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <div className="text-[9px] font-mono tracking-widest text-amber-400 uppercase font-bold">
                TODAY'S SPECIAL
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-display text-white">Artisan Burrata</span>
                <span className="text-xs font-mono font-extrabold text-amber-400">$18.90</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: CHEF'S CHOICE (TOP LEFT OUTSIDE SATELLITE - Z: 55px) */}
        <div
          className="absolute -top-3 -left-10 sm:-left-16 lg:-left-20 transition-transform duration-150 ease-out will-change-transform pointer-events-auto"
          style={{
            transformStyle: 'preserve-3d',
            transform: `
              translate3d(${cardParallaxX * 0.9}px, ${cardParallaxY * 0.9}px, 55px)
              rotateY(-9deg) rotateX(5deg)
            `,
          }}
        >
          <div className="px-4 py-2.5 rounded-2xl bg-[#090b14]/96 backdrop-blur-xl border border-amber-500/45 shadow-2xl flex items-center gap-2.5 text-white">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-mono text-amber-300 font-bold uppercase tracking-wider">
              CHEF'S CHOICE • 4.9 ★
            </span>
          </div>
        </div>

        {/* CARD 3: HANDCRAFTED PASTA CATEGORY (BOTTOM LEFT OUTSIDE SATELLITE - Z: 65px) */}
        <div
          className="absolute -bottom-2 -left-10 sm:-left-16 lg:-left-20 transition-transform duration-150 ease-out will-change-transform pointer-events-auto"
          style={{
            transformStyle: 'preserve-3d',
            transform: `
              translate3d(${cardParallaxX * 1.1}px, ${cardParallaxY * 1.1}px, 65px)
              rotateY(-6deg) rotateX(6deg)
            `,
          }}
        >
          <div className="px-4 py-3 rounded-2xl bg-[#0d0f1a]/96 backdrop-blur-2xl border border-white/20 shadow-2xl flex items-center gap-3 text-white">
            <div className="w-8.5 h-8.5 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold text-xs shrink-0 shadow-md">
              <Award className="w-4.5 h-4.5 text-black" />
            </div>
            <div>
              <span className="block text-[8px] font-mono text-zinc-400 uppercase font-semibold">CATEGORY</span>
              <span className="text-xs font-bold font-display text-amber-200">HANDCRAFTED PASTA</span>
            </div>
          </div>
        </div>

        {/* CARD 4: SCAN TO VIEW QR (BOTTOM RIGHT OUTSIDE SATELLITE - Z: 85px) */}
        <div
          className="absolute -bottom-3 -right-12 sm:-right-20 lg:-right-24 transition-transform duration-150 ease-out will-change-transform pointer-events-auto"
          style={{
            transformStyle: 'preserve-3d',
            transform: `
              translate3d(${qrParallaxX}px, ${qrParallaxY}px, 85px)
              rotateY(-11deg) rotateX(7deg)
            `,
          }}
        >
          <div className="px-4 py-3 rounded-2xl bg-[#080912]/98 backdrop-blur-2xl border border-amber-400/55 shadow-2xl shadow-amber-500/30 flex items-center gap-3 text-white">
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
