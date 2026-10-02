import { NextResponse } from 'next/server';
import { getJiraAttachment, JiraImportError } from '../../../../../services/jiraServer';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'A consulta ao Jira está disponível apenas em desenvolvimento.' }, { status: 503, headers });
  }
  try {
    const image = await getJiraAttachment(params.id);
    return new Response(image.content, {
      headers: { ...headers, 'Content-Type': image.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof JiraImportError ? error.message : 'Falha ao carregar imagem do Jira.' },
      { status: error instanceof JiraImportError ? error.status : 502, headers },
    );
  }
}
