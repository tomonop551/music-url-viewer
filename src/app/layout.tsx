import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Music URL Viewer",
  description: "登録した音楽のURLを一覧表示するアプリ",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

// <html> のテーマクラスを描写前に確定させる。hydration の途中で localStorage を読むと
// 暗色ユーザーが明色のちらつきを踏む。ThemeToggle の applyMode と同じ判定を繰り返すのは、
// インラインスクリプトがモジュールを import できないため（キーも判定も約束で同期させる）。
const themeInitScript = `(() => {
  const mode = localStorage.getItem("theme");
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const classes = document.documentElement.classList;
  classes.toggle("dark", dark);
  classes.toggle("light", !dark);
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
