'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
    const pathname = usePathname();

    if (
        pathname === '/' ||
        pathname?.startsWith('/erp') ||
        pathname?.startsWith('/portal') ||
        pathname === '/demo' ||
        pathname?.startsWith('/dashboard') ||
        pathname?.startsWith('/admin') ||
        pathname?.startsWith('/teacher') ||
        pathname === '/login' ||
        pathname === '/register'
    ) {
        return null;
    }

    return (
        <footer className="mt-auto border-t border-slate-200/50 bg-white/50 backdrop-blur-md">
            <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex justify-center md:order-2 space-x-6 text-sm font-bold">
                        <a href="#" className="text-slate-500 hover:text-indigo-600 transition-colors">
                            Privacy Policy
                        </a>
                        <a href="#" className="text-slate-500 hover:text-indigo-600 transition-colors">
                            Terms of Service
                        </a>
                        <a href="#" className="text-slate-500 hover:text-indigo-600 transition-colors">
                            Contact Support
                        </a>
                    </div>
                    <div className="md:order-1">
                        <p className="text-center md:text-left text-sm text-slate-400 font-medium">
                            &copy; {new Date().getFullYear()} Unnati Powerprep. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
