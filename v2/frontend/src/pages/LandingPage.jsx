import React, { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import CinematicScrollProvider from '../components/CinematicScrollProvider';
import Hero from '../components/Hero';
import FoodDiscoveryScroll from '../sections/FoodDiscoveryScroll';
import ProblemSection from '../sections/ProblemSection';
import ProductShowcase from '../sections/ProductShowcase';
import HowItWorks from '../sections/HowItWorks';
import TestimonialsSection from '../sections/TestimonialsSection';
import PricingSection from '../sections/PricingSection';
import FinalCTASection from '../sections/FinalCTASection';
import Footer from '../components/Footer';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage({ onOpenDemo, onOpenSignIn }) {
  const handleSignInRoute = onOpenSignIn || onOpenDemo;

  useEffect(() => {
    // Immediate calculation without delaying initial paint
    ScrollTrigger.refresh();

    if (document.fonts) {
      document.fonts.ready.then(() => {
        ScrollTrigger.refresh();
      });
    }

    const handleResize = () => {
      ScrollTrigger.refresh();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <CinematicScrollProvider>
      <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-amber-400 selection:text-black relative overflow-x-clip">
        {/* 1. HERO SECTION WITH PINNED CIRCULAR IRIS PORTAL */}
        <Hero onOpenDemo={onOpenDemo} onOpenSignIn={handleSignInRoute} />

        {/* 2. FOOD DISCOVERY EDITORIAL 3D COMPOSITION */}
        <FoodDiscoveryScroll />

        {/* 3. THE PROBLEM WITH TRADITIONAL MENUS */}
        <ProblemSection />

        {/* 4. SMART MENU PRODUCT SHOWCASE */}
        <ProductShowcase />

        {/* 5. HOW IT WORKS */}
        <HowItWorks />

        {/* 6. RESTAURANT TESTIMONIALS */}
        <TestimonialsSection />

        {/* 10. PRICING */}
        <PricingSection onOpenDemo={handleSignInRoute} />

        {/* 11. FINAL CTA */}
        <FinalCTASection onOpenDemo={handleSignInRoute} />

        {/* 12. FOOTER */}
        <Footer />
      </div>
    </CinematicScrollProvider>
  );
}
