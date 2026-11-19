export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/** Storage can throw (privacy mode, sandboxed iframes) — theme is a nicety, never fatal. */
export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function preferredTheme(): Theme {
  return (
    readStoredTheme() ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore — the class is applied, persistence is best effort
  }
}
