import React from "react"
import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "心迹 Vesti — AI Memory Hub",
  description:
    "自动捕获 ChatGPT / Claude / Gemini / DeepSeek 对话记录，提供统一时间轴回顾与量化面板。",
};

export const viewport: Viewport = {
  themeColor: "hsl(43 20% 97%)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-serif antialiased">
        {children}
      </body>
    </html>
  );
}
