import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Sparkles, CheckCircle2, Compass, UtensilsCrossed } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeroBackground from './HeroBackground';
import DigitalMenuPortal3D from './3d/DigitalMenuPortal3D';
import Navbar from './Navbar';
import { HERO_COPY, ANIMATION_EASING } from '../lib/constants';

gsap.registerPlugin(ScrollTrigger);

export default function Hero({ onOpenDemo, onOpenSignIn }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);
  const heroContentRef = useRef(null);
  const portalHaloRef = useRef(null);
  const portalIrisRef = useRef(null);
  const portalInnerRef = useRef(null);
  const darkGreenOverlayRef = useRef(null);


  // Mouse Parallax listener
  const handleMouseMove = useCallback((e) => {
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth) * 2 - 1;
    const y = -(e.clientY / innerHeight) * 2 + 1;
    setMousePos({ x, y });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  // GSAP Pinned ScrollTrigger Timeline
  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Desktop: Full cinematic depth, large iris bloom, camera pull-through
      mm.add('(min-width: 769px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: '+=190%',
            pin: true,
            scrub: 1,
            anticipatePin: 1,
          },
        });

        // 1. Gradually darken and de-emphasize hero content, scale down & blur
        tl.to(
          heroContentRef.current,
          {
            scale: 0.86,
            opacity: 0,
            filter: 'blur(16px)',
            y: -50,
            ease: 'power2.inOut',
            duration: 0.45,
          },
          0
        );

        // 2. Dark/Green outer atmosphere emerges
        tl.to(
          darkGreenOverlayRef.current,
          {
            opacity: 1,
            ease: 'power2.inOut',
            duration: 0.5,
          },
          0.05
        );

        // 3. Glowing circular halo begins relatively small and blooms with soft glowing edge
        tl.fromTo(
          portalHaloRef.current,
          { scale: 0.08, opacity: 0 },
          {
            scale: 9.5,
            opacity: 1,
            ease: 'power2.out',
            duration: 0.75,
          },
          0.15
        );

        // 4. Circular white radial/iris mask expands dramatically across viewport
        tl.fromTo(
          portalIrisRef.current,
          {
            clipPath: 'circle(0% at 50% 50%)',
            WebkitClipPath: 'circle(0% at 50% 50%)',
          },
          {
            clipPath: 'circle(135% at 50% 50%)',
            WebkitClipPath: 'circle(135% at 50% 50%)',
            ease: 'power2.inOut',
            duration: 0.8,
          },
          0.2
        );

        // 5. Content inside the circle gradually sharpens, scales and appears
        tl.fromTo(
          portalInnerRef.current,
          {
            opacity: 0,
            scale: 0.78,
            filter: 'blur(16px)',
          },
          {
            opacity: 1,
            scale: 1.05,
            filter: 'blur(0px)',
            ease: 'power1.out',
            duration: 0.65,
          },
          0.3
        );
      });

      // Mobile: Optimized pin distance and lightweight blur for 60fps
      mm.add('(max-width: 768px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: '+=120%',
            pin: true,
            scrub: 0.8,
          },
        });

        tl.to(
          heroContentRef.current,
          {
            scale: 0.92,
            opacity: 0,
            filter: 'blur(6px)',
            y: -25,
            duration: 0.4,
          },
          0
        );

        tl.to(
          darkGreenOverlayRef.current,
          {
            opacity: 0.95,
            duration: 0.4,
          },
          0.05
        );

        tl.fromTo(
          portalHaloRef.current,
          { scale: 0.1, opacity: 0 },
          { scale: 5, opacity: 0.85, duration: 0.6 },
          0.15
        );

        tl.fromTo(
          portalIrisRef.current,
          {
            clipPath: 'circle(0% at 50% 50%)',
            WebkitClipPath: 'circle(0% at 50% 50%)',
          },
          {
            clipPath: 'circle(125% at 50% 50%)',
            WebkitClipPath: 'circle(125% at 50% 50%)',
            duration: 0.7,
          },
          0.2
        );

        tl.fromTo(
          portalInnerRef.current,
          { opacity: 0, scale: 0.88, filter: 'blur(6px)' },
          { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.5 },
          0.3
        );
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  // Motion variants for initial entrance - snappy, crisp, immediate
  const headlineLine1Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: 'easeOut' },
    },
  };

  const headlineLine2Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, delay: 0.04, ease: 'easeOut' },
    },
  };

  const descriptionVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, delay: 0.06, ease: 'easeOut' },
    },
  };

  const ctaVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, delay: 0.08, ease: 'easeOut' },
    },
  };

  const sceneVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.25, ease: 'easeOut' },
    },
  };

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative w-full h-[100svh] min-h-[640px] lg:min-h-[760px] overflow-hidden bg-[#050508] select-none"
    >
      {/* LAYER 1: Background Video & Overlays */}
      <HeroBackground scrollProgress={0} />

      {/* Atmospheric Dark Green Vignette Layer (Outer area remains dark/green while circle brightens) */}
      <div
        ref={darkGreenOverlayRef}
        className="absolute inset-0 bg-[#020b06]/85 opacity-0 pointer-events-none z-10 transition-colors duration-500"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(3, 18, 12, 0.4) 0%, rgba(2, 11, 6, 0.96) 80%)',
        }}
      />

      {/* Floating Navbar */}
      <Navbar onOpenDemo={onOpenDemo} onOpenSignIn={onOpenSignIn} />

      {/* LAYER 2: Main Hero Content (Pinned & Scrubbed) */}
      <div
        ref={heroContentRef}
        className="relative z-20 max-w-7xl mx-auto w-full h-full px-4 sm:px-6 pt-24 sm:pt-32 pb-14 sm:pb-16 md:pt-40 md:pb-24 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-12 will-change-[transform,opacity,filter]"
      >
        {/* LEFT COLUMN: Hero Copy & CTA */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6 sm:space-y-8 text-left">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase w-fit shadow-md shadow-amber-500/5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Restaurant OS</span>
          </motion.div>

          {/* Headline */}
          <div className="space-y-1">
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={headlineLine1Variants}
              className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold font-display uppercase tracking-tight text-white leading-[1.04] sm:leading-[0.95]"
            >
              {HERO_COPY.headlineLine1}
            </motion.h1>
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={headlineLine2Variants}
              className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold font-display uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 leading-[1.04] sm:leading-[0.95]"
            >
              {HERO_COPY.headlineLine2}
            </motion.h1>
          </div>

          {/* Subtext */}
          <motion.p
            initial="hidden"
            animate="visible"
            variants={descriptionVariants}
            className="text-sm sm:text-base md:text-lg text-zinc-300 font-sans max-w-xl font-normal leading-relaxed"
          >
            {HERO_COPY.subtext}
          </motion.p>

          {/* Primary & Secondary CTAs */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={ctaVariants}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4 pt-1 sm:pt-2"
          >
            <motion.button
              onClick={onOpenSignIn || onOpenDemo}
              whileHover={{ y: -1, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="group w-full sm:w-auto justify-center px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-mono font-bold text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 flex items-center gap-3 cursor-pointer"
            >
              <span>{HERO_COPY.primaryCTA}</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200 text-black" />
            </motion.button>

            <motion.a
              href="#how-it-works"
              whileHover={{ y: -1, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full sm:w-auto justify-center px-6 sm:px-7 py-3.5 sm:py-4 rounded-full bg-white/5 border border-white/15 hover:border-amber-400/40 text-white font-mono text-xs sm:text-sm uppercase tracking-wider backdrop-blur-md hover:bg-white/10 transition-all duration-200 flex items-center gap-2.5"
            >
              <Play className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{HERO_COPY.secondaryCTA}</span>
            </motion.a>
          </motion.div>

          {/* Trust Highlights */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="pt-4 sm:pt-6 flex flex-wrap items-center gap-4 sm:gap-6 text-[11px] sm:text-xs font-mono text-zinc-400 border-t border-white/10"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>No App Download Needed</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Instant POS Sync</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>12-Language AI</span>
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN: Realistic 3D Perspective Smartphone Product Ecosystem */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sceneVariants}
          className="lg:col-span-6 w-full h-[45vh] sm:h-[55vh] lg:h-[75vh] relative flex items-center justify-center overflow-visible"
        >
          <DigitalMenuPortal3D mousePos={mousePos} />
        </motion.div>
      </div>

      {/* LAYER 3: SOFT-BLURRED GLOWING CIRCULAR PORTAL / IRIS REVEAL */}
      {/* 3a: Glowing halo that blooms outward with soft diffused gradient edge */}
      <div
        ref={portalHaloRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-30 will-change-transform"
        style={{
          width: '260px',
          height: '260px',
          background:
            'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.98) 0%, rgba(245, 158, 11, 0.75) 30%, rgba(16, 185, 129, 0.45) 55%, transparent 75%)',
          filter: 'blur(35px)',
          opacity: 0,
        }}
      />

      {/* 3b: Expanding Circular Iris Mask Layer */}
      <div
        ref={portalIrisRef}
        className="absolute inset-0 z-40 w-full h-full pointer-events-none overflow-hidden will-change-[clip-path]"
        style={{
          clipPath: 'circle(0% at 50% 50%)',
          WebkitClipPath: 'circle(0% at 50% 50%)',
        }}
      >
        {/* Interior of Circular Portal: Bright, luminous emerald & gold atmosphere */}
        <div
          ref={portalInnerRef}
          className="w-full h-full relative flex flex-col items-center justify-center text-center px-6 bg-gradient-to-b from-[#091710] via-[#050e09] to-[#050508] will-change-[transform,opacity,filter]"
        >
          {/* Radiant Iris Center Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.2)_0%,rgba(245,158,11,0.18)_35%,transparent_70%)] blur-[80px] pointer-events-none" />

          {/* Aperture Ring Graphics */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full border border-amber-400/50 bg-amber-500/10 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.4)] backdrop-blur-md">
              <Compass className="w-9 h-9 text-amber-300 animate-spin" style={{ animationDuration: '14s' }} />
            </div>
            <div className="absolute -inset-3 rounded-full border border-dashed border-amber-300/30 animate-spin" style={{ animationDuration: '24s' }} />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[11px] font-mono tracking-[0.25em] uppercase mb-4 shadow-lg shadow-emerald-500/10">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>PORTAL REVEAL • GASTRONOMY IN MOTION</span>
          </div>

          <h2 className="max-w-3xl text-4xl sm:text-6xl md:text-7xl font-extrabold font-display uppercase tracking-tight text-white leading-tight">
            STEPPING INTO THE <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-emerald-300">
              LIVING MENU
            </span>
          </h2>

          <p className="mt-4 max-w-xl text-base sm:text-lg text-emerald-100/70 font-sans">
            Scroll continuously to enter the curated courses arranged in spatial editorial 3D.
          </p>

          <div className="mt-8 flex items-center gap-3 font-mono text-xs text-amber-400 tracking-widest uppercase">
            <span className="w-8 h-px bg-amber-400/50" />
            <span>SCROLL TO TRAVERSE APERTURE</span>
            <span className="w-8 h-px bg-amber-400/50" />
          </div>
        </div>
      </div>

      {/* Hero Bottom Scroll Indicator */}
      <a
        href="#food-discovery"
        aria-label="Scroll to food discovery"
        className="absolute z-20 bottom-5 left-1/2 -translate-x-1/2 w-full flex flex-col items-center justify-center text-zinc-500 font-mono text-[10px] uppercase tracking-[0.3em] hover:text-amber-300 transition-colors"
      >
        <span className="mb-2">SCROLL TO DISCOVER</span>
        <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center p-1">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="w-1 h-2 bg-amber-400 rounded-full"
          />
        </div>
      </a>
    </section>
  );
}
