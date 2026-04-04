"use client";

import { useEffect, useState, useCallback } from "react";

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    updateAvailable: false,
    registration: null,
  });

  // Update online status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setState((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setState((s) => ({ ...s, isOnline: false }));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) {
      console.log("[SW] Service workers not supported");
      return;
    }

    setState((s) => ({ ...s, isSupported: true }));

    // Only register in production
    if (process.env.NODE_ENV !== "production") {
      console.log("[SW] Skipping registration in development");
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log("[SW] Registered successfully:", registration.scope);
        setState((s) => ({ ...s, isRegistered: true, registration }));

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("[SW] Update available");
              setState((s) => ({ ...s, updateAvailable: true }));
            }
          });
        });

        // Periodic update check (every hour)
        setInterval(() => {
          registration.update().catch(console.error);
        }, 60 * 60 * 1000);

      } catch (error) {
        console.error("[SW] Registration failed:", error);
      }
    };

    // Wait for page load
    if (document.readyState === "complete") {
      registerSW();
    } else {
      window.addEventListener("load", registerSW);
      return () => window.removeEventListener("load", registerSW);
    }
  }, []);

  // Apply update
  const applyUpdate = useCallback(() => {
    if (!state.registration?.waiting) return;

    state.registration.waiting.postMessage({ type: "SKIP_WAITING" });

    // Reload when the new service worker takes over
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, [state.registration]);

  return {
    ...state,
    applyUpdate,
  };
}
