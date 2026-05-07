'use client';

import { useEffect, useState } from "react";
import type { AppTheme } from "../lib/preferences";

export interface ToastMessage {
  id: string;
  text: string;
  type?: "success" | "error" | "info";
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  messages: ToastMessage[];
  theme?: AppTheme;
  onDismiss: (id: string) => void;
}

function ToastItem({
  message,
  theme = "dark",
  onDismiss,
}: {
  message: ToastMessage;
  theme?: AppTheme;
  onDismiss: (id: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const duration = message.action ? 5000 : 2800;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(message.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  const darkColorMap: Record<string, string> = {
    success: "border-teal-500/40 bg-teal-950/90 text-teal-200",
    error: "border-rose-500/40 bg-rose-950/90 text-rose-200",
    info: "border-sky-500/40 bg-sky-950/90 text-sky-200",
  };

  const lightColorMap: Record<string, string> = {
    success: "border-teal-300 bg-white text-teal-800 shadow-md",
    error: "border-rose-300 bg-white text-rose-800 shadow-md",
    info: "border-sky-300 bg-white text-sky-800 shadow-md",
  };

  const colorMap = isDark ? darkColorMap : lightColorMap;
  const colors = colorMap[message.type ?? "success"] ?? colorMap.success;

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-sm transition-all duration-300 ${colors} ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <span>{message.text}</span>
      {message.action ? (
        <button
          type="button"
          onClick={() => {
            message.action?.onClick();
            onDismiss(message.id);
          }}
          className={`ml-3 rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide transition ${
            isDark
              ? "bg-white/10 hover:bg-white/20"
              : "bg-black/5 hover:bg-black/10"
          }`}
        >
          {message.action.label}
        </button>
      ) : null}
    </div>
  );
}

export function ToastContainer({
  messages,
  theme = "dark",
  onDismiss,
}: ToastProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
      {messages.map((msg) => (
        <ToastItem
          key={msg.id}
          message={msg}
          theme={theme}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
