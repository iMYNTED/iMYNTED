"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function Sidebar() {
  const [logoOk, setLogoOk] = useState(true);

  // ✅ IMPORTANT: no Date.now / random / changing querystring
  // If you need cache-busting, do it by renaming the file (imynted-mark-512.v2.png).
  const logoSrc = useMemo(() => "/brand/imynted-mark-512.png", []);

  return (
    <aside className="w-64 border-r border-white/10 bg-background/40 backdrop-blur">
      <div className="flex h-full flex-col">
        <div className="flex flex-col items-center gap-4 py-8">
          {logoOk ? (
            <img
              src={logoSrc}
              alt="iMYNTED Shield"
              width={512}
              height={550}
              className="block object-contain"
              style={{ display: "block", maxWidth: "256px", height: "auto" }}
              onError={() => setLogoOk(false)}
            />
          ) : (
            <div className="h-28 w-28 rounded-2xl border border-white/10 bg-muted/40" />
          )}

          <div className="text-center">
            <div className="text-xs tracking-widest text-muted-foreground">iMYNTED</div>
          </div>
        </div>

        <nav className="flex-1 px-3">
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className={cn(
                "block rounded-xl px-3 py-2 text-sm hover:bg-muted/50",
                "text-foreground"
              )}
            >
              Dashboard
            </Link>
            <Link
              href="/alerts"
              className="block rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              Alerts
            </Link>
            <Link
              href="/accounts"
              className="block rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              Accounts
            </Link>
            <Link
              href="/settings"
              className="block rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              Settings
            </Link>
          </div>
        </nav>

        <div className="px-3 pb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span>All systems nominal</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
