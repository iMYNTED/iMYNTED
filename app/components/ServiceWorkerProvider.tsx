"use client";

import { useServiceWorker } from "@/app/hooks/useServiceWorker";

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, updateAvailable, applyUpdate } = useServiceWorker();

  return (
    <>
      {children}

      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/90 text-black text-sm font-medium shadow-lg">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-7.072 7.072a9 9 0 010-12.728m3.536 3.536a4 4 0 010 5.656" />
            </svg>
            <span>Offline — showing cached data</span>
          </div>
        </div>
      )}

      {/* Update available banner */}
      {updateAvailable && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/90 text-black text-sm font-medium shadow-lg">
            <span>Update available</span>
            <button
              onClick={applyUpdate}
              className="px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </>
  );
}
