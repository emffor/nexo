import { NextResponse } from 'next/server';
import type { MarkdownItem } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCardTitle } from '@/lib/items';
import { DIAGRAM_STATUS_OPTIONS } from '@/types/diagram';

type ItemInput = {
  id?: string;
  projectId?: string;
  content?: string;
  title?: string | null;
  order?: number;
  status?: string | null;
  observation?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isItem(value: unknown): value is ItemInput {
  if (!isRecord(value)) return false;
  return (value.id === undefined || isId(value.id))
    && (value.projectId === undefined || isId(value.projectId))
    && (value.content === undefined || typeof value.content === 'string')
    && ['title', 'observation'].every((key) => value[key] == null || typeof value[key] === 'string')
    && (value.order === undefined || (Number.isSafeInteger(value.order) && Number(value.order) >= 0))
    && (value.status == null || value.status === '' || DIAGRAM_STATUS_OPTIONS.some((option) => option.value === value.status));
}

function itemData(item: ItemInput, projectId: string, order: number) {
  const content = item.content ?? '';
  return {
    id: item.id,
    projectId,
    content,
    title: item.title || getCardTitle(content),
    order,
    status: item.status || null,
    observation: item.observation || null,
  };
}

function serializeItem(item: MarkdownItem) {
  return { ...item, title: item.title ?? undefined, status: item.status ?? undefined, observation: item.observation ?? undefined };
}

function invalidPayload() {
  return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
}

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  if (!isRecord(body) || !isId(body.projectId)) return invalidPayload();
  const { projectId, batchItems } = body;
  if (batchItems !== undefined && (!Array.isArray(batchItems)
    || !batchItems.every((item) => isItem(item) && (!item.projectId || item.projectId === projectId)))) {
    return invalidPayload();
  }
  if (batchItems === undefined && !isItem(body)) return invalidPayload();

  try {
    const last = await prisma.markdownItem.aggregate({ where: { projectId }, _max: { order: true } });
    const nextOrder = (last._max.order ?? -1) + 1;
    if (Array.isArray(batchItems)) {
      const result = await prisma.markdownItem.createMany({
        data: (batchItems as ItemInput[]).map((item, index) => itemData(item, projectId, item.order ?? nextOrder + index)),
        skipDuplicates: true,
      });
      return NextResponse.json({ success: true, count: result.count }, { status: 201 });
    }
    const item = await prisma.markdownItem.create({ data: itemData(body, projectId, nextOrder) });
    return NextResponse.json(serializeItem(item), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Falha ao criar item' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  if (!isRecord(body)) return invalidPayload();
  const { items, clearProjectId, replaceProjectId } = body;
  if (clearProjectId !== undefined && (!isId(clearProjectId) || items !== undefined || replaceProjectId !== undefined)) return invalidPayload();
  if (replaceProjectId !== undefined && (!isId(replaceProjectId) || !Array.isArray(items)
    || !items.every((item) => isItem(item) && isId(item.id) && typeof item.content === 'string')
    || new Set(items.map((item) => item.id)).size !== items.length)) return invalidPayload();
  if (replaceProjectId === undefined && items !== undefined && (!Array.isArray(items)
    || !items.every((item) => isRecord(item) && isId(item.id) && Number.isSafeInteger(item.order) && Number(item.order) >= 0))) return invalidPayload();

  try {
    if (isId(clearProjectId)) {
      await prisma.markdownItem.deleteMany({ where: { projectId: clearProjectId } });
      return NextResponse.json({ success: true });
    }
    if (isId(replaceProjectId) && Array.isArray(items)) {
      // Colisões com IDs de outros projetos abortam a transação sem apagar os cards atuais.
      const replaced = await prisma.$transaction(async (tx) => {
        await tx.markdownItem.deleteMany({ where: { projectId: replaceProjectId } });
        await tx.markdownItem.createMany({
          data: (items as ItemInput[]).map((item, order) => itemData(item, replaceProjectId, order)),
        });
        return tx.markdownItem.findMany({ where: { projectId: replaceProjectId }, orderBy: { order: 'asc' } });
      });
      return NextResponse.json(replaced.map(serializeItem));
    }
    if (Array.isArray(items)) {
      await prisma.$transaction(items.map((item: { id: string; order: number }) =>
        prisma.markdownItem.update({ where: { id: item.id }, data: { order: item.order } })));
      return NextResponse.json({ success: true });
    }
    return invalidPayload();
  } catch {
    return NextResponse.json({ error: 'Falha na operação em lote' }, { status: 500 });
  }
}
