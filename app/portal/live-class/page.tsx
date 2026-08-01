'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PortalLiveClass() {
  const [notified, setNotified] = useState(false);
  const [colorState, setColorState] = useState<'initial' | 'red' | 'blue'>('initial');
  const [isAnimating, setIsAnimating] = useState(false);
  const [waveTransition, setWaveTransition] = useState(false);

  const playNotifySound = (isActivating: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (isActivating) {
        // High futuristic double chime sound for turning ON notification
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now); // E5
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.3);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(987.77, now + 0.08); // B5
        gain2.gain.setValueAtTime(0.3, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.45);
      } else {
        // Soft descending tone for toggling OFF
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  };

  const handleNotifyClick = () => {
    if (colorState === 'initial') {
      playNotifySound(true);
      setNotified(true);
      setColorState('red');
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);

      // After 2 seconds, trigger wave animation and slow color morph from red to blue
      setTimeout(() => {
        setWaveTransition(true);
        setColorState('blue');
        setTimeout(() => setWaveTransition(false), 3500);
      }, 2000);
    } else {
      // Toggle back to initial if clicked again
      playNotifySound(false);
      setNotified(false);
      setColorState('initial');
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-body-md relative overflow-hidden">
      {/* Dynamic Keyframes for Moving Red Gradient & Slow Wave Transition */}
      <style jsx global>{`
        @keyframes movingRedGradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .moving-red-text {
          background: linear-gradient(270deg, #ef4444, #f43f5e, #dc2626, #f59e0b, #ef4444);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: movingRedGradient 3s ease infinite;
          display: inline-block;
          padding-right: 0.35rem;
          overflow: visible;
        }

        @keyframes waveExpand {
          0% {
            transform: scale(0.1);
            opacity: 0.95;
          }
          40% {
            opacity: 0.7;
          }
          100% {
            transform: scale(4.5);
            opacity: 0;
          }
        }
        .blue-wave-ripple {
          animation: waveExpand 3.5s cubic-bezier(0.2, 1, 0.4, 1) forwards;
        }
      `}</style>

      {/* Navigation Header */}
      <div className="max-w-4xl mx-auto px-margin-mobile px-4 pt-6 pb-2">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900/80 border border-white/10 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors text-xs font-bold cursor-pointer mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Portal
        </Link>
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col px-margin-mobile px-4 py-sm pb-16 gap-sm max-w-4xl mx-auto">
        {/* HERO SECTION */}
        <section className="relative rounded-xl overflow-hidden glass-card bg-slate-900/80 p-md p-6 border border-cyan-500/20 scanline-effect shadow-xl">
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-0.5 rounded-full mb-2">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                rocket_launch
              </span>
              <span className="text-[10px] font-bold tracking-widest uppercase">Coming Soon</span>
            </div>

            {/* LIVE 2.0 WITH MOVING RED GRADIENT & UNCLIPPED PADDING */}
            <h2 className="font-display-lg text-[34px] md:text-[40px] text-white leading-none mb-1 font-black tracking-tight">
              LIVE <span className="moving-red-text italic font-black">2.0</span>
            </h2>

            <p className="text-[12px] text-slate-300 leading-relaxed max-w-[280px] mx-auto mb-4">
              Building a high-octane classroom experience with holographic streaming and gamified feedback.
            </p>

            {/* DYNAMIC NOTIFY BUTTON (SLOW RED -> BLUE WAVE TRANSITION) */}
            <button
              type="button"
              onClick={handleNotifyClick}
              className={`relative overflow-hidden px-8 py-3 rounded-xl font-bold text-[14px] transition-all duration-[3000ms] ease-in-out mx-auto flex items-center justify-center gap-2 cursor-pointer shadow-xl ${
                isAnimating ? 'scale-110 ring-4 ring-rose-500/50 shadow-rose-500/50' : 'active:scale-95 hover:scale-105'
              } ${
                colorState === 'blue'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white border border-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.6)]'
                  : colorState === 'red'
                  ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white border border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-[#0b1326] border border-cyan-300'
              }`}
            >
              {/* Slow Blue Wave Ripple Animation Element */}
              {waveTransition && (
                <span className="absolute inset-0 bg-blue-400/50 rounded-full blue-wave-ripple pointer-events-none" />
              )}

              {/* Click Pulse Ripple */}
              {isAnimating && (
                <span className="absolute inset-0 bg-white/30 animate-ping rounded-xl pointer-events-none" />
              )}

              {notified ? (
                <span className="flex items-center gap-2 animate-in zoom-in-75 duration-300">
                  <span className="material-symbols-outlined text-[18px] animate-pulse">notifications_active</span>
                  NOTIFIED ✓
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  NOTIFY ME <span className="material-symbols-outlined text-[18px]">campaign</span>
                </span>
              )}
            </button>
          </div>
        </section>

        {/* 2X2 + SPAN-2 FEATURES GRID */}
        <div className="flex-1 grid grid-cols-2 gap-sm gap-3 my-4">
          <div className="glass-card bg-slate-900/80 p-sm p-4 rounded-xl flex flex-col gap-1.5 border-l-2 border-cyan-400 border border-white/10">
            <span className="material-symbols-outlined text-cyan-400 text-[24px]">groups_3</span>
            <h3 className="text-[13px] font-bold text-white">Interactive Hubs</h3>
            <p className="text-[11px] text-slate-300 leading-tight">Virtual lecture halls with global student sync.</p>
          </div>

          <div className="glass-card bg-slate-900/80 p-sm p-4 rounded-xl flex flex-col gap-1.5 border-l-2 border-amber-400 border border-white/10">
            <span className="material-symbols-outlined text-amber-400 text-[24px]">sports_esports</span>
            <h3 className="text-[13px] font-bold text-white">Gamified Streams</h3>
            <p className="text-[11px] text-slate-300 leading-tight">Earn XP and unlock badges in real-time raids.</p>
          </div>

          <div className="glass-card bg-slate-900/80 p-sm p-4 rounded-xl flex flex-col gap-1.5 border-l-2 border-emerald-400 border border-white/10">
            <span className="material-symbols-outlined text-emerald-400 text-[24px]">draw</span>
            <h3 className="text-[13px] font-bold text-white">3D Whiteboards</h3>
            <p className="text-[11px] text-slate-300 leading-tight">Infinite collaborative canvases in 3D space.</p>
          </div>

          <div className="glass-card bg-slate-900/80 p-sm p-4 rounded-xl flex flex-col gap-1.5 border-l-2 border-rose-400 border border-white/10">
            <span className="material-symbols-outlined text-rose-400 text-[24px]">view_in_ar</span>
            <h3 className="text-[13px] font-bold text-white">VR Classrooms</h3>
            <p className="text-[11px] text-slate-300 leading-tight">Total immersion with spatial audio and presence.</p>
          </div>

          <div className="glass-card bg-slate-900/80 p-sm p-4 rounded-xl col-span-2 flex items-center gap-sm gap-3 border-l-2 border-indigo-400 border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div className="flex-1">
              <h3 className="text-[13px] font-bold text-white">AI Co-Pilot</h3>
              <p className="text-[11px] text-slate-300 leading-tight">Personal tutor for real-time notes and Q&A.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
