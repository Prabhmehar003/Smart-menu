import React, { useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import SmartPhone3D from './SmartPhone3D';
import FloatingMenuCard3D from './FloatingMenuCard3D';
import FloatingParticles3D from './FloatingParticles3D';

function CameraAndParallaxController({ mousePos }) {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const { camera } = state;

    // Base camera coordinates
    const baseX = 0;
    const baseY = 0;

    // 1. Imperceptible camera drift (20-40s cycle)
    const driftX = Math.sin(t * 0.08) * 0.2;
    const driftY = Math.cos(t * 0.07) * 0.12;

    // 2. Mouse Parallax (smooth interpolation)
    const parallaxX = mousePos.x * 0.3;
    const parallaxY = mousePos.y * 0.2;

    // Interpolate camera position
    camera.position.x = THREEMathLerp(camera.position.x, baseX + driftX + parallaxX, 0.05);
    camera.position.y = THREEMathLerp(camera.position.y, baseY + driftY + parallaxY, 0.05);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function THREEMathLerp(current, target, factor) {
  return current + (target - current) * factor;
}

export default function HeroScene({ mousePos = { x: 0, y: 0 } }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="w-full h-full relative overflow-visible pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 45 }}
        dpr={isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2)}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        className="w-full h-full"
      >
        {/* Warm Cinematic Ambient Light */}
        <ambientLight color="#fff7ed" intensity={0.5} />
        
        {/* Key & Fill Lights */}
        <directionalLight position={[5, 5, 5]} color="#f59e0b" intensity={2.2} castShadow />
        <directionalLight position={[-5, 2, -2]} color="#ffffff" intensity={0.8} />

        {/* Glowing Amber Point Lights for Rim Lighting */}
        <pointLight position={[1, -1, 3]} color="#f59e0b" intensity={3.0} distance={10} />
        <pointLight position={[0, 2, -3]} color="#b45309" intensity={2.0} distance={8} />

        {/* Camera Drift & Parallax Controller */}
        <CameraAndParallaxController mousePos={mousePos} />

        {/* Floating Particles Field */}
        <FloatingParticles3D count={45} />

        {/* 3/4 Perspective Floating Smartphone */}
        <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.25}>
          <SmartPhone3D isMobile={isMobile} />
        </Float>

        {/* Small Floating Digital Menu Cards */}
        {!isMobile && <FloatingMenuCard3D isMobile={isMobile} />}
      </Canvas>
    </div>
  );
}
