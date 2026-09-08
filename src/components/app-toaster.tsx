"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { CheckCircle2, XCircle, Info, AlertTriangle, Loader2 } from "lucide-react";

// Sonner's own default look (plain white/black card, generic colored icons)
// never matched the rest of the app's surface/border/shadow/radius tokens —
// `unstyled` strips Sonner's injected styles entirely so classNames can
// rebuild the toast as one of this app's own cards instead of fighting
// Sonner's styles with `!important`. Icons are swapped to the same
// lucide-react + CSS-variable-color pattern used everywhere else in the app
// (CategoryBadge, MacroBar, etc.) instead of Sonner's built-ins.
//
// No close button — toasts auto-dismiss on their own, so there's nothing for
// one to do here. With it gone there's no button competing for space either,
// so the icon+text render as one centered block instead of pinned left.
export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-center"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      icons={{
        success: <CheckCircle2 size={18} style={{ color: "var(--success)" }} />,
        error: <XCircle size={18} style={{ color: "var(--calories)" }} />,
        info: <Info size={18} style={{ color: "var(--accent)" }} />,
        warning: <AlertTriangle size={18} style={{ color: "var(--carbs)" }} />,
        loading: <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-separator bg-surface-elevated p-4 shadow-[var(--shadow-sheet)]",
          content: "flex flex-col items-center gap-0.5",
          icon: "flex shrink-0 items-center",
          title: "text-[14px] font-medium text-foreground text-center",
          description: "text-[13px] text-muted text-center",
          actionButton:
            "rounded-[10px] bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition-transform active:scale-95",
          cancelButton:
            "rounded-[10px] bg-ring-track px-3 py-1.5 text-[13px] font-medium text-muted transition-transform active:scale-95",
        },
      }}
    />
  );
}
