"use client";

import { useCallback, useRef } from "react";

interface SwipeConfig {
  threshold?: number;        // Min distance in px (default: 50)
  velocityThreshold?: number; // Min velocity in px/ms (default: 0.3)
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  disabled?: boolean;
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipe(config: SwipeConfig): SwipeHandlers {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    disabled = false,
  } = config;

  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const deltaRef = useRef({ x: 0, y: 0 });
  const isSwipingRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    const touch = e.touches[0];
    startRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    deltaRef.current = { x: 0, y: 0 };
    isSwipingRef.current = false;
  }, [disabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !startRef.current) return;

    const touch = e.touches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;

    deltaRef.current = { x: dx, y: dy };

    // Determine if this is a horizontal swipe (not vertical scroll)
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // If horizontal movement dominates and exceeds threshold, mark as swiping
    if (absX > absY * 1.5 && absX > 10) {
      isSwipingRef.current = true;
      // Prevent default to stop scrolling while swiping horizontally
      e.preventDefault();
    }
  }, [disabled]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled || !startRef.current) return;

    const { x: dx, y: dy } = deltaRef.current;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const elapsed = Date.now() - startRef.current.time;

    // Calculate velocity (px/ms)
    const velocityX = elapsed > 0 ? absX / elapsed : 0;
    const velocityY = elapsed > 0 ? absY / elapsed : 0;

    // Reset refs
    startRef.current = null;
    deltaRef.current = { x: 0, y: 0 };

    // Determine swipe direction if threshold met
    // Horizontal swipe: x movement dominates
    if (absX > absY * 1.2 && (absX >= threshold || velocityX >= velocityThreshold)) {
      if (dx < 0 && onSwipeLeft) {
        onSwipeLeft();
        return;
      }
      if (dx > 0 && onSwipeRight) {
        onSwipeRight();
        return;
      }
    }

    // Vertical swipe: y movement dominates
    if (absY > absX * 1.2 && (absY >= threshold || velocityY >= velocityThreshold)) {
      if (dy < 0 && onSwipeUp) {
        onSwipeUp();
        return;
      }
      if (dy > 0 && onSwipeDown) {
        onSwipeDown();
        return;
      }
    }
  }, [disabled, threshold, velocityThreshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
