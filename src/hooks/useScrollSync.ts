"use client";
import { useEffect, useRef } from "react";

export function useScrollSync(enabled: boolean, itemCount: number) {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const syncSourceRef = useRef<"left" | "right" | null>(null);
  useEffect(() => {
    if (!enabled) {
      syncSourceRef.current = null;
      return;
    }

    const leftElement = leftScrollRef.current;
    const rightElement = rightScrollRef.current;

    if (!leftElement || !rightElement) {
      return;
    }

    let frame: number | undefined;
    const syncScroll = (
      source: HTMLDivElement,
      target: HTMLDivElement,
      sourceName: "left" | "right",
    ) => {
      if (syncSourceRef.current && syncSourceRef.current !== sourceName) {
        return;
      }

      syncSourceRef.current = sourceName;

      const maxSourceScroll = source.scrollHeight - source.clientHeight;
      const maxTargetScroll = target.scrollHeight - target.clientHeight;
      const ratio =
        maxSourceScroll > 0 ? source.scrollTop / maxSourceScroll : 0;
      target.scrollTop = maxTargetScroll > 0 ? ratio * maxTargetScroll : 0;

      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        syncSourceRef.current = null;
      });
    };

    const handleLeftScroll = () =>
      syncScroll(leftElement, rightElement, "left");
    const handleRightScroll = () =>
      syncScroll(rightElement, leftElement, "right");

    leftElement.addEventListener("scroll", handleLeftScroll, { passive: true });
    rightElement.addEventListener("scroll", handleRightScroll, {
      passive: true,
    });

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      syncSourceRef.current = null;
      leftElement.removeEventListener("scroll", handleLeftScroll);
      rightElement.removeEventListener("scroll", handleRightScroll);
    };
  }, [enabled, itemCount]);

  return { leftScrollRef, rightScrollRef };
}
