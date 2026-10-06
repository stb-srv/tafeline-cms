import * as React from 'react';
import { decodeToken, getCurrentUser, isAuthenticated, logout } from '@/lib/auth';

/** Erzeugt einen Data-URI-Avatar mit Initialen (Port von cms/app.js:88-101). */
export function buildInitialsAvatar(name: string): string {
    const parts = name.trim().split(/\s+/);
    const initials =
        parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase();
    const colors = ['#2b6cb0', '#276749', '#744210', '#702459', '#553c9a', '#2c7a7b', '#9b2c2c'];
    const bg = colors[name.charCodeAt(0) % colors.length];
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">` +
        `<circle cx="18" cy="18" r="18" fill="${bg}"/>` +
        `<text x="18" y="23" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#fff" font-weight="600">${initials}</text>` +
        `</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function useAuth() {
    const claims = React.useMemo(() => decodeToken(), []);
    const user = getCurrentUser();
    const name =
        (claims?.name as string) || (claims?.user as string) || user?.name || user?.user || 'Admin';

    return {
        isAuthenticated: isAuthenticated(),
        user,
        name,
        role: (claims?.role as string) || user?.role,
        avatar: buildInitialsAvatar(name),
        logout,
    };
}
