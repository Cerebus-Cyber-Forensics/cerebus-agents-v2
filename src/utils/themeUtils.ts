export type AppThemeMode = 'white' | 'black' | 'bw';

export const THEME_STORAGE_KEY = 'cerebus_theme_mode';

export const THEME_OPTIONS: {
  id: AppThemeMode;
  label: string;
  description: string;
}[] = [
  { id: 'white', label: 'White', description: 'Standard light theme' },
  { id: 'black', label: 'Black', description: 'Dark obsidian theme' },
  { id: 'bw', label: 'B&W', description: 'Pure black & white monochrome' },
];

export function isValidThemeMode(value: unknown): value is AppThemeMode {
  return value === 'white' || value === 'black' || value === 'bw';
}

export function getStoredThemeMode(): AppThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidThemeMode(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return 'white';
}

export function applyThemeMode(mode: AppThemeMode): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = mode;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage access errors in restricted contexts
  }
}
