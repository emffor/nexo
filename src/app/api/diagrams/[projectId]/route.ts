import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_DATABASE_DBML } from '@/types/database';

interface Params {
  params: {
    projectId: string;
  };
}

const DEFAULT_TITLE = 'Diagrama principal';

export async function GET(_req: Request, { params }: Params) {
  try {
    const { projectId } = params;

    let diagram = await prisma.databaseDiagram.findUnique({
      where: { projectId },
    });

    if (!diagram) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
      // A leitura entrega o exemplo; somente PUT/DELETE persistem o diagrama.
      diagram = {
        id: projectId,
        projectId,
        title: DEFAULT_TITLE,
        content: DEFAULT_DATABASE_DBML,
        state: { positions: {}, viewport: { x: 0, y: 0, scale: 1 } },
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      };
    }

    return NextResponse.json({
      id: diagram.id,
      projectId: diagram.projectId,
      title: diagram.title,
      content: diagram.content,
      state: diagram.state ?? { positions: {} },
      createdAt: diagram.createdAt.toISOString(),
      updatedAt: diagram.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Erro ao buscar diagrama do banco:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar diagrama' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { projectId } = params;
    const body = await req.json();

    const dataToUpdate: Record<string, unknown> = {};
    if (typeof body.title === 'string') {
      dataToUpdate.title = body.title;
    }
    if (typeof body.content === 'string') {
      dataToUpdate.content = body.content;
    }
    if (body.state !== undefined) {
      dataToUpdate.state = body.state;
    }

    const diagram = await prisma.databaseDiagram.upsert({
      where: { projectId },
      create: {
        id: projectId,
        projectId,
        title: body.title || DEFAULT_TITLE,
        content: body.content ?? DEFAULT_DATABASE_DBML,
        state: body.state ?? { positions: {} },
      },
      update: dataToUpdate,
    });

    return NextResponse.json({
      id: diagram.id,
      projectId: diagram.projectId,
      title: diagram.title,
      content: diagram.content,
      state: diagram.state ?? { positions: {} },
      createdAt: diagram.createdAt.toISOString(),
      updatedAt: diagram.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Erro ao salvar diagrama de banco:', error);
    return NextResponse.json(
      { error: 'Falha ao salvar diagrama' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { projectId } = params;

    const fresh = await prisma.databaseDiagram.upsert({
      where: { projectId },
      create: {
        id: projectId,
        projectId,
        title: DEFAULT_TITLE,
        content: DEFAULT_DATABASE_DBML,
        state: { positions: {}, viewport: { x: 0, y: 0, scale: 1 } },
      },
      update: {
        title: DEFAULT_TITLE,
        content: DEFAULT_DATABASE_DBML,
        state: { positions: {}, viewport: { x: 0, y: 0, scale: 1 } },
      },
    });

    return NextResponse.json({
      id: fresh.id,
      projectId: fresh.projectId,
      title: fresh.title,
      content: fresh.content,
      state: fresh.state ?? { positions: {} },
      createdAt: fresh.createdAt.toISOString(),
      updatedAt: fresh.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Erro ao resetar diagrama de banco:', error);
    return NextResponse.json(
      { error: 'Falha ao resetar diagrama' },
      { status: 500 }
    );
  }
}
