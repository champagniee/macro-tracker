"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, CalendarDays, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Today", icon: House },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-separator bg-surface/80 backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 transition-transform active:scale-95"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.3 : 1.8}
                className={cn(active ? "text-accent" : "text-muted-2")}
              />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active ? "text-accent" : "text-muted-2",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
