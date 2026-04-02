"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "imynted_settings_v1";

export interface AppSettings {
  // Display
  compactMode: boolean;
  animations: boolean;
  showSpreads: boolean;
  colorBlinds: boolean;   // deuteranopia: red/green → blue/orange
  defaultAsset: string;
  chartStyle: string;
  refreshRate: string;    // ms as string
  timeFormat: string;     // "12h" | "24h"
}

const DEFAULTS: AppSettings = {
  compactMode: false,
  animations: true,
  showSpreads: true,
  colorBlinds: false,
  defaultAsset: "stock",
  chartStyle: "candle",
  refreshRate: "2500",
  timeFormat: "12h",
};

interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  // Convenience color helpers that respect deuteranopia
  upColor: string;       // tailwind class
  downColor: string;     // tailwind class
  upHex: string;         // raw hex
  downHex: string;       // raw hex
  upRgba: (a: number) => string;
  downRgba: (a: number) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    // Fallback for components rendered outside provider
    return {
      settings: DEFAULTS,
      update: () => {},
      upColor: "text-emerald-400",
      downColor: "text-red-400",
      upHex: "#34d399",
      downHex: "#f87171",
      upRgba: (a: number) => `rgba(52,211,153,${a})`,
      downRgba: (a: number) => `rgba(248,113,113,${a})`,
    };
  }
  return ctx;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.display) {
          setSettings(prev => ({ ...prev, ...parsed.display }));
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist display settings back (sync with settings page)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : {};
      existing.display = settings;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch {}
  }, [hydrated, settings]);

  // Listen for storage changes from settings page (cross-tab + same-tab)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed.display) setSettings(prev => ({ ...prev, ...parsed.display }));
      } catch {}
    }
    window.addEventListener("storage", onStorage);

    // Also poll for same-tab changes from settings page (storage event doesn't fire same-tab)
    const poll = setInterval(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.display) {
            setSettings(prev => {
              const next = { ...prev, ...parsed.display };
              // Only update if actually different
              if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
              return next;
            });
          }
        }
      } catch {}
    }, 1000);

    return () => { window.removeEventListener("storage", onStorage); clearInterval(poll); };
  }, []);

  function update(patch: Partial<AppSettings>) {
    setSettings(prev => ({ ...prev, ...patch }));
  }

  const cb = settings.colorBlinds;

  const value: SettingsContextValue = {
    settings,
    update,
    upColor:   cb ? "text-blue-400"   : "text-emerald-400",
    downColor: cb ? "text-orange-400" : "text-red-400",
    upHex:     cb ? "#60a5fa"         : "#34d399",
    downHex:   cb ? "#fb923c"         : "#f87171",
    upRgba:    (a: number) => cb ? `rgba(96,165,250,${a})`  : `rgba(52,211,153,${a})`,
    downRgba:  (a: number) => cb ? `rgba(251,146,60,${a})`  : `rgba(248,113,113,${a})`,
  };

  return (
    <SettingsContext.Provider value={value}>
      {/* CSS custom properties for global color override */}
      <style>{`
        :root {
          --im-up: ${value.upHex};
          --im-down: ${value.downHex};
          --im-up-rgb: ${cb ? "96,165,250" : "52,211,153"};
          --im-down-rgb: ${cb ? "251,146,60" : "248,113,113"};
          --im-compact: ${settings.compactMode ? "1" : "0"};
          --im-refresh: ${settings.refreshRate};
        }
        ${!settings.animations ? `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }` : ""}
      `}</style>
      {children}
    </SettingsContext.Provider>
  );
}
