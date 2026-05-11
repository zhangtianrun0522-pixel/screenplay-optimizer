import type { Metadata } from "next";
import "./globals.css";
import { ApiSettingsProvider } from "@/components/ApiSettingsProvider";

export const metadata: Metadata = {
  title: "剧本优化",
  description: "独立的剧本优化工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full bg-background text-foreground antialiased">
        <ApiSettingsProvider>{children}</ApiSettingsProvider>
      </body>
    </html>
  );
}
