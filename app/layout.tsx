import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Acme,
  Bagel_Fat_One,
  Poppins,
} from "next/font/google";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const acme = Acme({
  variable: "--font-acme",
  weight: "400",
  subsets: ["latin"],
});

const bagel = Bagel_Fat_One({
  variable: "--font-bagel",
  weight: "400",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SplitPlay",
  description: "Divida contas de mesa de forma simples e divertida.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sem viewport-fit: "cover" de propósito: mantém o conteúdo dentro da área
  // segura (abaixo da status bar / acima do home indicator), evitando que o
  // header e a navbar fiquem por baixo da UI do sistema.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} ${acme.variable} ${bagel.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh justify-center overflow-x-hidden bg-[#141414]">
        <AuthProvider>
          <div className="app-shell flex min-h-dvh w-full max-w-[420px] flex-col bg-[#418964] shadow-xl">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
