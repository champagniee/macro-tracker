import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { GoalsProvider } from "@/components/goals-provider";
import { TabBar } from "@/components/nav/tab-bar";
import { SideNav } from "@/components/nav/side-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Macro Tracker",
  description: "Track calories and macros, effortlessly.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full">
        <ThemeProvider>
          <GoalsProvider>
            <SideNav />
            <div className="flex min-h-full flex-col pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64">
              <div className="mx-auto flex w-full max-w-md flex-1 flex-col sm:max-w-xl md:max-w-2xl lg:max-w-5xl lg:px-10 lg:py-8">
                {children}
              </div>
            </div>
            <TabBar />
            <Toaster position="top-center" richColors closeButton />
          </GoalsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
