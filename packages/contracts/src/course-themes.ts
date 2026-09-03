import { z } from 'zod';

export const courseThemeSchema = z.enum(['unbranded', 'moto-theme', 'yamaha-theme']);
export type CourseTheme = z.output<typeof courseThemeSchema>;

export interface ThemeButtonColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface ThemeTokens {
  label: string;
  buttonColors: ThemeButtonColors;
}

// buttonColors below are raw Tailwind utility class strings, not just labels/tokens. They only
// generate real CSS because apps/web/src/app/globals.css has an explicit @source directive
// pointing at this package's src directory — Tailwind v4 doesn't scan outside apps/web on its
// own. Moving this registry or renaming globals.css without updating that @source will silently
// break theme button colors.
export const COURSE_THEMES: Record<CourseTheme, ThemeTokens> = {
  unbranded: {
    label: 'No client theme (default)',
    buttonColors: {
      // Deliberately generic — no client's brand colors. New courses start here until an
      // author explicitly opts into a client palette below.
      primary: 'bg-black text-white hover:bg-black/90',
      secondary: 'bg-white text-black hover:bg-white/90',
      tertiary: 'bg-neutral-200 text-black hover:bg-neutral-200/90',
    },
  },
  'moto-theme': {
    label: 'Motorola',
    buttonColors: {
      primary: 'bg-accent text-white hover:bg-accent/90',
      secondary: 'bg-background text-foreground hover:bg-background/90',
      tertiary: 'bg-card text-foreground hover:bg-card/90',
    },
  },
  'yamaha-theme': {
    label: 'Yamaha (placeholder)',
    buttonColors: {
      // Grayscale stand-ins, deliberately distinct from Motorola's palette.
      // TODO: replace with Yamaha's real brand colors once supplied.
      primary: 'bg-neutral-700 text-white hover:bg-neutral-700/90',
      secondary: 'bg-neutral-300 text-black hover:bg-neutral-300/90',
      tertiary: 'bg-neutral-100 text-black hover:bg-neutral-100/90',
    },
  },
};

export const DEFAULT_COURSE_THEME: CourseTheme = 'unbranded';
