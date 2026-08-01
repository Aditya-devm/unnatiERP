import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter as a standard font
import "./globals.css";
import "katex/dist/katex.min.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Unnati Powerprep",
  description: "Your AI-powered educational assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Sora:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} relative liquid-bg`}>
        {/* Liquid Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px] animate-liquid"></div>
          <div className="absolute top-[20%] right-[-5%] w-[35%] h-[35%] bg-orange-400/10 rounded-full blur-[100px] animate-liquid" style={{ animationDelay: '-5s' }}></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[45%] h-[45%] bg-blue-600/10 rounded-full blur-[130px] animate-liquid" style={{ animationDelay: '-10s' }}></div>
        </div>

        <Providers>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow relative z-0">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
