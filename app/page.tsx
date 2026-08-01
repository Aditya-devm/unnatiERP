'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [isReveal, setIsReveal] = useState(false);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Typing animation for "Unnati means progress." and reveal for "Now you can see it."
  useEffect(() => {
    const fullText = "Unnati means progress.";
    let currentIndex = 0;
    
    const timer = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(timer);
        setTimeout(() => {
          setIsReveal(true);
        }, 500);
      }
    }, 55);

    return () => clearInterval(timer);
  }, []);

  // IntersectionObserver for scroll-reveal on feature cards
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              entry.target.classList.add('in');
            }, index * 90);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    featureRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1230] text-[#f6f0e2] font-sans overflow-x-hidden relative">
      {/* CSS Styles extracted from reference design */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        :root {
          --navy: #0a1230;
          --navy-2: #101b42;
          --navy-3: #182658;
          --cream: #f6f0e2;
          --gold: #c99a3f;
          --gold-soft: #e3c384;
          --maroon: #7a2748;
          --ink: #c9d0e8;
          --ink-dim: #8790b3;
        }

        .serif { font-family: 'Fraunces', serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }

        .bg-field {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 700px 500px at 15% 8%, rgba(201,154,63,0.10), transparent 60%),
            radial-gradient(ellipse 600px 600px at 90% 70%, rgba(122,39,72,0.16), transparent 60%);
        }
        .grain {
          position: fixed; inset: 0; z-index: 0; opacity: .04; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        nav.concept-nav {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 6vw;
          background: rgba(10,18,48,0.78);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(201,154,63,0.15);
        }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand-mark {
          width: 56px; height: 56px; border-radius: 50%;
          overflow: hidden; flex-shrink: 0;
        }
        .brand-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .brand-name { font-family: 'Fraunces', serif; font-size: 25px; letter-spacing: 0.03em; text-transform: uppercase; }
        .brand-name em { font-style: normal; color: var(--gold); }
        .nav-right { display: flex; align-items: center; gap: 36px; }
        .nav-links { display: flex; gap: 32px; font-size: 14px; color: var(--ink); }
        .nav-links a { color: inherit; text-decoration: none; opacity: .85; transition: opacity .2s; cursor: pointer; }
        .nav-links a:hover { opacity: 1; color: var(--gold-soft); }
        .nav-cta {
          padding: 10px 22px; border-radius: 2px;
          border: 1px solid var(--gold);
          color: var(--gold-soft); text-decoration: none;
          font-size: 13px; letter-spacing: 0.04em;
          transition: all .25s;
          display: inline-block;
        }
        .nav-cta:hover { background: var(--gold); color: var(--navy); }
        .nav-toggle {
          display: none; flex-direction: column; gap: 5px; cursor: pointer;
          background: none; border: none; padding: 8px; z-index: 60;
        }
        .nav-toggle span { width: 22px; height: 1.5px; background: var(--cream); transition: .25s; }
        .nav-toggle.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
        .nav-toggle.open span:nth-child(2) { opacity: 0; }
        .nav-toggle.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

        .mobile-menu {
          display: none;
          position: fixed; inset: 0; z-index: 45;
          background: rgba(10,18,48,0.98);
          flex-direction: column; align-items: center; justify-content: center; gap: 34px;
          opacity: 0; visibility: hidden; transition: opacity .3s;
        }
        .mobile-menu.open { opacity: 1; visibility: visible; display: flex; }
        .mobile-menu a {
          color: var(--cream); text-decoration: none;
          font-family: 'Fraunces', serif; font-size: 26px; cursor: pointer;
        }
        .mobile-menu .nav-cta { margin-top: 10px; }

        section { position: relative; z-index: 1; }

        .hero {
          min-height: 92vh;
          display: grid; grid-template-columns: 1.05fr 0.95fr; align-items: center;
          gap: 40px; padding: 60px 6vw 40px;
        }
        h1.headline {
          font-family: 'Fraunces', serif; font-weight: 600;
          font-size: clamp(2.6rem, 4.6vw, 4.4rem);
          line-height: 1.1; letter-spacing: -0.01em;
          min-height: calc(2 * clamp(2.6rem, 4.6vw, 4.4rem) * 1.1);
          opacity: 0; animation: rise .9s .2s forwards;
        }
        #typeLine { white-space: pre-wrap; display: block; }
        #typeLine .cursor {
          display: inline-block; width: 3px; height: 0.85em; background: var(--gold-soft); margin-left: 3px; vertical-align: -0.1em;
          animation: blink 1s step-end infinite;
        }
        @keyframes blink { 50% { opacity: 0; } }
        #revealLine { opacity: 0; display: block; font-style: italic; color: var(--gold-soft); font-weight: 500; }
        .headline.reveal #revealLine { animation: fadeInLine .8s .1s forwards; }
        @keyframes fadeInLine { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .sub {
          margin-top: 26px; max-width: 480px; font-size: 16.5px; line-height: 1.65; color: var(--ink);
          opacity: 0; animation: rise .9s .42s forwards;
        }
        .cta-row {
          display: flex; gap: 16px; margin-top: 38px; flex-wrap: wrap;
          opacity: 0; animation: rise .9s .58s forwards;
        }
        .btn-primary {
          padding: 15px 30px; background: var(--gold); color: var(--navy);
          text-decoration: none; font-weight: 500; font-size: 14.5px; border-radius: 2px;
          letter-spacing: 0.01em; transition: transform .25s, box-shadow .25s;
          border: none; cursor: pointer; display: inline-block;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 30px -12px rgba(201,154,63,0.5); }
        .btn-ghost {
          padding: 15px 26px; border: 1px solid rgba(246,240,226,0.28); color: var(--cream);
          text-decoration: none; font-size: 14.5px; border-radius: 2px;
          display: flex; align-items: center; gap: 8px; transition: border-color .25s;
          background: none; cursor: pointer;
        }
        .btn-ghost:hover { border-color: var(--gold-soft); }

        @keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

        .orbit-wrap {
          position: relative; height: 520px;
          display: flex; align-items: center; justify-content: center;
          perspective: 1400px;
        }
        .orbit-core {
          width: 210px; height: 210px; border-radius: 50%;
          overflow: hidden;
          box-shadow: 0 0 70px rgba(201,154,63,0.45);
          position: relative; z-index: 2;
        }
        .orbit-core img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ring {
          position: absolute; border: 1px solid rgba(201,154,63,0.28); border-radius: 50%;
        }
        .ring-1 { width: 340px; height: 340px; }
        .ring-2 { width: 460px; height: 460px; border-color: rgba(122,39,72,0.28); }

        .orbit-stage {
          position: absolute; inset: 0;
          transform-style: preserve-3d;
          animation: spin 34s linear infinite;
        }
        @keyframes spin { from { transform: rotateY(0deg) rotateX(8deg); } to { transform: rotateY(360deg) rotateX(8deg); } }

        .sat {
          position: absolute; top: 50%; left: 50%;
          width: 150px; margin: -46px 0 0 -75px;
          padding: 14px 16px;
          background: rgba(16,27,66,0.85);
          border: 1px solid rgba(201,154,63,0.35);
          border-radius: 10px;
          backdrop-filter: blur(6px);
          text-align: left;
          transform-style: preserve-3d;
        }
        .sat .label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.08em; color: var(--gold-soft); text-transform: uppercase; }
        .sat .val { font-family: 'Fraunces', serif; font-size: 15px; margin-top: 5px; color: var(--cream); }
        .sat-1 { transform: rotateY(0deg) translateZ(230px); }
        .sat-2 { transform: rotateY(90deg) translateZ(230px); }
        .sat-3 { transform: rotateY(180deg) translateZ(230px); }
        .sat-4 { transform: rotateY(270deg) translateZ(230px); }

        .section-head { padding: 100px 6vw 0; max-width: 680px; }
        .kicker { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; color: var(--gold-soft); text-transform: uppercase; }
        .section-title { font-family: 'Fraunces', serif; font-size: clamp(1.8rem,3vw,2.6rem); font-weight: 600; margin-top: 16px; line-height: 1.15; }
        .section-title em { font-style: italic; color: var(--gold-soft); font-weight: 500; }
        .section-desc { margin-top: 16px; color: var(--ink); max-width: 520px; line-height: 1.6; font-size: 15.5px; }

        .feature-grid {
          display: grid; grid-template-columns: repeat(4,1fr); gap: 1px;
          background: rgba(201,154,63,0.16);
          margin: 56px 6vw 0; border: 1px solid rgba(201,154,63,0.16);
        }
        .feature {
          background: var(--navy); padding: 34px 26px; min-height: 230px;
          display: flex; flex-direction: column; justify-content: space-between;
          opacity: 0; transform: translateY(24px); transition: opacity .7s, transform .7s;
        }
        .feature.in { opacity: 1; transform: translateY(0); }
        .f-num { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-dim); }
        .f-title { font-family: 'Fraunces', serif; font-size: 19px; margin-top: 26px; }
        .f-desc { font-size: 13.5px; color: var(--ink-dim); margin-top: 10px; line-height: 1.55; }

        .ai-section {
          margin: 130px 0 0; padding: 90px 6vw;
          background: linear-gradient(180deg, var(--navy-2), var(--navy-3));
          border-top: 1px solid rgba(201,154,63,0.16);
          border-bottom: 1px solid rgba(201,154,63,0.16);
          display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center;
        }
        .ai-visual {
          position: relative; height: 340px;
          display: flex; align-items: center; justify-content: center;
        }
        .ai-logo-ring {
          position: relative; width: 280px; height: 280px;
          display: flex; align-items: center; justify-content: center;
        }
        .ai-glow {
          position: absolute; inset: 20px; border-radius: 50%;
          background: radial-gradient(circle, rgba(122,39,72,0.55), transparent 70%);
          filter: blur(18px);
          animation: breathe 4s ease-in-out infinite;
        }
        @keyframes breathe { 0%,100% { opacity: .6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
        .ai-logo-ring img {
          width: 148px; height: 148px; border-radius: 50%; object-fit: cover;
          position: relative; z-index: 4;
          box-shadow: 0 0 50px rgba(122,39,72,0.6), 0 0 0 4px rgba(10,18,48,0.9);
        }
        .ai-dash-ring {
          position: absolute; inset: 14px; border-radius: 50%;
          border: 1px dashed rgba(217,155,182,0.4);
          animation: spinCW 22s linear infinite;
          z-index: 1;
        }
        .ai-dash-ring-2 {
          position: absolute; inset: 44px; border-radius: 50%;
          border: 1px dashed rgba(201,154,63,0.35);
          animation: spinCCW 16s linear infinite;
          z-index: 1;
        }
        @keyframes spinCW { to { transform: rotate(360deg); } }
        @keyframes spinCCW { to { transform: rotate(-360deg); } }
        .ai-orbit-dots {
          position: absolute; inset: 0; z-index: 2;
          animation: spinCW 12s linear infinite;
        }
        .ai-orbit-dots .dot {
          position: absolute; top: 50%; left: 50%; width: 7px; height: 7px; border-radius: 50%;
          background: var(--gold-soft);
          box-shadow: 0 0 10px 2px rgba(227,195,132,0.7);
        }
        .ai-orbit-dots .dot:nth-child(1) { transform: rotate(0deg) translateX(140px); }
        .ai-orbit-dots .dot:nth-child(2) { transform: rotate(120deg) translateX(140px); background: #d99bb6; box-shadow: 0 0 10px 2px rgba(217,155,182,0.7); }
        .ai-orbit-dots .dot:nth-child(3) { transform: rotate(240deg) translateX(140px); }
        .ai-pulse-ring {
          position: absolute; inset: 34px; border-radius: 50%;
          border: 1px solid rgba(122,39,72,0.5);
        }
        .ai-pulse-ring::before, .ai-pulse-ring::after {
          content: ''; position: absolute; inset: 0; border-radius: 50%;
          border: 1px solid rgba(217,155,182,0.4);
          animation: pulse 3.2s ease-out infinite;
        }
        .ai-pulse-ring::after { animation-delay: 1.6s; }
        @keyframes pulse { 0% { transform: scale(1); opacity: .8; } 100% { transform: scale(1.7); opacity: 0; } }

        .ai-copy .kicker { color: #d99bb6; }
        .ai-list { margin-top: 26px; display: flex; flex-direction: column; gap: 14px; }
        .ai-list li { list-style: none; display: flex; gap: 12px; font-size: 14.5px; color: var(--ink); align-items: baseline; }
        .ai-list li::before { content: '—'; color: var(--maroon); flex-shrink: 0; }
        .ai-note {
          margin-top: 34px; padding: 16px 18px; border: 1px solid rgba(217,155,182,0.3);
          border-radius: 2px; font-size: 13px; color: var(--ink-dim); max-width: 440px; line-height: 1.6;
        }
        .ai-note strong { color: var(--cream); font-weight: 500; }

        .closing {
          padding: 130px 6vw 100px; text-align: center;
        }
        .closing h2 {
          font-family: 'Fraunces', serif; font-weight: 600;
          font-size: clamp(2rem,4vw,3.2rem); max-width: 700px; margin: 0 auto; line-height: 1.15;
        }
        .closing h2 em { font-style: italic; color: var(--gold-soft); }
        .closing .cta-row { justify-content: center; margin-top: 36px; }

        footer.concept-footer {
          padding: 50px 6vw; border-top: 1px solid rgba(201,154,63,0.16);
          display: flex; justify-content: space-between; flex-wrap: wrap; gap: 24px;
          font-size: 13px; color: var(--ink-dim);
          position: relative; z-index: 1;
        }

        @media (max-width: 880px) {
          .nav-right { display: none; }
          .nav-toggle { display: flex; }
          .hero { grid-template-columns: 1fr; padding-top: 36px; text-align: left; }
          
          /* Scaled 3D Rotation on Mobile: keeps rotating in 3D without clipping */
          .orbit-wrap {
            height: 360px;
            perspective: 1000px;
            width: 100%;
            overflow: hidden;
            margin-top: 10px;
          }
          .orbit-core {
            width: 100px; height: 100px;
          }
          .ring-1 { width: 190px; height: 190px; }
          .ring-2 { width: 260px; height: 260px; }
          
          .orbit-stage {
            position: absolute;
            inset: 0;
            transform-style: preserve-3d;
            animation: spin 34s linear infinite !important;
          }
          .sat {
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            width: 100px !important;
            margin: -32px 0 0 -50px !important;
            padding: 8px 10px !important;
            border-radius: 8px !important;
            transform-style: preserve-3d;
          }
          .sat .label { font-size: 8.5px !important; letter-spacing: 0.05em; }
          .sat .val { font-size: 11.5px !important; margin-top: 3px !important; line-height: 1.2; }

          .sat-1 { transform: rotateY(0deg) translateZ(125px) !important; }
          .sat-2 { transform: rotateY(90deg) translateZ(125px) !important; }
          .sat-3 { transform: rotateY(180deg) translateZ(125px) !important; }
          .sat-4 { transform: rotateY(270deg) translateZ(125px) !important; }

          .feature-grid { grid-template-columns: 1fr 1fr; margin-left: 5vw; margin-right: 5vw; }
          .ai-section { grid-template-columns: 1fr; padding: 70px 6vw; }
          h1.headline { min-height: auto; }
        }
        @media (max-width: 520px) {
          .feature-grid { grid-template-columns: 1fr; }
          .cta-row { flex-direction: column; align-items: flex-start; }
          .hero { padding-left: 6vw; padding-right: 6vw; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* Background Gradients & Grain */}
      <div className="bg-field"></div>
      <div className="grain"></div>

      {/* Navigation */}
      <nav className="concept-nav">
        <div className="brand">
          <div className="brand-mark">
            <img src="/assets/unnati-logo.png" alt="Unnati Classes Logo" />
          </div>
          <div className="brand-name">
            Unnati <em>Classes</em>
          </div>
        </div>

        <div className="nav-right">
          <div className="nav-links">
            <a href="#features">The ERP</a>
            <a href="#ai">Powerprep AI</a>
            <a href="#visit">Visit us</a>
          </div>
          <Link href="/login" className="nav-cta">
            Login to ERP
          </Link>
        </div>

        <button
          className={`nav-toggle ${mobileMenuOpen ? 'open' : ''}`}
          id="navToggle"
          aria-label="Toggle Navigation"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`} id="mobileMenu">
        <a href="#features" className="mmlink" onClick={() => setMobileMenuOpen(false)}>
          The ERP
        </a>
        <a href="#ai" className="mmlink" onClick={() => setMobileMenuOpen(false)}>
          Powerprep AI
        </a>
        <a href="#visit" className="mmlink" onClick={() => setMobileMenuOpen(false)}>
          Visit us
        </a>
        <Link href="/login" className="nav-cta" onClick={() => setMobileMenuOpen(false)}>
          Login to ERP
        </Link>
      </div>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-left">
          <h1 className={`headline ${isReveal ? 'reveal' : ''}`} id="headline">
            <span id="typeLine">
              {typedText}
              {!isReveal && <span className="cursor"></span>}
            </span>
            <span id="revealLine">Now you can see it.</span>
          </h1>

          <p className="sub">
            An intelligent ERP system for parents & staff, plus an AI learning companion built specifically for our students.
          </p>

          <div className="cta-row">
            <Link href="/login" className="btn-primary">
              Login to ERP
            </Link>
          </div>
        </div>

        {/* 3D Orbit Visual (Hero Right) */}
        <div className="orbit-wrap">
          <div className="ring ring-1"></div>
          <div className="ring ring-2"></div>

          <div className="orbit-core">
            <img src="/assets/unnati-logo.png" alt="Unnati Core Logo" />
          </div>

          <div className="orbit-stage">
            <div className="sat sat-1">
              <div className="label">FEES & DUES</div>
              <div className="val">See What's Due, Instantly</div>
            </div>
            <div className="sat sat-2">
              <div className="label">ATTENDANCE</div>
              <div className="val">Live Email Updates</div>
            </div>
            <div className="sat sat-3">
              <div className="label">AI COMPANION</div>
              <div className="val">Instant Doubt Solving</div>
            </div>
            <div className="sat sat-4">
              <div className="label">REPORT CARDS</div>
              <div className="val">Your Results, The Same Day</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features">
        <div className="section-head">
          <div className="kicker">BUILT FOR UNNATI CLASSES</div>
          <h2 className="section-title">
            An ERP that works as hard as <em>our teachers.</em>
          </h2>
          <p className="section-desc">
            Every feature designed to cut administrative load, keep parents informed, and keep students progressing.
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature" ref={(el) => { featureRefs.current[0] = el; }}>
            <div>
              <div className="f-num">01</div>
              <h3 className="f-title">Fee Management</h3>
              <p className="f-desc">
                Automated ledger, monthly cycle tracking, fee waiver presets, and instant WhatsApp receipts.
              </p>
            </div>
          </div>

          <div className="feature" ref={(el) => { featureRefs.current[1] = el; }}>
            <div>
              <div className="f-num">02</div>
              <h3 className="f-title">Attendance Engine</h3>
              <p className="f-desc">
                Batch-wise daily marking, today breakdown counters (P/A/L/H), and auto-parent notifications.
              </p>
            </div>
          </div>

          <div className="feature" ref={(el) => { featureRefs.current[2] = el; }}>
            <div>
              <div className="f-num">03</div>
              <h3 className="f-title">Classwork & Exams</h3>
              <p className="f-desc">
                Post assignments, schedule exams with chapter tags, record marks, and publish results instantly.
              </p>
            </div>
          </div>

          <div className="feature" ref={(el) => { featureRefs.current[3] = el; }}>
            <div>
              <div className="f-num">04</div>
              <h3 className="f-title">Messaging Hub</h3>
              <p className="f-desc">
                Staff-to-student DMs, batch broadcasts, leave approvals, and role-scoped permissions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section className="ai-section" id="ai">
        <div className="ai-visual">
          <div className="ai-glow"></div>
          <div className="ai-logo-ring">
            <div className="ai-dash-ring"></div>
            <div className="ai-dash-ring-2"></div>
            <div className="ai-pulse-ring"></div>
            <div className="ai-orbit-dots">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
            <img src="/assets/unnati-logo.png" alt="Unnati AI Logo" />
          </div>
        </div>

        <div className="ai-copy">
          <div className="kicker">POWERPREP AI</div>
          <h2 className="section-title">
            A 24/7 tutor trained on <em>our curriculum.</em>
          </h2>
          <ul className="ai-list">
            <li>Generates practice worksheets from past papers</li>
            <li>step by step maths solution with pdf download option</li>
            <li>PDF export of formatted solutions for offline revision</li>
            <li>Instant doubt resolution for students at home</li>
          </ul>
          <div className="ai-note">
            <strong>Note:</strong> Students access Powerprep AI directly from their portal dashboard.
          </div>
        </div>
      </section>

      {/* Closing Section */}
      <section className="closing" id="visit">
        <h2>
          Ready to experience <em>modern education?</em>
        </h2>
        <div className="cta-row">
          <a href="tel:+919510434702" className="btn-ghost">
            Call the office
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="concept-footer">
        <div>Unnati Classes — F-21, Fortune Empire, Borisana Road, Kalol 382721</div>
      </footer>
    </div>
  );
}
