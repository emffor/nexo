"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

interface ResizableColumnsProps {
  left: ReactNode;
  right: ReactNode;
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  separatorLabel?: string;
}

function clampWidth(value: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
}

function readStoredWidth(
  storageKey: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
): number {
  if (typeof window === "undefined") {
    return defaultWidth;
  }

  const rawValue = window.localStorage.getItem(storageKey);

  if (!rawValue) {
    return defaultWidth;
  }

  const parsed = Number(rawValue);

  return Number.isFinite(parsed)
    ? clampWidth(parsed, minWidth, maxWidth)
    : defaultWidth;
}

export function ResizableColumns({
  left,
  right,
  storageKey,
  defaultWidth = 320,
  minWidth = 220,
  maxWidth = 640,
  separatorLabel = "Arraste para redimensionar a coluna",
}: ResizableColumnsProps) {
  const [leftWidth, setLeftWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  useEffect(() => {
    setLeftWidth(readStoredWidth(storageKey, defaultWidth, minWidth, maxWidth));
  }, [defaultWidth, maxWidth, minWidth, storageKey]);

  const commitWidth = useCallback(
    (width: number) => {
      const clamped = clampWidth(width, minWidth, maxWidth);
      setLeftWidth(clamped);
      window.localStorage.setItem(storageKey, String(clamped));
    },
    [maxWidth, minWidth, storageKey],
  );

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    document.documentElement.classList.add("nexo-resizing-x");

    return () => {
      document.documentElement.classList.remove("nexo-resizing-x");
    };
  }, [isDragging]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStateRef.current = { startX: event.clientX, startWidth: leftWidth };
    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragStateRef.current) {
        return;
      }

      setLeftWidth(
        clampWidth(
          dragStateRef.current.startWidth + (moveEvent.clientX - dragStateRef.current.startX),
          minWidth,
          maxWidth,
        ),
      );
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (dragStateRef.current) {
        commitWidth(
          dragStateRef.current.startWidth + (upEvent.clientX - dragStateRef.current.startX),
        );
      }

      dragStateRef.current = null;
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 16;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      commitWidth(leftWidth - step);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      commitWidth(leftWidth + step);
    } else if (event.key === "Home") {
      event.preventDefault();
      commitWidth(minWidth);
    } else if (event.key === "End") {
      event.preventDefault();
      commitWidth(maxWidth);
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
      <div
        className="nexo-resizable-left min-h-0 w-full lg:shrink-0"
        style={{ ["--nexo-sidebar-width" as string]: `${leftWidth}px` }}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={separatorLabel}
        aria-valuenow={leftWidth}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        data-dragging={isDragging}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        className="nexo-resizer hidden shrink-0 lg:flex"
      />
      <div className="min-h-0 min-w-0 flex-1">{right}</div>
    </div>
  );
}
