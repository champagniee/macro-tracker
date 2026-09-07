"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Beef, ChevronDown, Wheat, Droplet } from "lucide-react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = ["Light", "Dark", "System"] as const;
type ThemeOption = (typeof THEME_OPTIONS)[number];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, logout, refresh } = useAuth();
  const mounted = useIsClient();
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [sendingReport, setSendingReport] = useState(false);

  // Sync the name field whenever the loaded user changes (e.g. hydration
  // after mount) without clobbering in-progress typing.
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    setName(user?.name ?? "");
  }

  const themeValue: ThemeOption =
    theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  function handleThemeChange(value: ThemeOption) {
    setTheme(value.toLowerCase());
  }

  async function handleLogout() {
    setLogoutConfirmOpen(false);
    await logout();
    router.push("/login");
  }

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name can't be empty");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't update name");
      await refresh();
      toast.success("Name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSubmitReport() {
    const trimmed = reportText.trim();
    if (!trimmed) {
      toast.error("Describe the issue first");
      return;
    }
    setSendingReport(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send report");
      setReportText("");
      toast.success("Thanks — report sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send report");
    } finally {
      setSendingReport(false);
    }
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-2 lg:px-0 lg:pt-0 lg:pb-6">
        <div>
          <p className="text-[13px] font-medium text-muted">Preferences</p>
          <h1 className="text-[22px] font-semibold tracking-tight lg:text-[28px]">Settings</h1>
        </div>
        <ThemeToggle className="h-9 w-9 lg:hidden" />
      </header>

      <div className="flex flex-col gap-5 px-5 pb-28 lg:mx-auto lg:w-full lg:max-w-xl lg:px-0 lg:pb-8">
        <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
          <h2 className="text-[15px] font-semibold">Account</h2>
          {authLoading ? (
            <div className="h-9 rounded-[12px] bg-ring-track" />
          ) : user ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-muted">Name</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="min-w-0 flex-1 rounded-[12px] bg-ring-track px-3 py-2 text-[14px] outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-accent/50"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={savingName || name.trim() === user.name}
                  >
                    Save
                  </Button>
                </div>
              </label>

              <p className="truncate text-[13px] text-muted">{user.email}</p>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-muted">You&apos;re not logged in.</p>
              <Link href="/login">
                <Button size="sm">Log in</Button>
              </Link>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
          <h2 className="text-[15px] font-semibold">Appearance</h2>
          {mounted ? (
            <SegmentedControl options={THEME_OPTIONS} value={themeValue} onChange={handleThemeChange} />
          ) : (
            <div className="h-9 rounded-[12px] bg-ring-track" />
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
          <h2 className="text-[15px] font-semibold">About</h2>
          <p className="text-[13px] leading-5 text-muted">
            Your food log and goals sync to your account. Auto-import from recipes and
            photos, plus synced macro lookups, are coming via a connected service.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-[12px] text-muted-2">
            <span className="flex items-center gap-1">
              <Beef size={12} style={{ color: "var(--protein)" }} /> Protein
            </span>
            <span className="flex items-center gap-1">
              <Wheat size={12} style={{ color: "var(--carbs)" }} /> Carbs
            </span>
            <span className="flex items-center gap-1">
              <Droplet size={12} style={{ color: "var(--fat)" }} /> Fat
            </span>
          </div>
        </section>

        {user && (
          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
            <button
              type="button"
              onClick={() => setReportOpen((o) => !o)}
              className="flex items-center justify-between gap-3 text-left"
            >
              <div>
                <h2 className="text-[15px] font-semibold">Report an Issue</h2>
                <p className="mt-0.5 text-[12px] text-muted">Found a bug or something off? Let me know.</p>
              </div>
              <ChevronDown
                size={16}
                className={cn("shrink-0 text-muted-2 transition-transform", reportOpen && "rotate-180")}
              />
            </button>

            {reportOpen && (
              <>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="What happened?"
                  rows={4}
                  className="w-full resize-none rounded-[12px] bg-ring-track px-3 py-2.5 text-[14px] outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-accent/50"
                />
                <Button
                  className="self-start"
                  size="sm"
                  onClick={handleSubmitReport}
                  disabled={sendingReport || !reportText.trim()}
                >
                  {sendingReport ? "Sending…" : "Send Report"}
                </Button>
              </>
            )}
          </section>
        )}

        {user && (
          <Button variant="secondary" className="w-full" onClick={() => setLogoutConfirmOpen(true)}>
            Log out
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log out?"
        description="You'll need to log back in to see your food log and goals."
        confirmLabel="Log out"
        variant="danger"
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </>
  );
}
