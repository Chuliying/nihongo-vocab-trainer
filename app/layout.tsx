import type { Metadata, Viewport } from "next";
import {
  Shippori_Mincho,
  Fraunces,
  Zen_Kaku_Gothic_New,
  Noto_Sans_TC,
  Barlow
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Logo wordmark — Barlow, used uppercase
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow",
  display: "swap"
});

// Hero Japanese — an elegant, characterful mincho for kanji & kana
const shippori = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-shippori",
  display: "swap"
});

// Latin display — editorial soul for eyebrows & numerals
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap"
});

// JP sans for UI text
const zen = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-zen",
  display: "swap"
});

// Traditional-Chinese body (meanings, descriptions)
const notoTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-tc",
  display: "swap"
});

export const metadata: Metadata = {
  title: "NVT",
  description: "13,000 個常用日語單字，為繁體中文學習者打造的行動優先翻卡練習工具。"
};

export const viewport: Viewport = {
  themeColor: "#f8f6f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${shippori.variable} ${fraunces.variable} ${zen.variable} ${notoTC.variable} ${barlow.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
