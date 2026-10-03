import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddMarkdownModal } from './AddMarkdownModal';

afterEach(() => { vi.unstubAllGlobals(); });

function renderModal(props: Partial<Parameters<typeof AddMarkdownModal>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const view = render(<AddMarkdownModal open onSave={onSave} onClose={onClose} {...props} />);
  return { ...view, onSave, onClose };
}

describe('importação de task no modal', () => {
  it('busca automaticamente pela chave e só salva após confirmação do usuário', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'P2M-1185', content: '# Task\n\nDescrição' })));
    vi.stubGlobal('fetch', fetchMock);
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/título do card/i), { target: { value: 'p2m-1185' } });
    await waitFor(() => expect(screen.getByLabelText('Conteúdo Markdown')).toHaveValue('# Task\n\nDescrição'), { timeout: 2000 });
    expect(fetchMock).toHaveBeenCalledWith('/api/jira/issues/P2M-1185', expect.objectContaining({ cache: 'no-store' }));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Criar card' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('# Task\n\nDescrição', 'P2M-1185'));
  });

  it('não busca por títulos livres nem substitui conteúdo existente automaticamente', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { rerender, onSave, onClose } = renderModal({ initialTitle: 'Título livre' });
    expect(screen.getByRole('button', { name: 'Buscar no Jira' })).toBeDisabled();
    rerender(<AddMarkdownModal open initialTitle="P2M-1185" initialValue="# Manual" onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar no Jira' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Substituir conteúdo pelo Jira?');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText('Conteúdo Markdown')).toHaveValue('# Manual');
  });

  it('importa pela URL ao confirmar substituição e preserva edição manual posterior', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'P2M-1185', content: '# Jira' })));
    vi.stubGlobal('fetch', fetchMock);
    renderModal({ mode: 'edit', initialTitle: 'https://example.atlassian.net/browse/P2M-1185', initialValue: '# Manual' });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar no Jira' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar e substituir' }));
    await waitFor(() => expect(screen.getByLabelText('Conteúdo Markdown')).toHaveValue('# Jira'));
    fireEvent.change(screen.getByLabelText('Conteúdo Markdown'), { target: { value: '# Revisado' } });
    expect(screen.getByLabelText('Conteúdo Markdown')).toHaveValue('# Revisado');
  });

  it('preserva conteúdo e apresenta erro quando Jira falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Task não encontrada.' }), { status: 404 })));
    renderModal({ mode: 'edit', initialTitle: 'P2M-1185', initialValue: '# Manual' });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar no Jira' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar e substituir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Task não encontrada.');
    expect(screen.getByLabelText('Conteúdo Markdown')).toHaveValue('# Manual');
  });

  it('ignora uma resposta antiga se o título mudar durante a busca', async () => {
    let resolveRequest!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveRequest = resolve; })));
    renderModal({ mode: 'edit', initialTitle: 'P2M-1185' });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar no Jira' }));
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/título do card/i), { target: { value: 'P2M-2' } });
    resolveRequest(new Response(JSON.stringify({ title: 'P2M-1185', content: '# Antigo' })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled());
    expect(screen.getByLabelText(/título do card/i)).toHaveValue('P2M-2');
    expect(screen.getByLabelText('Conteúdo Markdown')).toHaveValue('');
  });
});

describe('ciclo de edição do modal', () => {
  it('descarta o rascunho ao fechar e reabrir', () => {
    const { rerender, onSave, onClose } = renderModal({ initialValue: '# Original' });
    fireEvent.change(screen.getByLabelText('Conteúdo Markdown'), { target: { value: '# Rascunho' } });
    rerender(<AddMarkdownModal open={false} initialValue="# Original" onSave={onSave} onClose={onClose} />);
    rerender(<AddMarkdownModal open initialValue="# Original" onSave={onSave} onClose={onClose} />);
    expect(screen.getByLabelText('Conteúdo Markdown')).toHaveValue('# Original');
  });

  it('preserva o rascunho quando o salvamento falha', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('offline'));
    const { onClose } = renderModal({ initialValue: '# Rascunho', onSave });
    fireEvent.click(screen.getByRole('button', { name: 'Criar card' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
    expect(screen.getByLabelText('Conteúdo Markdown')).toHaveValue('# Rascunho');
    expect(onClose).not.toHaveBeenCalled();
  });
});
