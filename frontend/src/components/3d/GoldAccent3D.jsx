import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function GoldAccent3D() {
  const meshRef = useRef();

  const goldMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        metalness: 0.95,
        roughness: 0.22,
        envMapIntensity: 2.0,
      }),
    []
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    // 30-second smooth controlled path
    const angle = (t / 30) * Math.PI * 2;
    meshRef.current.position.x = Math.sin(angle) * 2.8;
    meshRef.current.position.y = Math.cos(angle * 0.7) * 1.5;
    meshRef.current.position.z = Math.sin(angle * 1.2) * 0.8 - 0.5;
    meshRef.current.rotation.x = t * 0.3;
    meshRef.current.rotation.y = t * 0.4;
  });

  return (
    <group ref={meshRef} position={[2.8, 1.0, -0.5]}>
      {/* Metallic Gold Ring/Orb Accent */}
      <mesh material={goldMaterial} castShadow>
        <torusGeometry args={[0.25, 0.08, 16, 32]} />
      </mesh>
      {/* Inner Core */}
      <mesh material={goldMaterial}>
        <sphereGeometry args={[0.1, 16, 16]} />
      </mesh>
    </group>
  );
}
