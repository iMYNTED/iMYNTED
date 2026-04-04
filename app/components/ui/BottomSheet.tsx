"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  snapPoints?: number[];  // percentages (0.4 = 40%)
  initialSnap?: number;   // index of initial snap point
  children: React.ReactNode;
  title?: React.ReactNode;
  enableDrag?: boolean;
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function BottomSheet({
  open,
  onClose,
  snapPoints = [0.4, 0.75, 0.95],
  initialSnap = 1,
  children,
  title,
  enableDrag = true,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const velocityRef = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);

  // Mount portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle open/close animation
  useEffect(() => {
    if (open) {
      setCurrentSnap(initialSnap);
      setDragY(0);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open, initialSnap]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const windowHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const sheetHeight = snapPoints[currentSnap] * windowHeight;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableDrag) return;
    const touch = e.touches[0];
    startY.current = touch.clientY;
    startHeight.current = sheetHeight - dragY;
    lastY.current = touch.clientY;
    lastTime.current = Date.now();
    velocityRef.current = 0;
    setIsDragging(true);
  }, [enableDrag, sheetHeight, dragY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !enableDrag) return;
    const touch = e.touches[0];
    const dy = touch.clientY - startY.current;

    // Calculate velocity
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocityRef.current = (touch.clientY - lastY.current) / dt;
    }
    lastY.current = touch.clientY;
    lastTime.current = now;

    // Only allow dragging down from current position (or up within bounds)
    setDragY(Math.max(0, dy));
  }, [isDragging, enableDrag]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const velocity = velocityRef.current;
    const currentY = dragY;
    const dismissThreshold = sheetHeight * 0.35;

    // Fast swipe down = dismiss
    if (velocity > 0.5) {
      onClose();
      return;
    }

    // Slow swipe or drag position based
    if (currentY > dismissThreshold) {
      onClose();
      return;
    }

    // Find nearest snap point based on current position + velocity
    const currentHeightPct = (sheetHeight - currentY) / windowHeight;
    let targetSnapIndex = currentSnap;

    // Factor in velocity for snap direction
    if (velocity > 0.2 && currentSnap > 0) {
      targetSnapIndex = currentSnap - 1;
    } else if (velocity < -0.2 && currentSnap < snapPoints.length - 1) {
      targetSnapIndex = currentSnap + 1;
    } else {
      // Find nearest snap point
      let minDist = Infinity;
      snapPoints.forEach((sp, i) => {
        const dist = Math.abs(sp - currentHeightPct);
        if (dist < minDist) {
          minDist = dist;
          targetSnapIndex = i;
        }
      });
    }

    setCurrentSnap(targetSnapIndex);
    setDragY(0);
  }, [isDragging, dragY, sheetHeight, windowHeight, currentSnap, snapPoints, onClose]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!mounted || !open) return null;

  const translateY = visible ? dragY : windowHeight;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 md:hidden",
        visible ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: visible ? 1 - dragY / sheetHeight * 0.5 : 0 }}
        onClick={handleBackdropClick}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "absolute bottom-0 left-0 right-0 flex flex-col",
          "rounded-t-2xl border-t border-white/[0.08]",
          "overflow-hidden",
          !isDragging && "transition-transform duration-300"
        )}
        style={{
          background: "rgba(5,13,20,0.98)",
          height: `${sheetHeight}px`,
          maxHeight: "95vh",
          transform: `translateY(${translateY}px)`,
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div
          className="shrink-0 flex items-center justify-center py-3 cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        {title && (
          <div
            className="shrink-0 flex items-center justify-between px-4 pb-2 border-b border-white/[0.06]"
          >
            <div className="flex-1 min-w-0">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 ml-2 rounded-full w-7 h-7 flex items-center justify-center bg-white/[0.06] text-white/50 hover:text-white/80 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default BottomSheet;
