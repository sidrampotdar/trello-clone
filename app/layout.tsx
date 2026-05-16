import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { CardDetailModal } from "@/components/CardDetailModal";
import { AriaLiveRegion } from "@/components/AriaLiveRegion";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SidebarServer } from "@/components/SidebarServer";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Next-Gen Kanban",
  description:
    "Developer-centric, AI-enhanced, accessibility-first kanban with Cmd+K command palette.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-emerald-500 focus:px-3 focus:py-1.5 focus:text-sm focus:font-semibold focus:text-emerald-950"
        >
          Skip to main content
        </a>
        <div className="flex min-h-screen">
          <Suspense fallback={null}>
            <SidebarServer />
          </Suspense>
          <div id="main" className="flex min-w-0 flex-1 flex-col">
            {children}
          </div>
        </div>
        <CommandPalette />
        <CardDetailModal />
        <AriaLiveRegion />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
