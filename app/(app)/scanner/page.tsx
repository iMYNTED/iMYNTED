"use client";

import ScannerPanel from "@/app/components/ScannerPanel";
import StockDetailPanel from "@/app/components/StockDetailPanel";
import { useState, useEffect } from "react";

export default function ScannerPage() {
  const [detail, setDetail] = useState<{ symbol: string; asset: "stock" | "crypto" } | null>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const d = (e as CustomEvent).detail;
      if (d?.symbol) setDetail({ symbol: d.symbol, asset: d.asset ?? "stock" });
    }
    window.addEventListener("imynted:openDetail", onOpen as EventListener);
    return () => window.removeEventListener("imynted:openDetail", onOpen as EventListener);
  }, []);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>
      <ScannerPanel
        onPickSymbol={(sym) => {
          try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: "stock" } })); } catch {}
        }}
      />
      {detail && (
        <StockDetailPanel
          symbol={detail.symbol}
          asset={detail.asset}
          onClose={() => setDetail(null)}
          defaultTab="sentiment"
        />
      )}
    </div>
  );
}
