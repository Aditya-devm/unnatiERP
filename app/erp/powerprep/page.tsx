'use client';

import React from 'react';
import AIChatInterface from '@/components/AIChatInterface';

export default function AdminPowerprepPage() {
  return (
    <div className="-mx-6 -my-6 md:-mx-8 md:-my-8 h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      <AIChatInterface chatId={null} />
    </div>
  );
}
