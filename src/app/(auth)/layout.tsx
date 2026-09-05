import type { ReactNode } from "react";
import { Flame } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-white">
          <Flame size={18} strokeWidth={2.5} />
        </span>
        <span className="text-[19px] font-semibold tracking-tight">Macro Tracker</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
