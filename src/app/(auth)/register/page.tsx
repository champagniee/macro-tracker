"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthLogo } from "@/components/auth/auth-logo";
import { useAuth } from "@/components/auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong");
        return;
      }
      await refresh();
      toast.success(`Welcome, ${data.user.name}!`);
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-col items-center gap-4 text-center">
        <AuthLogo />
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Create an account</h1>
          <p className="mt-1 text-[13px] text-muted">Track your macros across every device.</p>
        </div>
      </div>

      <GoogleButton label="Sign up with Google" />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-separator" />
        <span className="text-[12px] text-muted-2">or</span>
        <div className="h-px flex-1 bg-separator" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-muted">Name</span>
          <input
            type="text"
            required
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            className="rounded-[12px] bg-ring-track px-3 py-2.5 text-[15px] outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-accent/50"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-[12px] bg-ring-track px-3 py-2.5 text-[15px] outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-accent/50"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-muted">Password</span>
          <PasswordInput
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-muted">Confirm password</span>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent">
          Log in
        </Link>
      </p>
    </div>
  );
}
