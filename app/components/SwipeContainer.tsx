"use client";

import React from "react";
import { useSwipe } from "@/app/hooks/useSwipe";

interface SwipeContainerProps {
  children: React.ReactNode;
  currentIndex: number;
  totalCount: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
  showDots?: boolean;
}

export function SwipeContainer({
  children,
  currentIndex,
  totalCount,
  onSwipeLeft,
  onSwipeRight,
  className = "",
  showDots = true,
}: SwipeContainerProps) {
  const swipeHandlers = useSwipe({
    threshold: 50,
    velocityThreshold: 0.3,
    onSwipeLeft,
    onSwipeRight,
  });

  return (
    <div
      className={`relative ${className}`}
      {...swipeHandlers}
      style={{ touchAction: "pan-y" }}
    >
      {children}

      {/* Dot indicators */}
      {showDots && totalCount > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none">
          {Array.from({ length: totalCount }, (_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                i === currentIndex
                  ? "bg-emerald-400 w-3"
                  : "bg-white/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SwipeContainer;
