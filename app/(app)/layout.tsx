import React from "react";
import Sidebar from "@/app/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* Optional top spacer if your root layout has a header height */}
          {children}
        </main>
      </div>
    </div>
  );
}
