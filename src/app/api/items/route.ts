import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCardTitle } from '@/lib/items';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, content, title, id, status, observation } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId é obrigatório' },
        { status: 400 }
      );
    }

    const currentCount = await prisma.markdownItem.count({
      where: { projectId },
    });

    // Suporte a criação em lote (usado na importação de arquivos)
    if (Array.isArray(body.batchItems)) {
      const itemsData = body.batchItems.map((item: any, idx: number) => {
        const safeContent = typeof item.content === 'string' ? item.content : '';
        return {
          id: item.id || undefined,
          projectId: item.projectId || projectId,
          content: safeContent,
          title: item.title || getCardTitle(safeContent),
          order: typeof item.order === 'number' ? item.order : currentCount + idx,
          status: item.status || null,
          observation: item.observation || null,
        };
      });

      await prisma.markdownItem.createMany({
        data: itemsData,
        skipDuplicates: true,
      });

      return NextResponse.json({ success: true, count: itemsData.length }, { status: 201 });
    }

    const safeContent = typeof content === 'string' ? content : '';
    const safeTitle = title || getCardTitle(safeContent);

    const item = await prisma.markdownItem.create({
      data: {
        id: id || undefined,
        projectId,
        content: safeContent,
        title: safeTitle,
        order: currentCount,
        status: status || null,
        observation: observation || null,
      },
    });

    return NextResponse.json(
      {
        id: item.id,
        projectId: item.projectId,
        title: item.title ?? undefined,
        content: item.content,
        order: item.order,
        status: item.status ?? undefined,
        observation: item.observation ?? undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar item markdown:', error);
    return NextResponse.json(
      { error: 'Falha ao criar item' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { items, clearProjectId } = body;

    // Se solicitado limpar todos os itens de um projeto
    if (clearProjectId) {
      await prisma.markdownItem.deleteMany({
        where: { projectId: clearProjectId },
      });
      return NextResponse.json({ success: true });
    }

    // Reordenação em lote
    if (Array.isArray(items)) {
      await prisma.$transaction(
        items.map((item: { id: string; order: number }) =>
          prisma.markdownItem.update({
            where: { id: item.id },
            data: { order: item.order },
          })
        )
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao atualizar múltiplos itens:', error);
    return NextResponse.json(
      { error: 'Falha na operação em lote' },
      { status: 500 }
    );
  }
}
