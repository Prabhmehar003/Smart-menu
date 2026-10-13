import React from 'react';
import { UtensilsCrossed, Shield, Globe, Cpu } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#030305] border-t border-white/10 text-zinc-400 font-mono text-xs py-16">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        {/* Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-semibold text-lg tracking-widest text-white font-display uppercase">
              SMART <span className="text-amber-400 font-bold">MENU</span>
            </span>
          </div>
          <p className="text-zinc-500 text-xs font-sans leading-relaxed">
            The premium 3D digital menu technology platform for modern restaurants, hotel dining & bistros.
          </p>
        </div>

        {/* Product Navigation */}
        <div className="space-y-3">
          <span className="text-white font-bold uppercase tracking-wider text-xs block mb-4">PRODUCT</span>
          <a href="#features" className="block hover:text-amber-400 transition-colors">Platform Features</a>
          <a href="#how-it-works" className="block hover:text-amber-400 transition-colors">How It Works</a>
          <a href="#pricing" className="block hover:text-amber-400 transition-colors">Pricing Plans</a>
        </div>

        {/* Solution */}
        <div className="space-y-3">
          <span className="text-white font-bold uppercase tracking-wider text-xs block mb-4">RESOURCES</span>
          <a href="#problem" className="block hover:text-amber-400 transition-colors">Paper vs Digital</a>
          <a href="#testimonials" className="block hover:text-amber-400 transition-colors">Chef Case Studies</a>
          <a href="/admin" className="block hover:text-amber-400 transition-colors">Admin Dashboard Portal</a>
        </div>

        {/* Security & System */}
        <div className="space-y-4">
          <span className="text-white font-bold uppercase tracking-wider text-xs block mb-4">SYSTEM STATUS</span>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>All Systems Operational</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">99.99% Uptime SLA • WebSocket Live Sync</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-zinc-500 gap-4">
        <span>© {new Date().getFullYear()} SMART MENU PLATFORM INC. ALL RIGHTS RESERVED.</span>
        <div className="flex items-center gap-6 text-[11px]">
          <a href="#" className="hover:text-amber-400">Privacy Policy</a>
          <a href="#" className="hover:text-amber-400">Terms of Service</a>
          <a href="#" className="hover:text-amber-400">Security</a>
        </div>
      </div>
    </footer>
  );
}
