import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DbmlEditor } from './DbmlEditor';

describe('DbmlEditor', () => {
  it('edita DBML e aciona o histórico com botões e atalhos', () => {
    const onChange = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(<DbmlEditor value={'Table users {\n id int\n}'} theme="light" onChange={onChange} onUndo={onUndo} onRedo={onRedo} canUndo canRedo saveStatus="saving" />);
    const input = screen.getByRole('textbox', { name: 'Editor DBML' });
    fireEvent.change(input, { target: { value: 'Table clientes {}' } });
    expect(onChange).toHaveBeenCalledWith('Table clientes {}');
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'z', metaKey: true, shiftKey: true });
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(onUndo).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('Salvando alterações');
  });
});
