'use client';

import { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/db';
import { sanitizeFlowLinks } from '../lib/flow';
import {
  buildCombinedContent,
  isContentBlank,
  normalizeMarkdownContent,
  reorderMarkdownItems,
} from '../lib/items';
import type { FlowLink, MarkdownItem } from '../types/markdown';

export interface UseMarkdownBoardResult {
  items: MarkdownItem[];
  flowLinks: FlowLink[];
  combinedContent: string;
  isLoading: boolean;
  addItem: (content: string, title?: string) => Promise<void>;
  updateItem: (itemId: string, content: string, title?: string) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  reorderItems: (activeId: string, overId: string) => Promise<void>;
  replaceFlowLinks: (nextLinks: FlowLink[]) => Promise<void>;
  clearItems: () => Promise<void>;
  replaceItems: (nextItems: MarkdownItem[], nextLinks?: FlowLink[]) => Promise<void>;
}

async function loadItems(): Promise<MarkdownItem[]> {
  const storedItems = await db.items.orderBy('order').toArray();
  let hasNormalizedItem = false;

  const normalizedItems = storedItems.map((item) => {
    const normalizedContent = normalizeMarkdownContent(item.content);

    if (normalizedContent === item.content) {
      return item;
    }

    hasNormalizedItem = true;

    return {
      ...item,
      content: normalizedContent,
      updatedAt: new Date().toISOString(),
    };
  });

  if (hasNormalizedItem) {
    await db.items.bulkPut(normalizedItems);
  }

  return normalizedItems;
}

export function useMarkdownBoard(): UseMarkdownBoardResult {
  const [items, setItems] = useState<MarkdownItem[]>([]);
  const [flowLinks, setFlowLinks] = useState<FlowLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      const storedItems = await loadItems();
      const storedFlowLinks = await db.flowLinks.toArray();

      if (!isMounted) {
        return;
      }

      setItems(storedItems);
      setFlowLinks(sanitizeFlowLinks(storedFlowLinks, storedItems));
      setIsLoading(false);
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  const combinedContent = useMemo(() => buildCombinedContent(items), [items]);

  const addItem = async (content: string, title?: string) => {
    const normalizedContent = normalizeMarkdownContent(content);

    if (isContentBlank(normalizedContent)) {
      return;
    }

    const cleanTitle = title?.trim() || undefined;
    const timestamp = new Date().toISOString();
    const nextItem: MarkdownItem = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      content: normalizedContent,
      order: items.length,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setItems((currentItems) => [...currentItems, nextItem]);
    await db.items.put(nextItem);
  };

  const updateItem = async (itemId: string, content: string, title?: string) => {
    const normalizedContent = normalizeMarkdownContent(content);

    if (isContentBlank(normalizedContent)) {
      return;
    }

    const currentItem = items.find((item) => item.id === itemId);
    if (!currentItem) {
      return;
    }

    const cleanTitle = title?.trim() || undefined;
    const timestamp = new Date().toISOString();
    const updatedItem: MarkdownItem = {
      ...currentItem,
      title: cleanTitle,
      content: normalizedContent,
      updatedAt: timestamp,
    };

    setItems((currentItems) =>
      currentItems.map((item) => (item.id === itemId ? updatedItem : item)),
    );
    await db.items.put(updatedItem);
  };

  const deleteItem = async (itemId: string) => {
    const now = new Date().toISOString();
    const remaining = items
      .filter((item) => item.id !== itemId)
      .map((item, index) => ({ ...item, order: index, updatedAt: now }));
    const remainingLinks = flowLinks.filter(
      (link) => link.sourceId !== itemId && link.targetId !== itemId,
    );

    setItems(remaining);
    setFlowLinks(remainingLinks);
    await db.transaction('rw', db.items, db.flowLinks, async () => {
      await db.items.delete(itemId);
      await db.flowLinks
        .where('sourceId')
        .equals(itemId)
        .or('targetId')
        .equals(itemId)
        .delete();
      if (remaining.length > 0) {
        await db.items.bulkPut(remaining);
      }
    });
  };

  const reorderItems = async (activeId: string, overId: string) => {
    const reorderedItems = reorderMarkdownItems(items, activeId, overId);

    if (reorderedItems === items) {
      return;
    }

    setItems(reorderedItems);
    await db.transaction('rw', db.items, async () => {
      await db.items.bulkPut(reorderedItems);
    });
  };

  const replaceFlowLinks = async (nextLinks: FlowLink[]) => {
    const sanitizedLinks = sanitizeFlowLinks(nextLinks, items);

    setFlowLinks(sanitizedLinks);
    await db.transaction('rw', db.flowLinks, async () => {
      await db.flowLinks.clear();
      if (sanitizedLinks.length > 0) {
        await db.flowLinks.bulkPut(sanitizedLinks);
      }
    });
  };

  const clearItems = async () => {
    setItems([]);
    setFlowLinks([]);
    await db.transaction('rw', db.items, db.flowLinks, async () => {
      await db.items.clear();
      await db.flowLinks.clear();
    });
  };

  const replaceItems = async (nextItems: MarkdownItem[], nextLinks: FlowLink[] = []) => {
    const normalizedItems = nextItems.map((item) => ({
      ...item,
      content: normalizeMarkdownContent(item.content),
    }));
    const sanitizedLinks = sanitizeFlowLinks(nextLinks, normalizedItems);

    setItems(normalizedItems);
    setFlowLinks(sanitizedLinks);
    await db.transaction('rw', db.items, db.flowLinks, async () => {
      await db.items.clear();
      await db.flowLinks.clear();
      if (normalizedItems.length > 0) {
        await db.items.bulkPut(normalizedItems);
      }
      if (sanitizedLinks.length > 0) {
        await db.flowLinks.bulkPut(sanitizedLinks);
      }
    });
  };

  return {
    items,
    flowLinks,
    combinedContent,
    isLoading,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    replaceFlowLinks,
    clearItems,
    replaceItems,
  };
}
