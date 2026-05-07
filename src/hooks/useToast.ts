'use client';

import { useCallback, useState } from 'react';
import type { ToastMessage } from '../components/Toast';

export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (
      text: string,
      type: ToastMessage['type'] = 'success',
      action?: ToastMessage['action'],
    ) => {
      const id = crypto.randomUUID();
      setMessages((current) => [...current, { id, text, type, action }]);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setMessages((current) => current.filter((msg) => msg.id !== id));
  }, []);

  return { messages, addToast, dismissToast };
}
