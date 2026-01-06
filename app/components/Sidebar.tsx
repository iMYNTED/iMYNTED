"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/alerts", label: "Alerts" },
  { href: "/accounts", label: "Accounts" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-background">
     <div className="p-4">
  <div className="flex items-center gap-3">
    <img
  src="/brand/sentinel-mark.png"
  alt="My Sentinel Atlas"
  width={56}
  height={56}
  className="object-contain"
/>



    <div className="leading-tight">
      <div className="text-sm font-semibold tracking-tight">
        My Sentinel Atlas
      </div>
      <div className="text-xs text-muted-foreground">
        Unified Monitoring • Not a broker
      </div>
    </div>
  </div>
</div>


      <nav className="px-2 pb-4">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
