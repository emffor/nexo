import { NextResponse } from 'next/server';
import { importJiraIssue, JiraImportError } from '../../../../../services/jiraServer';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { key: string } }) {
  const headers = { 'Cache-Control': 'no-store' };

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'A consulta ao Jira está disponível em desenvolvimento. Configure a proteção de acesso antes de habilitá-la em produção.' },
      { status: 503, headers },
    );
  }

  try {
    const card = await importJiraIssue(params.key);
    return NextResponse.json(card, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof JiraImportError ? error.message : 'Falha ao importar task do Jira.' },
      { status: error instanceof JiraImportError ? error.status : 502, headers },
    );
  }
}
