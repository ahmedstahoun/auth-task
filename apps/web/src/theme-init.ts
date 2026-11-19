import { preferredTheme } from './theme';

// Runs before React renders to avoid a flash of the wrong theme.
document.documentElement.classList.toggle('dark', preferredTheme() === 'dark');
