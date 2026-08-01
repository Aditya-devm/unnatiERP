'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';

export default function PortalGallery() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mx-auto">
          <ImageIcon className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Institute Gallery</h1>
          <p className="text-slate-400 text-xs font-semibold mt-2">
            Event photos, campus highlights, and achievement memories will appear here. This module is coming soon!
          </p>
        </div>
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl text-xs transition-all shadow-md cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Portal Home
        </Link>
      </div>
    </div>
  );
}
