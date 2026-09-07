"use client";

import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthLogo } from "@/components/auth/auth-logo";
import { useAuth } from "@/components/auth-provider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast.error(error);
      router.replace("/login");
    }
  }, [searchParams, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong");
        return;
      }
      await refresh();
      toast.success("Welcome back");
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
          <h1 className="text-[20px] font-semibold tracking-tight">Log in</h1>
          <p className="mt-1 text-[13px] text-muted">Welcome back. Enter your details below.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-separator" />
        <span className="text-[12px] text-muted-2">or</span>
        <div className="h-px flex-1 bg-separator" />
      </div>

      <GoogleButton label="Continue with Google" />

      <p className="text-center text-[13px] text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-accent">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
