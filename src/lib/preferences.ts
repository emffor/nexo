export const STORAGE_KEYS = {
  compactMode: 'organizar-markdown:compact-mode',
  fontScale: 'organizar-markdown:font-scale',
  previewMaximized: 'organizar-markdown:preview-maximized',
  outlineMode: 'organizar-markdown:outline-mode',
  viewMode: 'organizar-markdown:view-mode',
  theme: 'organizar-markdown:theme',
} as const;

export type AppTheme = 'dark' | 'light';
export type ViewMode = 'normal' | 'index' | 'cards' | 'diagram';

export const FONT_SCALE: {
  min: number;
  max: number;
  step: number;
  default: number;
} = {
  min: 0.7,
  max: 1.35,
  step: 0.1,
  default: 1,
};

export function clampFontScale(value: number): number {
  return Math.min(FONT_SCALE.max, Math.max(FONT_SCALE.min, Number(value.toFixed(2))));
}

export function readStoredCompactMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEYS.compactMode) === 'true';
}

export function readStoredFontScale(): number {
  if (typeof window === 'undefined') {
    return FONT_SCALE.default;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEYS.fontScale);
  if (!rawValue) {
    return FONT_SCALE.default;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? clampFontScale(parsed) : FONT_SCALE.default;
}

export function readStoredPreviewMaximized(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEYS.previewMaximized) === 'true';
}

export function readStoredOutlineMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEYS.outlineMode) === 'true';
}

export function readStoredViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'normal';
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEYS.viewMode);

  if (
    rawValue === 'index' ||
    rawValue === 'cards' ||
    rawValue === 'normal' ||
    rawValue === 'diagram'
  ) {
    return rawValue;
  }

  return readStoredOutlineMode() ? 'index' : 'normal';
}

export function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEYS.theme);
  return rawValue === 'light' ? 'light' : 'dark';
}
