"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, CalendarDays, ChefHat, Settings, Flame } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: House },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-separator bg-surface/60 backdrop-blur-xl backdrop-saturate-150 lg:flex">
      <div className="flex items-center justify-between px-6 pt-8 pb-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent text-white">
            <Flame size={16} strokeWidth={2.5} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">Macro Tracker</span>
        </div>
        <ThemeToggle className="h-8 w-8" />
      </div>

      <nav className="flex flex-col gap-1 px-3" aria-label="Primary">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] font-medium transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.3 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-6 pb-8 pt-4 text-[12px] leading-5 text-muted-2">
        Your food log, goals, and recipes sync to your account.
      </div>
    </aside>
  );
}
