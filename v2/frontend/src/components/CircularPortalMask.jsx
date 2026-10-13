import React from 'react';

/**
 * Reusable CircularPortalMask component.
 * Provides GPU-accelerated circular aperture reveal with a soft-blurred luminescent glowing edge.
 */
export default function CircularPortalMask({
  progressRef,
  className = '',
  children,
  haloColor = 'rgba(245, 158, 11, 0.45)', // warm amber gold
  haloAccent = 'rgba(16, 185, 129, 0.25)', // subtle emerald accent
}) {
  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Soft Blurred Glowing Edge Halo */}
      <div
        className="portal-halo absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none will-change-transform"
        style={{
          width: '100px',
          height: '100px',
          background: `radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, ${haloColor} 45%, ${haloAccent} 70%, transparent 85%)`,
          filter: 'blur(20px)',
          opacity: 0,
          transform: 'translate(-50%, -50%) scale(0.1)',
        }}
      />

      {/* Iris Clipped Content Layer */}
      <div
        className="portal-content-layer w-full h-full will-change-[clip-path,filter,opacity]"
        style={{
          clipPath: 'circle(0% at 50% 50%)',
          WebkitClipPath: 'circle(0% at 50% 50%)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
