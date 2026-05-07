'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  extractFlowMetadata,
  getStatusVariant,
  type FlowStatusVariant,
} from '../lib/flow';
import type { AppTheme } from '../lib/preferences';
import type { FlowLink, MarkdownItem } from '../types/markdown';

interface FlowBoardProps {
  items: MarkdownItem[];
  links: FlowLink[];
  hasCustomLinks: boolean;
  theme: AppTheme;
  activeItemId?: string | null;
  onOpenItem: (item: MarkdownItem) => void;
  onToggleLink: (sourceId: string, targetId: string) => void;
  onClearLinks: () => void;
}

interface FlowLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  variant: FlowStatusVariant;
}

const VARIANT_CLASSES: Record<FlowStatusVariant, string> = {
  backlog: 'border-slate-700/80 bg-slate-950/25 text-slate-100',
  blocked: 'border-rose-500/50 bg-rose-500/10 text-rose-100',
  progress: 'border-sky-400/50 bg-sky-500/10 text-sky-100',
  review: 'border-amber-400/55 bg-amber-400/10 text-amber-100',
  done: 'border-teal-400/55 bg-teal-400/10 text-teal-100',
  default: 'border-slate-800/80 bg-[#0c1219] text-slate-100',
};

const LIGHT_VARIANT_CLASSES: Record<FlowStatusVariant, string> = {
  backlog: 'border-slate-300 bg-white text-slate-950',
  blocked: 'border-rose-300 bg-rose-50 text-rose-950',
  progress: 'border-sky-300 bg-sky-50 text-sky-950',
  review: 'border-amber-300 bg-amber-50 text-amber-950',
  done: 'border-teal-300 bg-teal-50 text-teal-950',
  default: 'border-slate-200 bg-white text-slate-950',
};

const LINE_COLORS: Record<FlowStatusVariant, string> = {
  backlog: '#64748b',
  blocked: '#fb7185',
  progress: '#38bdf8',
  review: '#fbbf24',
  done: '#2dd4bf',
  default: '#475569',
};

function formatNodeMeta(metadata: ReturnType<typeof extractFlowMetadata>): string {
  return metadata.dev || metadata.assignee || metadata.priority || 'Sem responsavel';
}

export function FlowBoard({
  items,
  links,
  hasCustomLinks,
  theme,
  activeItemId,
  onOpenItem,
  onToggleLink,
  onClearLinks,
}: FlowBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [lines, setLines] = useState<FlowLine[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);

  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  useEffect(() => {
    if (!isConnecting) {
      setSourceId(null);
    }
  }, [isConnecting]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSourceId(null);
        setIsConnecting(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const updateLines = () => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const nextLines = links.flatMap((link) => {
        const sourceElement = nodeRefs.current.get(link.sourceId);
        const targetElement = nodeRefs.current.get(link.targetId);
        const sourceItem = itemMap.get(link.sourceId);

        if (!sourceElement || !targetElement || !sourceItem) {
          return [];
        }

        const sourceRect = sourceElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        const sourceMetadata = extractFlowMetadata(sourceItem);
        const isAutomaticWrapLine =
          !hasCustomLinks && sourceRect.left >= targetRect.left;

        if (isAutomaticWrapLine) {
          return [];
        }

        return {
          id: link.id,
          x1: sourceRect.right - containerRect.left,
          y1: sourceRect.top - containerRect.top + sourceRect.height / 2,
          x2: targetRect.left - containerRect.left,
          y2: targetRect.top - containerRect.top + targetRect.height / 2,
          variant: getStatusVariant(sourceMetadata.status),
        };
      });

      setLines(nextLines);
    };

    updateLines();

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateLines);
    if (containerRef.current && resizeObserver) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateLines);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateLines);
    };
  }, [hasCustomLinks, itemMap, items, links]);

  const handleNodeClick = (item: MarkdownItem) => {
    if (!isConnecting) {
      return;
    }

    if (!sourceId) {
      setSourceId(item.id);
      return;
    }

    if (sourceId !== item.id) {
      onToggleLink(sourceId, item.id);
    }

    setSourceId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className={`m-0 text-xs ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
            }`}
          >
            {isConnecting
              ? sourceId
                ? 'Selecione o destino da seta.'
                : 'Selecione a origem da seta.'
              : hasCustomLinks
                ? 'Conexoes manuais salvas. Duplo clique abre a task.'
                : 'Fluxo automatico mostra cards vizinhos. Use Conectar para criar setas manuais.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSourceId(null);
              setIsConnecting(false);
              onClearLinks();
            }}
            className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-xs font-semibold transition ${
              theme === 'dark'
                ? 'border-rose-400/20 bg-rose-500/[0.04] text-rose-100 hover:bg-rose-500/[0.09]'
                : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
            }`}
          >
            Limpar ligacoes
          </button>
          <button
            type="button"
            onClick={() => setIsConnecting((current) => !current)}
            className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-xs font-semibold transition ${
              isConnecting
                ? theme === 'dark'
                  ? 'border-teal-300/70 bg-teal-400/12 text-teal-100'
                  : 'border-teal-400 bg-teal-50 text-teal-800'
                : theme === 'dark'
                  ? 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {isConnecting ? 'Cancelar conexao' : 'Conectar'}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-[360px] overflow-hidden">
        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            {Object.entries(LINE_COLORS).map(([variant, color]) => (
              <marker
                key={variant}
                id={`flow-arrow-${variant}`}
                markerHeight="7"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="3.5"
              >
                <path d="M0,0 L8,3.5 L0,7 Z" fill={color} opacity="0.8" />
              </marker>
            ))}
          </defs>
          {lines.map((line) => (
            <path
              key={line.id}
              d={`M ${line.x1} ${line.y1} C ${line.x1 + 44} ${line.y1}, ${line.x2 - 44} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              markerEnd={`url(#flow-arrow-${line.variant})`}
              stroke={LINE_COLORS[line.variant]}
              strokeOpacity="0.62"
              strokeWidth="1.4"
            />
          ))}
        </svg>

        <div className="relative z-10 grid gap-x-10 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => {
            const metadata = extractFlowMetadata(item);
            const variant = getStatusVariant(metadata.status);
            const isSource = sourceId === item.id;
            const variantClass =
              theme === 'dark'
                ? VARIANT_CLASSES[variant]
                : LIGHT_VARIANT_CLASSES[variant];

            return (
              <article
                key={item.id}
                ref={(element) => {
                  if (element) {
                    nodeRefs.current.set(item.id, element);
                  } else {
                    nodeRefs.current.delete(item.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Abrir task ${metadata.title}`}
                onClick={() => handleNodeClick(item)}
                onDoubleClick={() => onOpenItem(item)}
                className={`min-h-[108px] rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                  variantClass
                } ${
                  activeItemId === item.id || isSource
                    ? 'ring-2 ring-teal-300/60'
                    : ''
                } ${isConnecting ? 'cursor-crosshair' : 'cursor-pointer'}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.16em] ${
                      theme === 'dark'
                        ? 'bg-slate-950/45 text-slate-400'
                        : 'bg-white/75 text-slate-500'
                    }`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
                    {metadata.status || 'Task'}
                  </span>
                </div>
                <h3 className="m-0 line-clamp-2 text-sm font-semibold leading-5">
                  {metadata.title}
                </h3>
                <p className="m-0 mt-2 truncate text-xs opacity-70">
                  {formatNodeMeta(metadata)}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
