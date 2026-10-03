'use client';

import type { DatabaseColorTarget } from '../../lib/dbml';

export type DatabaseInspection = { title: string; text?: string; values?: string[] };
const COLORS = ['#eaf0f2', '#f6e8b1', '#dbeafe', '#d1fae5', '#fce7f3', '#ede9fe', '#fed7aa', '#334155'];

export function DatabaseInspector({ target, inspection, onColor, onClose }: {
  target: DatabaseColorTarget | null;
  inspection: DatabaseInspection | null;
  onColor: (color: string | null) => void;
  onClose: () => void;
}) {
  if (!target && !inspection) return null;
  return <section role="dialog" aria-label={target ? `Cor de ${target.name}` : inspection!.title}
    onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
    className="absolute right-4 top-16 z-50 max-h-[70%] w-80 max-w-[calc(100%-2rem)] overflow-auto rounded-xl border border-[var(--ui-line)] bg-[var(--ui-surface)] p-4 text-sm text-[var(--ui-text)] shadow-sm">
    <div className="mb-4 flex items-start justify-between gap-3"><strong className="break-all">{target ? `Cor de ${target.name}` : inspection!.title}</strong><button type="button" autoFocus onClick={onClose} aria-label="Fechar detalhes">✕</button></div>
    {target ? <>
      <div className="mb-4 grid grid-cols-4 gap-2">{COLORS.map((color) => <button key={color} type="button" aria-label={`Aplicar cor ${color}`} title={color} onClick={() => onColor(color)} className="h-9 rounded-lg border border-[var(--ui-line)]" style={{ backgroundColor: color }} />)}</div>
      <label className="flex items-center justify-between gap-3">Cor personalizada<input type="color" aria-label="Cor personalizada" defaultValue="#eaf0f2" onChange={(event) => onColor(event.target.value)} /></label>
      <button type="button" className="toolbar-button mt-4 px-3 py-2" onClick={() => onColor(null)}>Restaurar cor padrão</button>
    </> : <>
      {inspection?.text && <p className="whitespace-pre-wrap leading-6">{inspection.text}</p>}
      {inspection?.values && <ul className="mt-3 space-y-2">{inspection.values.map((value, index) => <li key={`${value}-${index}`} className="rounded-md bg-[var(--ui-raised)] px-3 py-2 font-mono text-xs">{value}</li>)}</ul>}
    </>}
  </section>;
}
