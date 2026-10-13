import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed, Menu, X, Sparkles } from 'lucide-react';
import { ANIMATION_EASING } from '../lib/constants';
import { scrollToSection } from './CinematicScrollProvider';

export default function Navbar({ onOpenDemo }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'HOME', href: '#hero' },
    { name: 'FEATURES', href: '#features' },
    { name: 'HOW IT WORKS', href: '#how-it-works' },
    { name: 'REVIEWS', href: '#testimonials' },
    { name: 'PRICING', href: '#pricing' },
  ];

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -4 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: 'easeOut',
      },
    },
  };

  return (
    <motion.header
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'py-3 bg-[#07080c]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/50'
          : 'py-6 bg-transparent border-b border-white/5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Left: Brand Logo & Wordmark */}
        <motion.a
          href="#hero"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('#hero');
          }}
          variants={itemVariants}
          whileHover={{ scale: 1.04, rotate: 2 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex items-center gap-3 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 via-amber-400/30 to-amber-200/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10 group-hover:border-amber-400/60 transition-colors">
            <UtensilsCrossed className="w-5 h-5 text-amber-400 group-hover:text-amber-300 transition-colors" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-lg tracking-widest text-white font-display uppercase leading-tight">
              SMART <span className="text-amber-400 font-bold">MENU</span>
            </span>
            <span className="text-[9px] tracking-[0.25em] text-zinc-400 font-mono uppercase">
              Next-Gen Dining
            </span>
          </div>
        </motion.a>

        {/* Center: Desktop Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <motion.a
              key={link.name}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                scrollToSection(link.href);
              }}
              variants={itemVariants}
              className="relative text-xs tracking-widest text-zinc-300 font-mono hover:text-amber-400 transition-colors py-1 group cursor-pointer"
            >
              {link.name}
              <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-amber-400 transition-all duration-250 group-hover:w-full" />
            </motion.a>
          ))}
        </nav>

        {/* Right: CTA Button */}
        <motion.div variants={itemVariants} className="hidden md:flex items-center gap-4">
          <motion.button
            onClick={onOpenDemo}
            whileHover={{ y: -1, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative group overflow-hidden px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-semibold text-xs tracking-wider uppercase font-mono shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-black animate-pulse" />
            <span>GET STARTED</span>
          </motion.button>
        </motion.div>

        {/* Mobile Menu Toggle Button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-zinc-300 hover:text-white rounded-lg bg-white/5 border border-white/10"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0a0b10]/95 backdrop-blur-2xl border-b border-white/10 px-6 py-6 flex flex-col gap-4"
          >
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  scrollToSection(link.href);
                }}
                className="text-sm font-mono tracking-widest text-zinc-300 hover:text-amber-400 py-2 border-b border-white/5 cursor-pointer"
              >
                {link.name}
              </a>
            ))}
            <button
              onClick={() => {
                setMobileOpen(false);
                if (onOpenDemo) onOpenDemo();
              }}
              className="mt-2 w-full py-3 rounded-xl bg-amber-400 text-black font-mono font-bold text-xs tracking-wider uppercase shadow-lg shadow-amber-500/20"
            >
              GET STARTED
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
