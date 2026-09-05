import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { GoalsProvider } from "@/components/goals-provider";
import { TabBar } from "@/components/nav/tab-bar";
import { SideNav } from "@/components/nav/side-nav";
import { getSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <GoalsProvider>
      <SideNav />
      <div className="flex min-h-full flex-col pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col sm:max-w-xl md:max-w-2xl lg:max-w-5xl lg:px-10 lg:py-8">
          {children}
        </div>
      </div>
      <TabBar />
    </GoalsProvider>
  );
}
