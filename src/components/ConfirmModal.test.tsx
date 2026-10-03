import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

it('mantém o foco no diálogo e devolve ao acionador ao fechar', async () => {
  const user = userEvent.setup();
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  trigger.focus();
  const onCancel = vi.fn();
  const { unmount } = render(<ConfirmModal open title="Excluir" description="Confirme a exclusão" onCancel={onCancel} onConfirm={vi.fn()} />);
  expect(screen.getByRole('alertdialog', { name: 'Excluir' })).toHaveAccessibleDescription('Confirme a exclusão');
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(onCancel).toHaveBeenCalledOnce();
  unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
