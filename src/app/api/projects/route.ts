import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    const mapped = projects.map((p) => ({
      id: p.id,
      name: p.name,
      order: p.order,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      diagramState: p.diagramState ?? undefined,
      hiddenDiagramItemIds: p.hiddenDiagramItemIds,
      itemsCount: p._count.items,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Erro ao listar projetos:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar projetos' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, id } = body;
    const projectName = name ? String(name).trim() || 'Sem nome' : 'Novo projeto';

    let project;
    if (id) {
      // Se um ID específico foi fornecido (ex: default-project), usa upsert para evitar colisão em concorrência
      project = await prisma.project.upsert({
        where: { id },
        create: {
          id,
          name: projectName,
          order: 0,
        },
        update: {},
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      return NextResponse.json(
        {
          id: project.id,
          name: project.name,
          order: project.order,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          diagramState: project.diagramState ?? undefined,
          hiddenDiagramItemIds: project.hiddenDiagramItemIds,
          itemsCount: project._count?.items ?? 0,
        },
        { status: 200 }
      );
    }

    const count = await prisma.project.count();
    project = await prisma.project.create({
      data: {
        name: projectName,
        order: count,
      },
    });

    return NextResponse.json(
      {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        diagramState: project.diagramState ?? undefined,
        hiddenDiagramItemIds: project.hiddenDiagramItemIds,
        itemsCount: 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    return NextResponse.json(
      { error: 'Falha ao criar projeto' },
      { status: 500 }
    );
  }
}
