import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
        databaseDiagram: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Projeto não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        order: project.order,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        diagramState: project.diagramState ?? undefined,
        hiddenDiagramItemIds: project.hiddenDiagramItemIds,
      },
      items: project.items.map((item) => ({
        id: item.id,
        projectId: item.projectId,
        title: item.title ?? undefined,
        content: item.content,
        order: item.order,
        status: item.status ?? undefined,
        observation: item.observation ?? undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      databaseDiagram: project.databaseDiagram
        ? {
            id: project.databaseDiagram.id,
            projectId: project.databaseDiagram.projectId,
            title: project.databaseDiagram.title,
            content: project.databaseDiagram.content,
            state: project.databaseDiagram.state ?? { positions: {} },
            createdAt: project.databaseDiagram.createdAt.toISOString(),
            updatedAt: project.databaseDiagram.updatedAt.toISOString(),
          }
        : undefined,
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes do projeto:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar projeto' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = params;
    const body = await req.json();

    const dataToUpdate: Record<string, unknown> = {};
    if (typeof body.name === 'string') {
      dataToUpdate.name = body.name.trim() || 'Projeto sem nome';
    }
    if (typeof body.order === 'number') {
      dataToUpdate.order = body.order;
    }
    if (body.diagramState !== undefined) {
      dataToUpdate.diagramState = body.diagramState;
    }
    if (Array.isArray(body.hiddenDiagramItemIds)) {
      dataToUpdate.hiddenDiagramItemIds = body.hiddenDiagramItemIds;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      order: updated.order,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      diagramState: updated.diagramState ?? undefined,
      hiddenDiagramItemIds: updated.hiddenDiagramItemIds,
    });
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    return NextResponse.json(
      { error: 'Falha ao atualizar projeto' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = params;
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar projeto:', error);
    return NextResponse.json(
      { error: 'Falha ao deletar projeto' },
      { status: 500 }
    );
  }
}
