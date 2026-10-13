import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { UtensilsCrossed, Star, QrCode, ShoppingBag, Flame, Sparkles } from 'lucide-react';

export default function SmartPhone3D({ isMobile = false }) {
  const phoneGroupRef = useRef();

  // Continuous subtle 3D float and tilt drift in 3/4 perspective
  useFrame((state) => {
    if (!phoneGroupRef.current) return;
    const t = state.clock.getElapsedTime();
    
    // Smooth 3/4 perspective drift (never completely front-facing)
    phoneGroupRef.current.position.y = Math.sin(t * 0.7) * 0.08;
    phoneGroupRef.current.rotation.x = 0.22 + Math.sin(t * 0.5) * 0.02;
    phoneGroupRef.current.rotation.y = -0.38 + Math.cos(t * 0.4) * 0.025;
    phoneGroupRef.current.rotation.z = 0.02 + Math.sin(t * 0.6) * 0.01;
  });

  // Phone chassis dimensions
  const phoneWidth = 2.0;
  const phoneHeight = 4.2;
  const phoneDepth = 0.16;

  // Materials
  const chassisMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#101117',
        metalness: 0.92,
        roughness: 0.18,
      }),
    []
  );

  const glowingGoldRimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        metalness: 0.95,
        roughness: 0.2,
        emissive: '#d97706',
        emissiveIntensity: 0.4,
      }),
    []
  );

  return (
    <group ref={phoneGroupRef} position={[2.0, -0.05, 0.2]}>
      {/* Phone Body Chassis */}
      <mesh material={chassisMaterial} castShadow receiveShadow>
        <boxGeometry args={[phoneWidth, phoneHeight, phoneDepth]} />
      </mesh>

      {/* Glowing Yellow / Amber Metallic Rim Trim */}
      <mesh position={[0, 0, 0.002]} material={glowingGoldRimMaterial}>
        <boxGeometry args={[phoneWidth + 0.02, phoneHeight + 0.02, phoneDepth - 0.02]} />
      </mesh>

      {/* Camera Notch Pillar */}
      <mesh position={[0, phoneHeight / 2 - 0.18, phoneDepth / 2 + 0.005]}>
        <capsuleGeometry args={[0.03, 0.2, 4, 8]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Interactive Smart Menu Screen UI rendered directly on display */}
      <Html
        transform
        position={[0, 0, phoneDepth / 2 + 0.006]}
        distanceFactor={2.5}
        zIndexRange={[100, 0]}
        className="w-[260px] h-[520px] rounded-[32px] bg-[#090a0f] text-white overflow-hidden shadow-2xl border border-amber-500/20 flex flex-col justify-between pointer-events-auto select-none"
      >
        {/* Screen Header Bar */}
        <div className="p-3.5 pt-5 bg-gradient-to-b from-[#141620] to-[#090a0f] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <h4 className="text-[11px] font-bold font-display uppercase tracking-wider text-white">
                LE BISTRO D'OR
              </h4>
              <p className="text-[8px] text-amber-400/90 font-mono">Table 04 • Verified</p>
            </div>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[8px] font-mono text-amber-300 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Smart Menu</span>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/5 bg-[#0d0e14]">
          {['Starred', 'Pasta', 'Mains', 'Desserts', 'Wine'].map((cat, i) => (
            <button
              key={cat}
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono transition-colors whitespace-nowrap ${
                i === 1
                  ? 'bg-amber-400 text-black font-bold shadow-md shadow-amber-400/20'
                  : 'bg-white/5 text-zinc-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Featured Dish Card */}
        <div className="p-3 flex-1 flex flex-col justify-between">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            <img
              src="https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80"
              alt="Truffle Tagliolini"
              className="w-full h-30 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-transparent to-transparent" />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500/90 text-black text-[8px] font-mono font-bold flex items-center gap-1">
              <Flame className="w-2.5 h-2.5 text-black" />
              <span>Chef's Special</span>
            </div>
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-amber-400 text-[9px] font-mono font-bold border border-amber-400/30 flex items-center gap-1">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span>4.9</span>
            </div>
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold font-display text-white">Truffle Tagliolini</h3>
              <span className="text-xs font-bold font-mono text-amber-400">$24.50</span>
            </div>
            <p className="text-[9px] text-zinc-400 line-clamp-2 font-sans leading-relaxed">
              Handcrafted pasta, black winter truffle, Parmigiano Reggiano 24-mo, cultured butter.
            </p>
          </div>

          {/* Action Button */}
          <button className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-mono font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/30">
            <ShoppingBag className="w-3 h-3 text-black" />
            <span>Add to Order</span>
          </button>
        </div>

        {/* Screen Footer */}
        <div className="p-2.5 bg-[#0d0e14] border-t border-white/10 flex items-center justify-between text-[8px] font-mono text-zinc-400">
          <div className="flex items-center gap-1 text-amber-400">
            <QrCode className="w-2.5 h-2.5" />
            <span>NFC & QR Active</span>
          </div>
          <span>Powered by Smart Menu</span>
        </div>
      </Html>
    </group>
  );
}
