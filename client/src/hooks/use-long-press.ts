import { useRef, useCallback } from "react";

/**
 * Returns handlers to attach to an element for long-press detection.
 * Fires `onLongPress` after `delayMs` of continuous hold.
 * Cancels if the pointer is released, moved meaningfully, or leaves the element.
 */
export function useLongPress(onLongPress: () => void, delayMs = 500) {
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (e: React.PointerEvent) => {
      // Left mouse button only; allow touch/pen (non-mouse types have button = 0 too)
      if (e.pointerType === "mouse" && e.button !== 0) return;
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      clear();
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        onLongPress();
      }, delayMs);
    },
    [clear, delayMs, onLongPress],
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (dx * dx + dy * dy > 100) clear(); // >10px = treat as scroll/drag, cancel
    },
    [clear],
  );

  const end = useCallback(() => {
    clear();
    startRef.current = null;
  }, [clear]);

  return {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: end,
    onPointerLeave: end,
    onPointerCancel: end,
    // Prevent the native right-click/long-press context menu from competing with our gesture.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
