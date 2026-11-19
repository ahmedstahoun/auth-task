import { applyTheme, preferredTheme, readStoredTheme } from './theme';

describe('theme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it('persists and applies the chosen theme', () => {
    applyTheme('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(readStoredTheme()).toBe('dark');
    applyTheme('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('falls back to the OS preference', () => {
    expect(preferredTheme()).toBe('light');
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(preferredTheme()).toBe('dark');
  });

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readStoredTheme()).toBeNull();
    vi.restoreAllMocks();
  });
});
