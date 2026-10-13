import React, { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Accurately calculate the exact target scroll position in pixels for any landing page section.
 * Handles:
 * - Direct landing on Hero (top = 0)
 * - Desktop pinned sections: scrolls past the entrance scrub directly into the active, 100% visible reading window
 * - Mobile / unpinned sections: scrolls to section top offset by the sticky navbar (70px)
 */
export function scrollToSection(href) {
  if (!href) return;
  if (href === '#' || href === '#hero') {
    if (window.__lenis) {
      window.__lenis.scrollTo(0, { duration: 1.1 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return;
  }

  const target = document.querySelector(href);
  if (!target) return;

  const isMobile = window.innerWidth <= 768;
  let targetScrollY = null;

  if (window.__ScrollTrigger) {
    const allTriggers = window.__ScrollTrigger.getAll();
    const st = allTriggers.find((t) => t.trigger === target || (t.pin && t.pin === target));
    if (st) {
      if (!isMobile && st.pin) {
        // Desktop pinned section:
        // st.start is where pinning begins (progress 0.00, entrance animation begins).
        // By ~18-22% into the pin, the entrance animation is complete,
        // all cards and headlines are 100% visible, fully active, and interactive!
        const pinDist = st.end - st.start;
        targetScrollY = st.start + Math.min(pinDist * 0.22, Math.max(280, pinDist * 0.18));
      } else {
        // Mobile or unpinned section: offset by sticky navbar (70px)
        targetScrollY = Math.max(0, st.start - 70);
      }
    }
  }

  if (targetScrollY === null) {
    const rect = target.getBoundingClientRect();
    const currentScroll = window.__lenis ? window.__lenis.scroll : (window.pageYOffset || window.scrollY);
    targetScrollY = Math.max(0, rect.top + currentScroll - (isMobile ? 70 : 0));
  }

  if (window.__lenis) {
    window.__lenis.scrollTo(targetScrollY, {
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
  } else {
    window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
  }
}

export default function CinematicScrollProvider({ children }) {
  const lenisRef = useRef(null);

  useEffect(() => {
    // 1. Prevent browser scroll restoration jitter on refresh
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // 2. Initialize Lenis for smooth, weighted agency-grade scrolling
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    // 3. Synchronize Lenis scroll position with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    // 4. Connect Lenis frame request to GSAP's internal ticker
    const tickerUpdate = (time) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerUpdate);
    gsap.ticker.lagSmoothing(0);

    // 5. Expose globally for direct navbar and anchor calls
    window.__lenis = lenis;
    window.__ScrollTrigger = ScrollTrigger;
    window.__scrollToSection = scrollToSection;

    // 6. Universal smooth anchor link navigation
    const handleAnchorClick = (e) => {
      const target = e.target.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href && href.startsWith('#') && href.length > 1) {
        e.preventDefault();
        scrollToSection(href);
      }
    };

    document.addEventListener('click', handleAnchorClick);

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      gsap.ticker.remove(tickerUpdate);
      lenis.destroy();
      window.__lenis = null;
      window.__ScrollTrigger = null;
      window.__scrollToSection = null;
    };
  }, []);

  return <>{children}</>;
}
