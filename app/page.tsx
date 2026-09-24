'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [onDark, setOnDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Refs for scroll observers and carousel
  const navRef = useRef<HTMLElement>(null);
  const resultsStageRef = useRef<HTMLDivElement>(null);
  const powerprepRef = useRef<HTMLElement>(null);
  const bookStackRef = useRef<HTMLDivElement>(null);
  const aiVisualRef = useRef<HTMLDivElement>(null);
  const courseCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Carousel state
  const [ri, setRi] = useState(0); // active slide index
  const carouselTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inViewRef = useRef(false);
  const pressedRef = useRef(false);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const startXRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const riRef = useRef(0);
  riRef.current = ri;

  const N = 6;
  const half = Math.floor(N / 2);

  // Nav Scroll and Dark Zone Detection
  useEffect(() => {
    let ticking = false;
    let isScrolled = false;
    let isDark = false;

    const updateNav = () => {
      const y = window.scrollY;
      if (!isScrolled && y > 50) {
        isScrolled = true;
        setScrolled(true);
      } else if (isScrolled && y < 16) {
        isScrolled = false;
        setScrolled(false);
      }

      if (navRef.current) {
        const darkZones = Array.from(document.querySelectorAll('.ai-section, footer'));
        const r = navRef.current.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        const dark = darkZones.some((el) => {
          const b = el.getBoundingClientRect();
          return b.top <= mid && b.bottom >= mid;
        });

        if (dark !== isDark) {
          isDark = dark;
          setOnDark(dark);
        }
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateNav);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    updateNav();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Body lock when mobile menu opens
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  }, [mobileMenuOpen]);

  // Escape key closes mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Course cards IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, idx) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              entry.target.classList.add('in');
            }, idx * 100);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    courseCardsRef.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);

  // Powerprep section lift-up & animation play-state IntersectionObserver
  useEffect(() => {
    if (!powerprepRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('in', entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(powerprepRef.current);
    return () => observer.disconnect();
  }, []);

  // Book stack reveal IntersectionObserver
  useEffect(() => {
    if (!bookStackRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(bookStackRef.current);
    return () => observer.disconnect();
  }, []);

  // Carousel timer scheduler
  const scheduleCarousel = useCallback((delay: number) => {
    if (carouselTimerRef.current) clearTimeout(carouselTimerRef.current);
    if (!inViewRef.current || document.hidden) return;
    carouselTimerRef.current = setTimeout(() => {
      setRi((prev) => (prev + 1) % N);
    }, delay);
  }, [N]);

  const goCarousel = useCallback(
    (n: number, manual = false) => {
      const nextIndex = ((n % N) + N) % N;
      setRi(nextIndex);
      scheduleCarousel(manual ? 6000 : 4200);
    },
    [N, scheduleCarousel]
  );

  // Carousel visibility observer
  useEffect(() => {
    if (!resultsStageRef.current) return;
    const stage = resultsStageRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries[0].isIntersecting;
        if (inViewRef.current) {
          scheduleCarousel(2500);
        } else if (carouselTimerRef.current) {
          clearTimeout(carouselTimerRef.current);
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(stage);

    const handleVis = () => {
      if (document.hidden) {
        if (carouselTimerRef.current) clearTimeout(carouselTimerRef.current);
      } else {
        scheduleCarousel(3000);
      }
    };
    document.addEventListener('visibilitychange', handleVis);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVis);
      if (carouselTimerRef.current) clearTimeout(carouselTimerRef.current);
    };
  }, [scheduleCarousel]);

  // Pointer drag/tilt handlers for Carousel
  const resetTilt = () => {
    if (!resultsStageRef.current) return;
    resultsStageRef.current.classList.remove('tilting');
    const slides = Array.from(resultsStageRef.current.querySelectorAll('.result-slide')) as HTMLElement[];
    slides.forEach((s) => {
      const el = s.firstElementChild as HTMLElement;
      if (el) {
        el.style.removeProperty('--tx');
        el.style.removeProperty('--ty');
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
      }
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressedRef.current = true;
    draggingRef.current = false;
    startXRef.current = e.clientX;
    pointerIdRef.current = e.pointerId;
    if (carouselTimerRef.current) clearTimeout(carouselTimerRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pressedRef.current) {
      const dx = e.clientX - startXRef.current;
      if (!draggingRef.current && Math.abs(dx) > 8) {
        draggingRef.current = true;
        resetTilt();
        if (resultsStageRef.current) {
          resultsStageRef.current.classList.add('dragging');
          try {
            resultsStageRef.current.setPointerCapture(e.pointerId);
          } catch (_) {}
        }
      }
      if (draggingRef.current && resultsStageRef.current) {
        resultsStageRef.current.style.setProperty('--drag', `${dx * 0.85}px`);
      }
      return;
    }

    // Hover tilt on active card
    if (e.pointerType !== 'mouse' || !resultsStageRef.current) return;
    const stage = resultsStageRef.current;
    const activeSlide = stage.querySelector('.result-slide.active') as HTMLElement;
    if (!activeSlide) return;

    const r = activeSlide.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;

    if (x < 0 || x > 1 || y < 0 || y > 1) {
      resetTilt();
      return;
    }

    const el = activeSlide.firstElementChild as HTMLElement;
    if (el) {
      el.style.setProperty('--ty', `${((x - 0.5) * 10).toFixed(2)}deg`);
      el.style.setProperty('--tx', `${((0.5 - y) * 10).toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      stage.classList.add('tilting');
    }
  };

  const endPress = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    if (draggingRef.current) {
      const dx = e.clientX - startXRef.current;
      draggingRef.current = false;
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 80);

      if (resultsStageRef.current) {
        resultsStageRef.current.classList.remove('dragging');
        resultsStageRef.current.style.setProperty('--drag', '0px');
      }

      if (!cancelled && dx < -45) {
        goCarousel(riRef.current + 1, true);
      } else if (!cancelled && dx > 45) {
        goCarousel(riRef.current - 1, true);
      } else {
        scheduleCarousel(4200);
      }
    } else {
      scheduleCarousel(4200);
    }
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) return;
    if ((e.target as HTMLElement).closest('a')) return;

    const targetSlide = (e.target as HTMLElement).closest('.result-slide') as HTMLElement;
    if (!targetSlide) return;

    const d = parseFloat(targetSlide.style.getPropertyValue('--d') || '0');
    goCarousel(riRef.current + (d < 0 ? -1 : 1), true);
  };

  const handleKeyDownStage = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goCarousel(riRef.current + 1, true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goCarousel(riRef.current - 1, true);
    }
  };

  // Powerprep Logo Interactive Mouse Tilt
  const handleAIVisualMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !aiVisualRef.current) return;
    const ring = aiVisualRef.current.querySelector('.ai-logo-ring') as HTMLElement;
    if (!ring) return;

    const r = aiVisualRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;

    ring.style.setProperty('--ry', `${(x * 18).toFixed(2)}deg`);
    ring.style.setProperty('--rx', `${(-y * 18).toFixed(2)}deg`);
  };

  const handleAIVisualLeave = () => {
    if (!aiVisualRef.current) return;
    const ring = aiVisualRef.current.querySelector('.ai-logo-ring') as HTMLElement;
    if (ring) {
      ring.style.setProperty('--rx', '0deg');
      ring.style.setProperty('--ry', '0deg');
    }
  };

  return (
    <>
      {/* Global CSS extracted directly from homepage-final.html */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');

        :root {
          --navy: #0d1b3e;
          --navy-2: #152352;
          --cream: #fbf7ef;
          --paper: #ffffff;
          --gold: #e0a63a;
          --gold-dark: #c98a1f;
          --maroon: #8a2a4a;
          --ink: #2b2f45;
          --ink-dim: #6b7290;
          --line: #e7e1d3;
          --ease: cubic-bezier(.22, 1, .36, 1);
          --nav-h: 72px;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; scroll-padding-top: 96px; }
        body { background: var(--cream); color: var(--ink); font-family: 'Inter', sans-serif; overflow-x: hidden; padding-top: var(--nav-h); }
        .serif { font-family: 'Fraunces', serif; }
        img { max-width: 100%; display: block; }
        section { position: relative; }

        /* NAV */
        @media (max-width: 768px) {
          nav.concept-nav {
            -webkit-backdrop-filter: blur(10px) saturate(140%) !important;
            backdrop-filter: blur(10px) saturate(140%) !important;
          }
          nav.concept-nav.scrolled {
            -webkit-backdrop-filter: blur(10px) saturate(160%) brightness(1.04) !important;
            backdrop-filter: blur(10px) saturate(160%) brightness(1.04) !important;
          }
        }

        nav.concept-nav {
          position: fixed; top: 0; left: 0; right: 0; margin: 0 auto; z-index: 80;
          width: calc(100% - 0px); max-width: 100%; overflow: hidden;
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px;
          background-color: rgba(251, 247, 239, 0.78);
          -webkit-backdrop-filter: blur(14px) saturate(140%); backdrop-filter: blur(14px) saturate(140%);
          border: 1px solid transparent; border-bottom-color: rgba(13, 27, 62, 0.08); border-radius: 0;
          box-shadow: 0 8px 24px -10px rgba(13,27,62,0), 0 2px 8px rgba(13,27,62,0), inset 0 1px 0 rgba(255,255,255,0), inset 0 -1px 0 rgba(255,255,255,0);
          transition:
            top .7s var(--ease), width .7s var(--ease), max-width .7s var(--ease),
            padding .7s var(--ease), border-radius .7s var(--ease),
            background-color .5s ease, border-color .5s ease, box-shadow .7s ease,
            -webkit-backdrop-filter .7s ease, backdrop-filter .7s ease;
          will-change: transform;
        }
        nav.concept-nav::before, nav.concept-nav::after {
          content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: -1;
          opacity: 0; transition: opacity .6s ease;
        }
        nav.concept-nav::before {
          background:
            radial-gradient(130% 260% at 0% 0%, rgba(255,255,255,.85) 0%, rgba(255,255,255,0) 52%),
            radial-gradient(90% 200% at 100% 100%, rgba(224,166,58,.16) 0%, rgba(224,166,58,0) 60%),
            linear-gradient(180deg, rgba(255,255,255,.4), rgba(255,255,255,0) 65%);
        }
        nav.concept-nav::after {
          background:
            radial-gradient(130% 260% at 0% 0%, rgba(255,255,255,.26) 0%, rgba(255,255,255,0) 55%),
            radial-gradient(90% 200% at 100% 100%, rgba(224,166,58,.22) 0%, rgba(224,166,58,0) 60%),
            linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,0) 60%);
        }
        nav.concept-nav.scrolled {
          top: 14px; width: calc(100% - 28px); max-width: 960px;
          border-radius: 999px; border-color: rgba(255,255,255,0.75);
          background-color: rgba(251,247,239,0.30);
          -webkit-backdrop-filter: blur(26px) saturate(190%) brightness(1.06); backdrop-filter: blur(26px) saturate(190%) brightness(1.06);
          box-shadow: 0 8px 24px -10px rgba(13,27,62,0.35), 0 2px 8px rgba(13,27,62,0.06), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.35);
          padding: 10px 22px;
        }
        nav.concept-nav.scrolled::before { opacity: 1; }
        nav.concept-nav.on-dark { background-color: rgba(13,27,62,0.55); border-bottom-color: rgba(255,255,255,0.14); }
        nav.concept-nav.scrolled.on-dark {
          background-color: rgba(13,27,62,0.38); border-color: rgba(255,255,255,0.24);
          box-shadow: 0 8px 24px -10px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(255,255,255,0.08);
        }
        nav.concept-nav.scrolled.on-dark::before { opacity: 0; }
        nav.concept-nav.scrolled.on-dark::after { opacity: 1; }
        nav.concept-nav.on-dark .brand-name { color: var(--cream); }
        nav.concept-nav.on-dark .nav-toggle span { background: var(--cream); }

        .brand { display: flex; align-items: center; gap: 10px; }
        .brand-mark { width: 42px; height: 42px; border-radius: 50%; overflow: hidden; flex-shrink: 0; transition: width .7s var(--ease), height .7s var(--ease); }
        nav.concept-nav.scrolled .brand-mark { width: 36px; height: 36px; }
        .brand-name { font-family: 'Fraunces', serif; font-weight: 700; font-optical-sizing: none; font-variation-settings: 'opsz' 40; font-size: 17px; color: var(--navy); text-transform: uppercase; letter-spacing: 0.01em; transition: color .4s ease; }
        .brand-name em { font-style: normal; color: var(--gold-dark); }
        .nav-links-desktop { display: none; }
        .nav-cta-desktop { display: none; }
        .nav-toggle { display: flex; flex-direction: column; gap: 5px; background: none; border: none; padding: 8px; cursor: pointer; z-index: 70; }
        .nav-toggle span { width: 22px; height: 2px; background: var(--navy); border-radius: 2px; transition: transform .5s var(--ease), opacity .25s ease, background-color .4s ease; }
        .nav-toggle.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .nav-toggle.open span:nth-child(2) { opacity: 0; transform: scaleX(.2); }
        .nav-toggle.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

        /* menu open */
        body.menu-open { overflow: hidden; }
        body.menu-open nav.concept-nav {
          background-color: rgba(251,247,239,0) !important; border-color: transparent !important; box-shadow: none !important;
          -webkit-backdrop-filter: blur(0px) saturate(100%) !important; backdrop-filter: blur(0px) saturate(100%) !important;
        }
        body.menu-open nav.concept-nav::before, body.menu-open nav.concept-nav::after { opacity: 0 !important; }
        body.menu-open .brand-name { color: var(--cream) !important; }
        body.menu-open .nav-toggle span { background: var(--cream) !important; }

        .mobile-menu {
          position: fixed; inset: 0; z-index: 65; background: var(--navy);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
          clip-path: circle(0% at calc(100% - 40px) 40px);
          visibility: hidden; pointer-events: none;
          transition: clip-path .8s cubic-bezier(.77,0,.18,1), visibility 0s linear .8s;
        }
        .mobile-menu.open {
          clip-path: circle(150% at calc(100% - 40px) 40px);
          visibility: visible; pointer-events: auto;
          transition: clip-path .8s cubic-bezier(.77,0,.18,1), visibility 0s;
        }
        .mobile-menu a {
          color: var(--cream); text-decoration: none; font-family: 'Fraunces', serif; font-size: 22px;
          opacity: 0; transform: translateY(24px);
          transition: opacity .35s ease, transform .5s var(--ease);
        }
        .mobile-menu.open a { opacity: 1; transform: none; }
        .mobile-menu.open a:nth-child(1) { transition-delay: .28s; }
        .mobile-menu.open a:nth-child(2) { transition-delay: .34s; }
        .mobile-menu.open a:nth-child(3) { transition-delay: .40s; }
        .mobile-menu.open a:nth-child(4) { transition-delay: .46s; }
        .mobile-menu.open a:nth-child(5) { transition-delay: .52s; }
        .mobile-menu.open a:nth-child(6) { transition-delay: .58s; }
        .mm-cta { padding: 13px 30px; background: var(--gold); color: var(--navy) !important; border-radius: 6px; font-weight: 600; font-family: 'Inter', sans-serif !important; font-size: 16px !important; text-decoration: none; margin-top: 6px; }

        /* HERO */
        .hero { padding: 44px 20px 40px; text-align: left; }
        .hero-eyebrow {
          font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.1em;
          color: var(--gold-dark); text-transform: uppercase; margin-bottom: 14px;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .hero-eyebrow::before { content: ''; width: 16px; height: 1px; background: var(--gold-dark); }
        h1.headline { font-family: 'Fraunces', serif; font-weight: 700; font-size: clamp(2rem, 8.5vw, 2.5rem); line-height: 1.14; color: var(--navy); letter-spacing: -0.01em; }
        h1.headline .accent { color: var(--maroon); font-style: italic; font-weight: 600; }
        .hero-sub { margin-top: 16px; font-size: 15px; line-height: 1.6; color: var(--ink-dim); max-width: 480px; }
        .hero-cta { margin-top: 24px; }
        .btn-primary {
          padding: 15px 30px; background: var(--gold); color: var(--navy);
          text-decoration: none; font-weight: 600; font-size: 14.5px; border-radius: 8px;
          display: inline-block; border: none; cursor: pointer; box-shadow: 0 10px 24px -10px rgba(224,166,58,0.55);
        }
        .btn-outline {
          padding: 14px 26px; border: 1.5px solid var(--navy); color: var(--navy);
          text-decoration: none; font-size: 14.5px; border-radius: 8px; background: none;
          display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 500;
        }

        /* Stat Strip */
        .stat-strip {
          margin-top: 34px; display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
          background: var(--line); border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
        }
        .stat-cell { background: var(--paper); padding: 16px 14px; }
        .stat-cell .st-label { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; letter-spacing: 0.06em; color: var(--ink-dim); text-transform: uppercase; }
        .stat-cell .st-val { font-family: 'Fraunces', serif; font-weight: 600; font-size: 14.5px; color: var(--navy); margin-top: 4px; line-height: 1.3; }

        /* SECTION HEAD */
        .section-head { padding: 64px 20px 0; text-align: center; }
        .kicker { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.1em; color: var(--gold-dark); text-transform: uppercase; }
        .section-title { font-family: 'Fraunces', serif; font-weight: 700; font-size: clamp(1.5rem, 6.5vw, 2rem); margin-top: 12px; color: var(--navy); line-height: 1.2; }
        .section-title em { font-style: italic; color: var(--maroon); font-weight: 600; }
        .results-head .section-title { font-size: clamp(2rem, 9vw, 2.9rem); }
        @media (min-width: 900px) { .results-head .section-title { font-size: clamp(2.4rem, 4.4vw, 3.4rem); } }
        .section-desc { margin-top: 12px; color: var(--ink-dim); font-size: 14px; line-height: 1.6; max-width: 480px; margin-left: auto; margin-right: auto; }

        /* COURSES */
        .course-grid { margin: 34px 20px 0; display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 600px) { .course-grid { grid-template-columns: 1fr 1fr; } }
        .course-card {
          background: var(--paper); border: 1px solid var(--line); border-radius: 14px; padding: 24px 20px;
          opacity: 0; transform: translateY(18px); transition: opacity .6s ease, transform .7s var(--ease), box-shadow .4s ease, border-color .4s ease;
        }
        .course-card.in { opacity: 1; transform: translateY(0); }
        .course-card .c-icon {
          width: 52px; height: 52px; border-radius: 12px; background: rgba(224,166,58,0.14);
          display: flex; align-items: center; justify-content: center; font-family: 'IBM Plex Mono', monospace;
          font-size: 13px; color: var(--gold-dark); font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; padding: 0 6px;
        }
        .course-card h3 { font-family: 'Fraunces', serif; font-weight: 800; font-optical-sizing: none; font-variation-settings: 'opsz' 40; font-size: 17.5px; color: var(--navy); margin-top: 16px; }
        .beta-badge {
          display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px;
          background: rgba(224,166,58,0.16); color: var(--gold-dark); font-family: 'IBM Plex Mono', monospace;
          font-size: 9.5px; letter-spacing: 0.08em; font-weight: 600; vertical-align: middle; position: relative; top: -2px;
        }
        .course-card p { font-size: 13px; color: var(--ink-dim); margin-top: 8px; line-height: 1.55; }

        /* ERP ICONS */
        .c-icon.erp-icon { padding: 0; transition: background-color .4s ease, transform .5s var(--ease); }
        .erp-icon svg {
          width: 28px; height: 28px; fill: none; stroke: var(--navy); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;
          opacity: 0; transform: scale(.5) rotate(-14deg);
          transition: transform .7s cubic-bezier(.34, 1.56, .64, 1), opacity .4s ease;
        }
        .erp-icon svg .acc { stroke: var(--gold-dark); transition: stroke .3s ease; }
        .erp-icon svg .fill { fill: var(--gold-dark); stroke: none; transition: fill .3s ease; }
        .course-card.in .erp-icon svg { opacity: 1; transform: none; transition-delay: .3s; }
        #about-erp .course-card.in:hover { transform: translateY(-5px); box-shadow: 0 22px 40px -22px rgba(13,27,62,.35); border-color: rgba(224,166,58,.5); }
        #about-erp .course-card.in:hover .erp-icon { background: var(--gold); }
        #about-erp .course-card.in:hover .erp-icon svg { transform: scale(1.12) rotate(-6deg); transition-delay: 0s; }
        #about-erp .course-card.in:hover .erp-icon svg .acc { stroke: var(--maroon); }
        #about-erp .course-card.in:hover .erp-icon svg .fill { fill: var(--maroon); }

        /* RESULTS CAROUSEL — coverflow */
        .results-wrap { margin: 24px 0 0; padding: 36px 20px 56px; overflow: hidden; }
        .results-stage {
          position: relative; max-width: 420px; margin: 0 auto; aspect-ratio: 1/1;
          perspective: 1400px; cursor: pointer; touch-action: pan-y;
          -webkit-user-select: none; user-select: none; outline: none; --drag: 0px;
        }
        .results-stage:focus-visible { outline: 2px solid var(--gold); outline-offset: 10px; border-radius: 22px; }
        .result-slide {
          position: absolute; inset: 0; border-radius: 18px; --d: 0; --abs: 0;
          transform: translate3d(calc(var(--d) * 62% + var(--drag)), 0, 0) rotateY(calc(var(--d) * -26deg)) scale(calc(1 - var(--abs) * .14));
          opacity: 1; filter: brightness(.6) saturate(.9);
          box-shadow: 0 24px 50px -20px rgba(13,27,62,0.4);
          transition: transform .95s cubic-bezier(.22, 1.15, .36, 1), opacity .6s ease, filter .6s ease;
          will-change: transform, opacity;
          -webkit-backface-visibility: hidden; backface-visibility: hidden;
        }
        .result-slide.active { opacity: 1; filter: none; box-shadow: 0 34px 60px -22px rgba(13,27,62,0.5); }
        .result-slide[data-abs="2"] { opacity: 0; pointer-events: none; }
        .result-slide:not(.active) a { pointer-events: none; }
        .results-stage.dragging { cursor: grabbing; }
        .results-stage.dragging .result-slide { transition: opacity .6s ease, filter .6s ease; }

        .rs-inner {
          position: absolute; inset: 0; border-radius: inherit; overflow: hidden; background: var(--paper);
          transform: perspective(900px) rotateX(var(--tx, 0deg)) rotateY(var(--ty, 0deg));
          transition: transform .6s var(--ease);
        }
        .rs-inner::after {
          content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .4s ease;
          background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,.3), transparent 55%);
        }
        .results-stage.tilting .result-slide.active .rs-inner::after { opacity: 1; }
        .result-slide img {
          width: 100%; height: 100%; object-fit: cover; -webkit-user-drag: none;
          transform: scale(1.14); transition: transform 1.4s var(--ease);
        }
        .result-slide.active img { transform: scale(1); }

        .result-slide.is-more .rs-inner {
          background: linear-gradient(160deg, var(--navy), #1c2c5c);
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 30px;
        }
        .result-slide.is-more .rm-title { font-family: 'Fraunces', serif; font-style: italic; font-size: 32px; color: var(--gold); margin-bottom: 14px; }
        .result-slide.is-more .rm-sub { color: var(--cream); font-size: 14px; line-height: 1.6; max-width: 280px; }
        .result-slide.is-more .rm-cta { margin-top: 22px; }
        .rm-title, .rm-sub, .rm-cta { opacity: 0; transform: translateY(16px); transition: opacity .5s ease, transform .8s var(--ease); }
        .result-slide.active .rm-title, .result-slide.active .rm-sub, .result-slide.active .rm-cta { opacity: 1; transform: none; }
        .result-slide.active .rm-title { transition-delay: .3s; }
        .result-slide.active .rm-sub { transition-delay: .42s; }
        .result-slide.active .rm-cta { transition-delay: .54s; }

        /* POWERPREP — lift-up on scroll & gated animations */
        .ai-glow, .ai-ripple, .ai-arc, .ai-dash-ring, .ai-dash-ring-2, .ai-orbit, .ai-chip span, .ai-orbit-dots, .ai-spark, .ai-logo-ring img {
          animation-play-state: paused;
        }
        .ai-section.in .ai-glow,
        .ai-section.in .ai-ripple,
        .ai-section.in .ai-arc,
        .ai-section.in .ai-dash-ring,
        .ai-section.in .ai-dash-ring-2,
        .ai-section.in .ai-orbit,
        .ai-section.in .ai-chip span,
        .ai-section.in .ai-orbit-dots,
        .ai-section.in .ai-spark,
        .ai-section.in .ai-logo-ring img {
          animation-play-state: running;
        }

        .ai-section {
          margin: 70px 0 0; padding: 60px 20px 70px;
          background: linear-gradient(180deg, var(--navy), var(--navy-2));
          color: var(--cream);
          opacity: 0; transform: translateY(50px); transition: opacity .9s ease, transform .9s ease;
        }
        .ai-section.in { opacity: 1; transform: translateY(0); }
        .ai-visual { display: flex; align-items: center; justify-content: center; margin-bottom: 32px; perspective: 900px; }
        .ai-logo-ring {
          position: relative; width: 280px; height: 280px; display: flex; align-items: center; justify-content: center;
          transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); transition: transform .5s var(--ease);
        }
        .ai-glow {
          position: absolute; inset: 50px; border-radius: 50%;
          background: radial-gradient(circle, rgba(138,42,74,.8), rgba(224,166,58,.28) 55%, transparent 72%);
          filter: blur(18px); animation: breathe 4.5s ease-in-out infinite, glowPulse 6s ease-in-out infinite;
        }
        @keyframes breathe { 0%,100% { opacity: .65; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes glowPulse { 0%,100% { opacity: .65; transform: scale(1); } 50% { opacity: .95; transform: scale(1.15); } }

        /* sonar ripples */
        .ai-ripple { position: absolute; inset: 70px; border-radius: 50%; border: 1.5px solid rgba(224,166,58,.6); opacity: 0; animation: ripple 5.4s cubic-bezier(.2,.6,.3,1) infinite; }
        .ai-ripple.r2 { animation-delay: 1.8s; border-color: rgba(227,154,176,.55); }
        .ai-ripple.r3 { animation-delay: 3.6s; }
        @keyframes ripple { 0% { transform: scale(.7); opacity: 0; } 15% { opacity: .75; } 100% { transform: scale(2); opacity: 0; } }

        /* spinning light arcs */
        .ai-arc {
          position: absolute; border-radius: 50%;
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
                  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
        }
        .ai-arc.a1 { inset: 30px; background: conic-gradient(from 0deg, transparent 0deg, rgba(224,166,58,0) 60deg, rgba(224,166,58,.95) 200deg, #f3c76b 270deg, transparent 300deg); animation: spinCW 5s linear infinite; filter: drop-shadow(0 0 6px rgba(224,166,58,.7)); }
        .ai-arc.a2 { inset: 42px; background: conic-gradient(from 90deg, transparent 0deg, rgba(227,154,176,0) 80deg, rgba(227,154,176,.9) 190deg, transparent 260deg); animation: spinCCW 8.5s linear infinite; filter: drop-shadow(0 0 5px rgba(227,154,176,.6)); }

        .ai-dash-ring { position: absolute; inset: 12px; border-radius: 50%; border: 1px dashed rgba(224,166,58,.42); animation: spinCW 40s linear infinite; }
        .ai-dash-ring-2 { position: absolute; inset: 56px; border-radius: 50%; border: 1px dashed rgba(227,154,176,.4); animation: spinCCW 26s linear infinite; }
        @keyframes spinCW { to { transform: rotate(360deg); } }
        @keyframes spinCCW { to { transform: rotate(-360deg); } }

        /* orbiting subject chips */
        .ai-orbit { position: absolute; inset: 0; animation: spinCW 24s linear infinite; }
        .ai-chip {
          position: absolute; top: 50%; left: 50%; width: 34px; height: 34px; margin: -17px 0 0 -17px;
          transform: rotate(var(--a)) translateX(128px) rotate(calc(var(--a) * -1));
        }
        .ai-chip span {
          width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-family: 'Fraunces', serif; font-style: italic; font-weight: 700; font-size: 16px; color: var(--gold);
          background: rgba(255,255,255,.08); border: 1px solid rgba(224,166,58,.5);
          -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
          box-shadow: 0 0 14px rgba(224,166,58,.35), inset 0 1px 0 rgba(255,255,255,.25);
          animation: spinCCW 24s linear infinite, chipGlow 3s ease-in-out infinite;
        }
        .ai-chip:nth-child(2) span { animation-delay: 0s, .6s; }
        .ai-chip:nth-child(3) span { animation-delay: 0s, 1.2s; }
        .ai-chip:nth-child(4) span { animation-delay: 0s, 1.8s; }
        .ai-chip:nth-child(5) span { animation-delay: 0s, 2.4s; }
        @keyframes chipGlow { 0%,100% { opacity: .8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }

        .ai-orbit-dots { position: absolute; inset: 0; animation: spinCW 10s linear infinite; }
        .ai-orbit-dots .dot { position: absolute; top: 50%; left: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 10px 2px rgba(224,166,58,.7); }
        .ai-orbit-dots .dot:nth-child(1) { transform: rotate(0deg) translateX(84px); }
        .ai-orbit-dots .dot:nth-child(2) { transform: rotate(120deg) translateX(84px); background: #e39ab0; box-shadow: 0 0 10px 2px rgba(227,154,176,.7); }
        .ai-orbit-dots .dot:nth-child(3) { transform: rotate(240deg) translateX(84px); }

        /* twinkles */
        .ai-spark { position: absolute; width: 12px; height: 12px; background: linear-gradient(135deg, #fff3c9, var(--gold)); clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); opacity: 0; animation: twinkle 3.2s ease-in-out infinite; }
        .ai-spark.s1 { top: 8%; left: 14%; } .ai-spark.s2 { top: 16%; right: 8%; animation-delay: .8s; width: 9px; height: 9px; }
        .ai-spark.s3 { bottom: 10%; left: 10%; animation-delay: 1.5s; width: 9px; height: 9px; } .ai-spark.s4 { bottom: 14%; right: 12%; animation-delay: 2.1s; }
        .ai-spark.s5 { top: -1%; left: 52%; animation-delay: 2.7s; width: 8px; height: 8px; } .ai-spark.s6 { top: 54%; right: -1%; animation-delay: 1.1s; width: 8px; height: 8px; }
        @keyframes twinkle { 0%,100% { opacity: 0; transform: scale(.3) rotate(0deg); } 50% { opacity: 1; transform: scale(1.15) rotate(90deg); } }

        .ai-logo-ring img {
          width: 124px; height: 124px; border-radius: 50%; object-fit: cover; position: relative; z-index: 4;
          box-shadow: 0 0 44px rgba(138,42,74,.65), 0 0 0 4px rgba(13,27,62,.92), 0 0 0 5px rgba(224,166,58,.35);
          animation: floatY 5.5s ease-in-out infinite; transition: filter .4s ease;
        }
        .ai-visual:hover .ai-logo-ring img { filter: brightness(1.1) saturate(1.1); }
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        .ai-section .kicker { color: #e39ab0; }
        .ai-section .section-title { color: var(--cream); }
        .ai-section .section-title em { color: var(--gold); }
        .ai-section .section-desc { color: #b9c0dd; }
        .ai-list { margin: 24px auto 0; max-width: 400px; display: flex; flex-direction: column; gap: 12px; text-align: left; }
        .ai-list li { list-style: none; display: flex; gap: 10px; font-size: 14px; color: #dfe3f2; }
        .ai-list li::before { content: '—'; color: var(--gold); flex-shrink: 0; }
        .ai-note { margin: 26px auto 0; max-width: 400px; padding: 14px 16px; border: 1px solid rgba(224,166,58,0.35); border-radius: 8px; font-size: 12.5px; color: #b9c0dd; line-height: 1.6; text-align: center; }
        .ai-note strong { color: var(--cream); }

        /* CLOSING */
        .closing { padding: 70px 20px 60px; text-align: center; background: var(--cream); }
        .book-stack { width: min(320px, 86%); margin: 0 auto 38px; position: relative; padding-bottom: 18px; }
        .book-stack::after {
          content: ''; position: absolute; left: 2%; right: 2%; bottom: 6px; height: 16px; z-index: 0;
          background: radial-gradient(ellipse at center, rgba(13,27,62,.38), transparent 70%); filter: blur(5px);
        }
        .book {
          position: relative; z-index: 1; height: 68px; margin: -3px auto 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: 7px 12px 12px 7px;
          --spine: #15295f; --foil: #f0c56a; --ink1: #fff1bf; --ink2: #e0a63a; --ink3: #b57f1a;
          background:
            repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px),
            linear-gradient(180deg, rgba(255,255,255,.24) 0%, rgba(255,255,255,.06) 22%, rgba(0,0,0,0) 46%, rgba(0,0,0,.3) 100%),
            var(--spine);
          box-shadow:
            0 12px 18px -9px rgba(13,27,62,.55),
            inset 0 1px 0 rgba(255,255,255,.3), inset 0 -3px 0 rgba(0,0,0,.3),
            inset 14px 0 16px -10px rgba(0,0,0,.5), inset -14px 0 16px -10px rgba(0,0,0,.5);
          opacity: 0; transform: translateX(var(--from, -60px)) rotate(var(--rot, 0deg));
          transition: opacity .7s ease var(--dl, 0s), transform .95s var(--ease) var(--dl, 0s), box-shadow .4s ease;
        }
        .book::before, .book::after {
          content: ''; position: absolute; top: 0; bottom: 0; width: 13px; opacity: .9;
          background: linear-gradient(90deg, var(--foil) 0 3px, transparent 3px 9px, var(--foil) 9px 12px, transparent 12px);
          filter: drop-shadow(0 0 1px rgba(0,0,0,.4));
        }
        .book::before { left: 7%; } .book::after { right: 7%; }
        .book span {
          font-family: 'Fraunces', serif; font-weight: 800; font-size: 21px; letter-spacing: .26em; text-indent: .26em; line-height: 1;
          background: linear-gradient(180deg, var(--ink1) 0%, var(--ink2) 55%, var(--ink3) 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 1px 0 rgba(0,0,0,.55)) drop-shadow(0 0 6px rgba(240,197,106,.18));
        }
        .book-stack.in .book { opacity: 1; transform: translateX(var(--shift, 0px)) rotate(var(--rot, 0deg)); }
        .book-stack.in .book:hover { transform: translateX(calc(var(--shift, 0px) + 12px)) rotate(var(--rot, 0deg)); }
        .book:nth-child(1) { width: 92%; --rot: -1.2deg; --shift: -6px; --from: -70px; --dl: .05s; }
        .book:nth-child(2) { width: 100%; --spine: #7c2244; --rot: .8deg; --shift: 8px; --from: 70px; --dl: .25s; }
        .book:nth-child(3) {
          width: 86%; --spine: #c58a22; --foil: #0d1b3e; --ink1: #22357a; --ink2: #0d1b3e; --ink3: #0d1b3e;
          --rot: -.6deg; --shift: -4px; --from: -50px; --dl: .45s;
        }
        .book:nth-child(3) span { filter: drop-shadow(0 1px 0 rgba(255,236,178,.55)); }
        .closing h2 { font-family: 'Fraunces', serif; font-weight: 700; font-size: clamp(1.6rem, 7vw, 2.1rem); color: var(--navy); line-height: 1.2; }
        .closing h2 em { font-style: italic; color: var(--maroon); }
        .closing-sub { margin-top: 12px; color: var(--ink-dim); font-size: 14px; }
        .closing-cta { display: flex; gap: 12px; justify-content: center; margin-top: 26px; flex-wrap: wrap; }

        /* FOOTER */
        footer.concept-footer { background: var(--navy); color: #b9c0dd; padding: 40px 20px 26px; }
        .footer-grid { display: grid; grid-template-columns: 1fr; gap: 28px; }
        .footer-col h4 { font-family: 'Fraunces', serif; font-weight: 700; font-optical-sizing: none; font-variation-settings: 'opsz' 40; color: var(--cream); font-size: 14.5px; margin-bottom: 12px; }
        .footer-col a { display: block; color: #b9c0dd; text-decoration: none; font-size: 13px; margin-bottom: 8px; }
        .footer-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .footer-brand img { width: 36px; height: 36px; border-radius: 50%; }
        .footer-brand span { font-family: 'Fraunces', serif; font-weight: 700; font-optical-sizing: none; font-variation-settings: 'opsz' 40; color: var(--cream); font-size: 16px; text-transform: uppercase; }
        .footer-bottom { margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11.5px; text-align: center; color: #8590b5; }

        /* DESKTOP */
        @media (min-width: 900px) {
          :root { --nav-h: 84px; }
          nav.concept-nav { padding: 18px 6vw; }
          .brand-mark { width: 46px; height: 46px; }
          nav.concept-nav.scrolled .brand-mark { width: 38px; height: 38px; }
          .brand-name { font-size: 19px; }
          .nav-toggle { display: none; }
          .nav-links-desktop { display: flex; gap: 30px; font-size: 14px; color: var(--navy); font-weight: 500; transition: color .4s ease; }
          nav.concept-nav.on-dark .nav-links-desktop { color: var(--cream); }
          nav.concept-nav.on-dark .nav-links-desktop a:hover { color: var(--gold); }
          .nav-links-desktop a { position: relative; color: inherit; text-decoration: none; opacity: .8; transition: opacity .3s ease, color .3s ease; }
          .nav-links-desktop a::after { content: ''; position: absolute; left: 0; right: 0; bottom: -5px; height: 2px; border-radius: 2px; background: var(--gold); transform: scaleX(0); transform-origin: left; transition: transform .5s var(--ease); }
          .nav-links-desktop a:hover { opacity: 1; color: var(--gold-dark); }
          .nav-links-desktop a:hover::after { transform: scaleX(1); }
          .nav-cta-desktop { transition: transform .4s var(--ease), box-shadow .4s ease; }
          .nav-cta-desktop:hover { transform: translateY(-2px); box-shadow: 0 10px 22px -10px rgba(224,166,58,.7); }
          .nav-cta-desktop {
            display: inline-block; padding: 11px 24px; background: var(--gold); color: var(--navy);
            text-decoration: none; font-size: 13.5px; font-weight: 600; border-radius: 8px;
          }

          .hero {
            display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center;
            padding: 70px 6vw 60px;
          }
          h1.headline { font-size: clamp(2.6rem, 4.2vw, 3.8rem); }
          .stat-strip { grid-template-columns: repeat(4, 1fr); margin-top: 44px; }
          .section-head { padding: 110px 6vw 0; max-width: 640px; margin: 0 auto; }
          .course-grid { grid-template-columns: repeat(5, 1fr); margin: 44px 6vw 0; }
          #about-erp .course-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
          .results-wrap { padding: 36px 6vw 56px; }
          .results-stage { max-width: 480px; }
          .ai-section {
            margin: 120px 0 0; padding: 90px 6vw;
            display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; text-align: left;
          }
          .ai-visual { margin-bottom: 0; }
          .ai-list, .ai-note { margin-left: 0; text-align: left; }
          .ai-section .section-desc { margin-left: 0; }
          .closing { padding: 110px 6vw 90px; }
          .footer-grid { grid-template-columns: 1.4fr 1fr 1fr 1fr; padding: 0 6vw; }
          .footer-bottom { margin-left: 6vw; margin-right: 6vw; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* FIXED CAPSULE NAV */}
      <nav
        ref={navRef}
        className={`concept-nav ${scrolled ? 'scrolled' : ''} ${onDark ? 'on-dark' : ''}`}
      >
        <div className="brand">
          <div className="brand-mark">
            <img src="/assets/unnati-logo.png" alt="Unnati Classes" />
          </div>
          <div className="brand-name">
            Unnati <em>Classes</em>
          </div>
        </div>

        <div className="nav-links-desktop">
          <a href="#home">Home</a>
          <a href="#about-erp">About ERP</a>
          <a href="#academics">Academics</a>
          <a href="#powerprep">Unnati Powerprep</a>
          <a href="#contact">Contact</a>
        </div>

        <Link href="/login" className="nav-cta-desktop">
          Login to ERP
        </Link>

        <button
          className={`nav-toggle ${mobileMenuOpen ? 'open' : ''}`}
          id="navToggle"
          aria-label="Menu"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>

      {/* MOBILE MENU OVERLAY */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`} id="mobileMenu">
        <a href="#home" className="mmlink" onClick={() => setMobileMenuOpen(false)}>
          Home
        </a>
        <a href="#about-erp" className="mmlink" onClick={() => setMobileMenuOpen(false)}>
          About ERP
        </a>
        <a href="#academics" className="mmlink" onClick={() => setMobileMenuOpen(false)}>
          Academics
        </a>
        <a href="#powerprep" className="mmlink" onClick={() => setMobileMenuOpen(false)}>
          Unnati Powerprep
        </a>
        <a href="#contact" className="mmlink" onClick={() => setMobileMenuOpen(false)}>
          Contact
        </a>
        <Link href="/login" className="mm-cta" onClick={() => setMobileMenuOpen(false)}>
          Login to ERP
        </Link>
      </div>

      {/* HERO SECTION */}
      <section className="hero" id="home">
        <div>
          <div className="hero-eyebrow">Kalol · CBSE · ICSE · GSEB</div>
          <h1 className="headline">
            A place where <span className="accent">Success is tradition.</span>
          </h1>
          <p className="hero-sub">
            Unnati Classes pairs focused classroom teaching with a modern student portal — so progress is never a mystery, for students or their parents.
          </p>
          <div className="hero-cta">
            <Link href="/login" className="btn-primary">
              Login to ERP
            </Link>
          </div>
          <div className="stat-strip">
            <div className="stat-cell">
              <div className="st-label">Curriculum</div>
              <div className="st-val">CBSE · ICSE · GSEB</div>
            </div>
            <div className="stat-cell">
              <div className="st-label">Classes</div>
              <div className="st-val">1st – 12th (Science)</div>
            </div>
            <div className="stat-cell">
              <div className="st-label">Beyond boards</div>
              <div className="st-val">NDA &amp; JEE Guidance</div>
            </div>
            <div className="stat-cell">
              <div className="st-label">Access</div>
              <div className="st-val">Live ERP for Parents</div>
            </div>
          </div>
        </div>
      </section>

      {/* ACADEMICS SECTION */}
      <section id="academics">
        <div className="section-head">
          <div className="kicker">Academics</div>
          <h2 className="section-title">
            What we <em>teach</em>, clearly laid out.
          </h2>
          <p className="section-desc">
            No guessing what&apos;s on offer — every course we run at Unnati Classes.
          </p>
        </div>
        <div className="course-grid">
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[0] = el; }}
          >
            <div className="c-icon">1–5</div>
            <h3>Class 1–5</h3>
            <p>Building strong fundamentals early — reading, reasoning, and the basics everything else is built on.</p>
          </div>
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[1] = el; }}
          >
            <div className="c-icon">6–10</div>
            <h3>Class 6–10</h3>
            <p>Structured board-exam preparation across CBSE, GSEB, and ICSE.</p>
          </div>
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[2] = el; }}
          >
            <div className="c-icon">SCI</div>
            <h3>Class 11–12 (Science)</h3>
            <p>Physics, Chemistry, and Maths — taught in depth for Science stream students.</p>
          </div>
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[3] = el; }}
          >
            <div className="c-icon">JEE</div>
            <h3>JEE Guidance</h3>
            <p>Focused coaching for JEE aspirants, alongside regular academics.</p>
          </div>
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[4] = el; }}
          >
            <div className="c-icon">NDA</div>
            <h3>NDA &amp; SSB Guidance</h3>
            <p>Dedicated preparation for students aiming for the NDA entrance exam and the SSB interview.</p>
          </div>
        </div>
      </section>

      {/* ABOUT ERP SECTION */}
      <section id="about-erp">
        <div className="section-head">
          <div className="kicker">About ERP</div>
          <h2 className="section-title">
            One portal, <em>everything visible.</em>
          </h2>
          <p className="section-desc">
            Unnati ERP is what runs behind every class we teach — here&apos;s what it actually gives you.
          </p>
        </div>
        <div className="course-grid">
          {/* 1. Attendance */}
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[5] = el; }}
          >
            <div className="c-icon erp-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="5" width="17" height="15.5" rx="3.2" />
                <path d="M8 3v4M16 3v4M3.5 10.2h17" />
                <path className="acc" d="M8.6 15.4l2.4 2.4 4.5-4.7" />
              </svg>
            </div>
            <h3>Attendance</h3>
            <p>Marked in real time, batch by batch — visible to parents the same day.</p>
          </div>

          {/* 2. Fees */}
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[6] = el; }}
          >
            <div className="c-icon erp-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9.5" />
                <path className="acc" d="M8 7.5h8M8 10.5h8M9 7.5c3.4 0 5 1.4 5 3s-1.6 3-5 3l5.2 4" />
              </svg>
            </div>
            <h3>Fees</h3>
            <p>Dues, payment history, and receipts — always current, always visible.</p>
          </div>

          {/* 3. Exams */}
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[7] = el; }}
          >
            <div className="c-icon erp-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4.5" y="2.5" width="15" height="17" rx="2.8" />
                <rect x="8.5" y="2.5" width="7" height="4" rx="1.4" />
                <path d="M8.5 11h7" />
                <path className="acc" d="M8.5 16.2l2.1 2.1 4.1-4.3" />
              </svg>
            </div>
            <h3>Exams</h3>
            <p>Marks published test by test, not buried until the end of term.</p>
          </div>

          {/* 4. Student Portal */}
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[8] = el; }}
          >
            <div className="c-icon erp-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4.5" width="18" height="12.5" rx="2.6" />
                <path d="M8 20.5h8M12 17v3.5" />
                <circle className="acc" cx="12" cy="9.3" r="1.9" />
                <path className="acc" d="M8.7 14c.6-1.6 1.8-2.4 3.3-2.4s2.7.8 3.3 2.4" />
              </svg>
            </div>
            <h3>Student Portal</h3>
            <p>Classwork, homework, and results — one login, built for students.</p>
          </div>

          {/* 5. Live Mock Tests */}
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[9] = el; }}
          >
            <div className="c-icon erp-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9.3" />
                <path className="acc" d="M12 6.8v5.5l3.8 2.2" />
              </svg>
            </div>
            <h3>Live Mock Tests</h3>
            <p>Practice tests and full timed attempts, both available right inside the portal.</p>
          </div>

          {/* 6. Classwork & Homework */}
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[10] = el; }}
          >
            <div className="c-icon erp-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="3" width="14" height="18" rx="2.4" />
                <path d="M8.3 7.5h7.4M8.3 11h7.4" />
                <path className="acc" d="M8.3 14.5h4.5" />
              </svg>
            </div>
            <h3>Classwork &amp; Homework</h3>
            <p>Daily classwork and homework, posted and tracked in one dedicated section.</p>
          </div>

          {/* 7. Live Classes (BETA) */}
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[11] = el; }}
          >
            <div className="c-icon erp-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2.5" y="6" width="14" height="12" rx="2.4" />
                <path className="acc" d="M16.5 10.3l4.6-2.8v9l-4.6-2.8" />
              </svg>
            </div>
            <h3>
              Live Classes<span className="beta-badge">BETA</span>
            </h3>
            <p>Join live class sessions directly from the portal — currently rolling out.</p>
          </div>

          {/* 8. Announcements */}
          <div
            className="course-card"
            ref={(el) => { courseCardsRef.current[12] = el; }}
          >
            <div className="c-icon erp-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 11.5c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8" />
                <path className="acc" d="M4 11.5v3.2a2 2 0 002 2h1.2M12 8.2v3.4l2.4 1.4" />
              </svg>
            </div>
            <h3>Announcements</h3>
            <p>Updates from teachers and admin, sent straight to the right students or batch — no missed notices.</p>
          </div>
        </div>
      </section>

      {/* OUR RESULTS CAROUSEL */}
      <section id="results-section">
        <div className="section-head results-head">
          <h2 className="section-title">
            Real students. <em>Real scores.</em>
          </h2>
          <p className="section-desc">
            A few of the results our students have brought home this year.
          </p>
        </div>
        <div className="results-wrap">
          <div
            ref={resultsStageRef}
            className="results-stage"
            id="resultsStage"
            tabIndex={0}
            role="group"
            aria-roledescription="carousel"
            aria-label="Student results"
            onClick={handleStageClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => endPress(e, false)}
            onPointerCancel={(e) => endPress(e, true)}
            onKeyDown={handleKeyDownStage}
          >
            {[
              { src: '/assets/results/shreyansh-mishra.png', alt: 'Shreyansh Mishra — Class 10th ICSE — 91%' },
              { src: '/assets/results/sadhana-rout.png', alt: 'Sadhana Rout — Class 9th CBSE — 92%' },
              { src: '/assets/results/somodip-mondal.png', alt: 'Somodip Mondal — Class 7th GSEB — 89%' },
              { src: '/assets/results/ketan-das.png', alt: 'Ketan Das — Class 9th CBSE — 82%' },
              { src: '/assets/results/anika-singh.png', alt: 'Anika Singh — Class 7th GSEB — 82%' },
            ].map((slide, i) => {
              const d = ((i - ri + N + half) % N) - half;
              const absD = Math.min(Math.abs(d), 2);
              const isActive = d === 0;

              return (
                <div
                  key={i}
                  className={`result-slide ${isActive ? 'active' : ''}`}
                  style={{
                    ['--d' as string]: Math.max(-2, Math.min(2, d)),
                    ['--abs' as string]: absD,
                    zIndex: 10 - Math.abs(d),
                  }}
                  data-abs={absD}
                  aria-hidden={!isActive}
                >
                  <div className="rs-inner">
                    <img src={slide.src} alt={slide.alt} />
                  </div>
                </div>
              );
            })}

            {/* Slide 5: is-more */}
            {(() => {
              const i = 5;
              const d = ((i - ri + N + half) % N) - half;
              const absD = Math.min(Math.abs(d), 2);
              const isActive = d === 0;

              return (
                <div
                  key={i}
                  className={`result-slide is-more ${isActive ? 'active' : ''}`}
                  style={{
                    ['--d' as string]: Math.max(-2, Math.min(2, d)),
                    ['--abs' as string]: absD,
                    zIndex: 10 - Math.abs(d),
                  }}
                  data-abs={absD}
                  aria-hidden={!isActive}
                >
                  <div className="rs-inner">
                    <div className="rm-title">...and many more.</div>
                    <div className="rm-sub">
                      Every result, every student&apos;s progress — tracked and visible inside the ERP, all year round.
                    </div>
                    <div className="rm-cta">
                      <Link href="/login" className="btn-primary">
                        Login to ERP
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* POWERPREP SECTION */}
      <section id="powerprep" className="ai-section" data-lift ref={powerprepRef}>
        <div
          className="ai-visual"
          ref={aiVisualRef}
          onPointerMove={handleAIVisualMove}
          onPointerLeave={handleAIVisualLeave}
        >
          <div className="ai-logo-ring">
            <div className="ai-glow"></div>
            <div className="ai-ripple r1"></div>
            <div className="ai-ripple r2"></div>
            <div className="ai-ripple r3"></div>
            <div className="ai-dash-ring"></div>
            <div className="ai-dash-ring-2"></div>
            <div className="ai-arc a1"></div>
            <div className="ai-arc a2"></div>
            <div className="ai-orbit">
              <div className="ai-chip" style={{ ['--a' as string]: '0deg' }}>
                <span>Σ</span>
              </div>
              <div className="ai-chip" style={{ ['--a' as string]: '72deg' }}>
                <span>π</span>
              </div>
              <div className="ai-chip" style={{ ['--a' as string]: '144deg' }}>
                <span>√</span>
              </div>
              <div className="ai-chip" style={{ ['--a' as string]: '216deg' }}>
                <span>∫</span>
              </div>
              <div className="ai-chip" style={{ ['--a' as string]: '288deg' }}>
                <span>Δ</span>
              </div>
            </div>
            <div className="ai-orbit-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
            <span className="ai-spark s1"></span>
            <span className="ai-spark s2"></span>
            <span className="ai-spark s3"></span>
            <span className="ai-spark s4"></span>
            <span className="ai-spark s5"></span>
            <span className="ai-spark s6"></span>
            <img src="/assets/unnati-logo.png" alt="Unnati Powerprep" />
          </div>
        </div>
        <div>
          <div className="kicker">The companion</div>
          <h2 className="section-title">
            An AI that studies <em>alongside</em> our students.
          </h2>
          <p className="section-desc">
            Unnati Powerprep lives inside the student portal — built around how we actually teach at Unnati Classes.
          </p>
          <ul className="ai-list">
            <li>Instant doubt-solving, any time</li>
            <li>Step by step maths solutions with PDF download option</li>
            <li>Practice papers from your own syllabus</li>
          </ul>
          <div className="ai-note">
            <strong>Available only inside the student portal.</strong> Powerprep is reserved for enrolled Unnati Classes students and staff.
          </div>
        </div>
      </section>

      {/* CLOSING SECTION */}
      <section className="closing" id="contact">
        <div className="book-stack" ref={bookStackRef}>
          <div className="book">
            <span>DISCIPLINE</span>
          </div>
          <div className="book">
            <span>CREATES</span>
          </div>
          <div className="book">
            <span>FREEDOM</span>
          </div>
        </div>
        <h2>
          Ready to begin your <em>learning journey?</em>
        </h2>
        <p className="closing-sub">Come see the portal in person, or just call and ask.</p>
        <div className="closing-cta">
          <a href="tel:+919510434702" className="btn-outline">
            Call the office &rarr;
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="concept-footer">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <img src="/assets/unnati-logo.png" alt="Unnati Classes" />
              <span>Unnati Classes</span>
            </div>
            <p style={{ fontSize: '13px', lineHeight: '1.6', maxWidth: '260px' }}>
              A place where Success is Tradition. A coaching institute for Kalol&apos;s students, from foundation years through board exams.
            </p>
          </div>
          <div className="footer-col">
            <h4>Quick Links</h4>
            <a href="#home">Home</a>
            <a href="#academics">Academics</a>
            <a href="#powerprep">Unnati Powerprep</a>
          </div>
          <div className="footer-col">
            <h4>Programs</h4>
            <a href="#academics">1st – 10th</a>
            <a href="#academics">11th – 12th Science</a>
            <a href="#academics">NDA / JEE</a>
          </div>
          <div className="footer-col">
            <h4>Contact Us</h4>
            <a href="tel:+919510434702">+91 9510434702</a>
            <a href="mailto:unnaticlasseskalol@gmail.com">unnaticlasseskalol@gmail.com</a>
            <a>F-21, Fortune Empire, Borisana Road, Kalol</a>
          </div>
        </div>
        <div className="footer-bottom">&copy; 2026 Unnati Classes. All rights reserved.</div>
      </footer>
    </>
  );
}
