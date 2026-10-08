/**
 * White-Labeling: überschreibt die Design-Token-CSS-Variablen zur Laufzeit.
 * Da alle Tailwind-Klassen auf hsl(var(--primary)) etc. zeigen, genügt
 * setProperty – KEIN Tailwind-Rebuild nötig.
 */

export interface BrandingColors {
    primaryColor?: string; // Hex, z. B. "#1b3a5c"
    accentColor?: string; // Hex, z. B. "#c8a96e"
}

/** Wandelt "#1b3a5c" → "209 54% 23%" (HSL-Tripel ohne hsl()-Wrapper). */
export function hexToHslParts(hex: string): string | null {
    const m = hex.trim().replace('#', '');
    const full =
        m.length === 3
            ? m
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : m;
    if (full.length !== 6) return null;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            default:
                h = (r - g) / d + 4;
        }
        h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Setzt Marken-Primär-/Akzentfarbe auf <html> (überschreibt :root-Tokens). */
export function applyBranding(b: BrandingColors): void {
    const root = document.documentElement;
    if (b.primaryColor) {
        const hsl = hexToHslParts(b.primaryColor);
        if (hsl) {
            root.style.setProperty('--primary', hsl);
            root.style.setProperty('--ring', hsl);
            root.style.setProperty('--sidebar-primary', hsl);
        }
    }
    if (b.accentColor) {
        const hsl = hexToHslParts(b.accentColor);
        if (hsl) root.style.setProperty('--secondary', hsl);
    }
}
