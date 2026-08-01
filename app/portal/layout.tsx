import type { Metadata } from 'next';
import PortalAuthGuard from '@/components/PortalAuthGuard';

export const metadata: Metadata = {
  title: 'Student Portal | Daily Pulse',
  description: 'Unnati Powerprep Student Portal',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalAuthGuard>
      <div className="dark bg-[#0b1326] text-[#dae2fd] font-body-md text-body-md min-h-screen selection:bg-purple-500 selection:text-white">
        {children}
      </div>
    </PortalAuthGuard>
  );
}
