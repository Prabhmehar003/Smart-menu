import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Sparkles, QrCode, Star, Award } from 'lucide-react';

export default function FloatingMenuCard3D({ isMobile = false }) {
  const card1Ref = useRef();
  const card2Ref = useRef();
  const card3Ref = useRef();
  const card4Ref = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // 1. Today's Special Card (Top Right of Phone, Z=0.8)
    if (card1Ref.current) {
      card1Ref.current.position.y = 1.45 + Math.sin(t * 0.8 + 1) * 0.08;
      card1Ref.current.position.x = 2.85 + Math.cos(t * 0.5) * 0.04;
      card1Ref.current.rotation.z = -0.02 + Math.sin(t * 0.6) * 0.015;
    }

    // 2. Chef's Choice (Top-Left of Phone, Z=0.3)
    if (card2Ref.current) {
      card2Ref.current.position.y = 1.55 + Math.sin(t * 0.6 + 3) * 0.09;
      card2Ref.current.position.x = -0.25 + Math.cos(t * 0.4) * 0.04;
      card2Ref.current.rotation.z = 0.02 + Math.sin(t * 0.5) * 0.015;
    }

    // 3. Handcrafted Pasta Category (Bottom-Left of Phone, Z=0.5)
    if (card3Ref.current) {
      card3Ref.current.position.y = -1.5 + Math.cos(t * 0.9 + 2) * 0.08;
      card3Ref.current.position.x = -0.2 + Math.sin(t * 0.6) * 0.04;
      card3Ref.current.rotation.z = 0.03 + Math.cos(t * 0.7) * 0.015;
    }

    // 4. Scan to View QR Badge (Bottom-Right of Phone, Z=0.9)
    if (card4Ref.current) {
      card4Ref.current.position.y = -1.55 + Math.sin(t * 1.1 + 0.5) * 0.08;
      card4Ref.current.position.x = 2.85 + Math.sin(t * 0.7) * 0.04;
      card4Ref.current.rotation.z = -0.02 + Math.cos(t * 0.8) * 0.02;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Today's Special Card (Top Right, Z=0.8) */}
      <group ref={card1Ref} position={[2.85, 1.45, 0.8]}>
        <Html transform distanceFactor={3.2} zIndexRange={[150, 0]}>
          <div className="px-3.5 py-2.5 rounded-2xl bg-[#0e1017]/92 backdrop-blur-xl border border-amber-500/35 shadow-2xl shadow-amber-500/15 flex items-center gap-3 text-white pointer-events-none select-none">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <div className="text-[9px] font-mono tracking-widest text-amber-400 uppercase font-semibold">
                TODAY'S SPECIAL
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-display">Artisan Burrata</span>
                <span className="text-xs font-mono font-extrabold text-amber-400">$18.90</span>
              </div>
            </div>
          </div>
        </Html>
      </group>

      {/* 2. Chef's Choice Badge (Top-Left, Z=0.3) */}
      <group ref={card2Ref} position={[-0.25, 1.55, 0.3]}>
        <Html transform distanceFactor={3.4} zIndexRange={[100, 0]}>
          <div className="px-3.5 py-2 rounded-2xl bg-[#0a0b10]/95 backdrop-blur-md border border-amber-500/30 shadow-lg flex items-center gap-2 text-white pointer-events-none select-none">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-mono text-amber-300 font-semibold uppercase tracking-wider">
              Chef's Choice • 4.9 ★
            </span>
          </div>
        </Html>
      </group>

      {/* 3. Category Badge (Bottom-Left, Z=0.5) */}
      <group ref={card3Ref} position={[-0.2, -1.5, 0.5]}>
        <Html transform distanceFactor={3.2} zIndexRange={[150, 0]}>
          <div className="px-3.5 py-2.5 rounded-2xl bg-[#0e1017]/92 backdrop-blur-xl border border-white/15 shadow-xl flex items-center gap-2.5 text-white pointer-events-none select-none">
            <div className="w-7 h-7 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold text-xs shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[8px] font-mono text-zinc-400 uppercase">CATEGORY</span>
              <span className="text-xs font-bold font-display text-amber-200">Handcrafted Pasta</span>
            </div>
          </div>
        </Html>
      </group>

      {/* 4. Scan to View QR Badge (Bottom-Right, Z=0.9) */}
      <group ref={card4Ref} position={[2.85, -1.55, 0.9]}>
        <Html transform distanceFactor={3.0} zIndexRange={[150, 0]}>
          <div className="px-3.5 py-2.5 rounded-2xl bg-[#0b0c12]/95 backdrop-blur-xl border border-amber-400/40 shadow-2xl shadow-amber-500/20 flex items-center gap-2.5 text-white pointer-events-none select-none">
            <div className="w-8 h-8 rounded-xl bg-white p-0.5 shadow-md flex items-center justify-center shrink-0">
              <QrCode className="w-full h-full text-black" />
            </div>
            <div>
              <span className="block text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                SCAN TO VIEW MENU
              </span>
              <span className="text-[8px] font-mono text-zinc-400">Instant Camera Access</span>
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}
