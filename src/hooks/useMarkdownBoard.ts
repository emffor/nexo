'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCombinedContent,
  isContentBlank,
  normalizeMarkdownContent,
  reorderMarkdownItems,
} from '../lib/items';
import type { DiagramStatus, MarkdownItem } from '../types/markdown';
import { fetchProjectDetails } from '../services/projectsApi';
import {
  clearProjectItemsApi,
  createItemApi,
  deleteItemApi,
  reorderItemsApi,
  replaceProjectItemsApi,
  updateItemApi,
} from '../services/itemsApi';

export interface UseMarkdownBoardResult {
  items: MarkdownItem[];
  combinedContent: string;
  isLoading: boolean;
  loadError: string | null;
  retryLoad: () => void;
  addItem: (content: string, title?: string) => Promise<void>;
  updateItem: (itemId: string, content: string, title?: string) => Promise<void>;
  updateItemStatus: (itemId: string, status: DiagramStatus | undefined) => Promise<void>;
  updateItemObservation: (itemId: string, observation: string) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  reorderItems: (activeId: string, overId: string) => Promise<void>;
  clearItems: () => Promise<void>;
  replaceItems: (nextItems: MarkdownItem[]) => Promise<void>;
}

export function useMarkdownBoard(projectId: string): UseMarkdownBoardResult {
  const reorderQueue = useRef<Promise<void>>(Promise.resolve());
  const [items, setItems] = useState<MarkdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retryLoad = useCallback(() => setLoadAttempt((value) => value + 1), []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    const hydrate = async () => {
      try {
        const details = await fetchProjectDetails(projectId);
        if (!isMounted) return;

        setItems(details.items || []);
      } catch {
        if (isMounted) setLoadError('Não foi possível carregar os cards. Tente novamente.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [projectId, loadAttempt]);

  const combinedContent = useMemo(() => buildCombinedContent(items), [items]);

  const addItem = async (content: string, title?: string) => {
    const normalizedContent = normalizeMarkdownContent(content);

    if (isContentBlank(normalizedContent)) {
      return;
    }

    const cleanTitle = title?.trim() || undefined;

    const created = await createItemApi({
      projectId,
      content: normalizedContent,
      title: cleanTitle,
    });

    setItems((currentItems) => [...currentItems, created]);
  };

  const updateItem = async (itemId: string, content: string, title?: string) => {
    const normalizedContent = normalizeMarkdownContent(content);

    if (isContentBlank(normalizedContent)) {
      return;
    }

    const cleanTitle = title?.trim() || undefined;

    const saved = await updateItemApi(itemId, {
      content: normalizedContent,
      title: cleanTitle,
    });
    setItems((current) => current.map((item) => item.id === itemId
      ? { ...item, content: saved.content, title: saved.title, updatedAt: saved.updatedAt }
      : item));
  };

  const deleteItem = async (itemId: string) => {
    await deleteItemApi(itemId);
    setItems((current) => current.filter((item) => item.id !== itemId));
  };

  const updateItemStatus = async (itemId: string, status: DiagramStatus | undefined) => {
    const saved = await updateItemApi(itemId, { status });
    setItems((current) => current.map((item) => item.id === itemId
      ? { ...item, status: saved.status, updatedAt: saved.updatedAt } : item));
  };

  const updateItemObservation = async (itemId: string, observation: string) => {
    const saved = await updateItemApi(itemId, { observation: observation.trim() || undefined });
    setItems((current) => current.map((item) => item.id === itemId
      ? { ...item, observation: saved.observation, updatedAt: saved.updatedAt } : item));
  };

  const reorderItems = async (activeId: string, overId: string) => {
    const reorderedItems = reorderMarkdownItems(items, activeId, overId);
    if (reorderedItems === items) return;
    setItems(reorderedItems);
    try {
      const request = reorderQueue.current.then(() => reorderItemsApi(reorderedItems.map((item, order) => ({ id: item.id, order }))));
      reorderQueue.current = request.catch(() => undefined);
      await request;
    } catch (error) {
      setItems((current) => {
        if (current.length !== reorderedItems.length || current.some((item, index) => item.id !== reorderedItems[index].id)) return current;
        const currentById = new Map(current.map((item) => [item.id, item]));
        return items.map((item) => {
          const latest = currentById.get(item.id)!;
          const optimistic = reorderedItems.find((entry) => entry.id === item.id)!;
          return { ...latest, order: item.order, updatedAt: latest.updatedAt === optimistic.updatedAt ? item.updatedAt : latest.updatedAt };
        });
      });
      throw error;
    }
  };

  const clearItems = async () => {
    await clearProjectItemsApi(projectId);
    setItems([]);
  };

  const replaceItems = async (nextItems: MarkdownItem[]) => {
    const created = await replaceProjectItemsApi(projectId, nextItems.map((item) => ({
      ...item, content: normalizeMarkdownContent(item.content),
    })));
    setItems(created);
  };

  return {
    items,
    combinedContent,
    isLoading,
    loadError,
    retryLoad,
    addItem,
    updateItem,
    updateItemStatus,
    updateItemObservation,
    deleteItem,
    reorderItems,
    clearItems,
    replaceItems,
  };
}
