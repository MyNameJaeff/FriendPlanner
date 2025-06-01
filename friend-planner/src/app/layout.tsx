import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

import { Geist, Geist_Mono } from "next/font/google";
import { JetBrains_Mono, Modak, Rubik_Bubbles, Sue_Ellen_Francisco } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
});

const modak = Modak({
  variable: "--font-modak",
  subsets: ["latin"],
  weight: "400",
});

const rubikBubbles = Rubik_Bubbles({
  variable: "--font-rubik-bubbles",
  subsets: ["latin"],
  weight: "400",
});

const sueEllen = Sue_Ellen_Francisco({
  variable: "--font-sue-ellen",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Friend Planner",
  description: "Plan activities with your friends effortlessly",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`
        ${geistSans.variable}
        ${geistMono.variable}
        ${jetBrainsMono.variable}
        ${modak.variable}
        ${rubikBubbles.variable}
        ${sueEllen.variable}
        antialiased
      `}
    >
      <body className="min-h-screen grow flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col bg-[#E6E6E6] mt-12 p-12">
          <div className="flex-grow">{children}</div>
        </main>
        <Footer />
      </body>
    </html>
  );
}
