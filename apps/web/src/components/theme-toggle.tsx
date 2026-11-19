import { type ReactElement, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyTheme, preferredTheme, type Theme } from '@/theme';

export function ThemeToggle(): ReactElement {
  const [theme, setTheme] = useState<Theme>(preferredTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
