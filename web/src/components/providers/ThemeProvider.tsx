import * as React from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: Theme;
    setTheme: (t: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'tafeline_theme';

function getInitialTheme(): Theme {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Class-basierter Dark-Mode (Tailwind v4 `.dark`).
 * Ersetzt cms/app.js:185-207 inkl. localStorage('tafeline_theme').
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = React.useState<Theme>(getInitialTheme);

    React.useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        localStorage.setItem(STORAGE_KEY, theme);
        const meta = document.getElementById('meta-theme-color');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#1b3a5c');
    }, [theme]);

    const value = React.useMemo<ThemeContextValue>(
        () => ({
            theme,
            resolvedTheme: theme,
            setTheme: setThemeState,
            toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
        }),
        [theme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const ctx = React.useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
