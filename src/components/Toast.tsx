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

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;

    const duration = message.action ? 5000 : 2800;

    const timer = setTimeout(() => {
      setIsVisible(false);
      dismissTimer = setTimeout(() => onDismiss(message.id), 300);
    }, duration);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, [message.id, message.action, onDismiss]);

  return (
    <div
      data-theme={theme}
      data-kind={message.type ?? "success"}
      role={message.type === "error" ? "alert" : "status"}
      aria-atomic="true"
      className={`nexo-ui nexo-toast px-4 py-3 text-sm font-medium transition-all duration-300 ${
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
          className="nexo-toast-action ml-3 px-3 py-1 text-sm font-medium transition"
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
    <div className="fixed bottom-6 right-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:right-6">
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
