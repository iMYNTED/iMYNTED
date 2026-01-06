import Link from "next/link";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r border-zinc-800 bg-zinc-900/40">
          <div className="px-5 py-5 border-b border-zinc-800">
            <div className="text-lg font-semibold tracking-tight">
              My Sentinel Atlas
            </div>
            <div className="text-xs text-zinc-400">
              Command Center
            </div>
          </div>

          <nav className="p-3 space-y-1">
            <SidebarLink href="/dashboard" label="Dashboard" />
            <SidebarLink href="/alerts" label="Alerts" />
            <SidebarLink href="/accounts" label="Accounts" />
            <SidebarLink href="/settings" label="Settings" />
          </nav>

          <div className="mt-auto p-4 text-xs text-zinc-500 border-t border-zinc-800">
            Read-only aggregation • Phase 1
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col">
          {/* Top bar */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
            <div>
              <div className="text-sm font-semibold text-white">
                My Sentinel Atlas
              </div>
              <div className="text-xs text-zinc-400">
                Unified Monitoring • Not a broker • No trade execution
              </div>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm text-zinc-400 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </header>

          {/* Page content MUST be here */}
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
    >
      {label}
    </Link>
  );
}
