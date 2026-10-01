'use client';

import { useEffect, useMemo, useState } from 'react';
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
  updateItemApi,
} from '../services/itemsApi';

export interface UseMarkdownBoardResult {
  items: MarkdownItem[];
  combinedContent: string;
  isLoading: boolean;
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
  const [items, setItems] = useState<MarkdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const hydrate = async () => {
      try {
        const details = await fetchProjectDetails(projectId);
        if (!isMounted) return;

        setItems(details.items || []);
      } catch (err) {
        console.error('Erro ao carregar itens:', err);
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
  }, [projectId]);

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

    // Atualização otimista
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              title: cleanTitle,
              content: normalizedContent,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );

    await updateItemApi(itemId, {
      content: normalizedContent,
      title: cleanTitle,
    });
  };

  const deleteItem = async (itemId: string) => {
    const remaining = items
      .filter((item) => item.id !== itemId)
      .map((item, index) => ({ ...item, order: index }));

    setItems(remaining);
    await deleteItemApi(itemId);
  };

  const updateItemStatus = async (
    itemId: string,
    status: DiagramStatus | undefined
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, status } : item
      )
    );
    await updateItemApi(itemId, { status });
  };

  const updateItemObservation = async (
    itemId: string,
    observation: string
  ) => {
    const cleanObservation = observation.trim() || undefined;
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, observation: cleanObservation } : item
      )
    );
    await updateItemApi(itemId, { observation: cleanObservation });
  };

  const reorderItems = async (activeId: string, overId: string) => {
    const reorderedItems = reorderMarkdownItems(items, activeId, overId);

    if (reorderedItems === items) {
      return;
    }

    setItems(reorderedItems);
    await reorderItemsApi(
      reorderedItems.map((it, idx) => ({ id: it.id, order: idx }))
    );
  };

  const clearItems = async () => {
    setItems([]);
    await clearProjectItemsApi(projectId);
  };

  const replaceItems = async (nextItems: MarkdownItem[]) => {
    await clearProjectItemsApi(projectId);
    const createdList: MarkdownItem[] = [];

    for (const item of nextItems) {
      const created = await createItemApi({
        projectId,
        content: normalizeMarkdownContent(item.content),
        title: item.title,
        status: item.status,
        observation: item.observation,
      });
      createdList.push(created);
    }

    setItems(createdList);
  };

  return {
    items,
    combinedContent,
    isLoading,
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
