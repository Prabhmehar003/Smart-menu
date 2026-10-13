import React, { useRef, useEffect } from 'react';

export default function HeroBackground({ scrollProgress = 0 }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn('Hero background video playback prevented:', err);
      });
    }
  }, []);

  // Subtle scroll opacity for video
  const videoOpacity = Math.max(0.35, 1 - scrollProgress * 0.65);
  const videoTransform = `scale(${1 + scrollProgress * 0.05})`;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
      {/* Layer 1: Restaurant Video Asset - Full Bleed Edge-to-Edge */}
      <video
        ref={videoRef}
        src="/videos/restaurant-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover min-w-full min-h-full transition-transform duration-75 ease-out"
        style={{
          opacity: videoOpacity,
          transform: videoTransform,
          filter: 'contrast(1.05) saturate(1.0)',
        }}
      />

      {/* Layer 2: Subtle Dark Charcoal Overlay for Text Readability */}
      <div className="absolute inset-0 bg-[#08090e]/50" />

      {/* Layer 2b: Top & Bottom Linear Vignette Gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/85 via-transparent to-[#050508]" />

      {/* Layer 2c: Soft Ambient Edge Vignette */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 45%, rgba(5, 5, 8, 0.70) 100%)',
        }}
      />

      {/* Layer 3: Warm Ambient Golden Yellow Light Accent Glow (No white circle artifact) */}
      <div 
        className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[140px] bg-gradient-to-tr from-amber-500/15 via-amber-400/10 to-transparent pointer-events-none"
      />
      <div 
        className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] rounded-full blur-[120px] bg-amber-500/10 pointer-events-none"
      />
    </div>
  );
}
