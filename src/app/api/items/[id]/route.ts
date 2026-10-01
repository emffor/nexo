import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCardTitle } from '@/lib/items';

interface Params {
  params: {
    id: string;
  };
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = params;
    const body = await req.json();

    const dataToUpdate: Record<string, unknown> = {};

    if (typeof body.content === 'string') {
      dataToUpdate.content = body.content;
      dataToUpdate.title = body.title || getCardTitle(body.content);
    } else if (typeof body.title === 'string') {
      dataToUpdate.title = body.title;
    }

    if (body.status !== undefined) {
      dataToUpdate.status = body.status || null;
    }

    if (body.observation !== undefined) {
      dataToUpdate.observation = body.observation || null;
    }

    const item = await prisma.markdownItem.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      id: item.id,
      projectId: item.projectId,
      title: item.title ?? undefined,
      content: item.content,
      order: item.order,
      status: item.status ?? undefined,
      observation: item.observation ?? undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Erro ao atualizar item markdown:', error);
    return NextResponse.json(
      { error: 'Falha ao atualizar item' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = params;
    await prisma.markdownItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar item markdown:', error);
    return NextResponse.json(
      { error: 'Falha ao deletar item' },
      { status: 500 }
    );
  }
}
