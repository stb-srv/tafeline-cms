import { useQuery } from '@tanstack/react-query';
import type { Category, Dish } from '@/modules/menu/menu-api';

/** Öffentlicher Fetch (ohne Auth-Header) für die Gäste-Website. */
async function publicGet<T>(route: string): Promise<T | null> {
    try {
        const r = await fetch(`/api/${route}`);
        if (!r.ok) return null;
        return (await r.json()) as T;
    } catch {
        return null;
    }
}

export interface GuestHome {
    heroTitle?: string;
    heroSlogan?: string;
    bgImage?: string;
    welcomeTitle?: string;
    welcomeText?: string;
    welcomeImage?: string;
    promotionEnabled?: boolean;
    promotionText?: string;
    openingHours?: Record<string, { open?: string; close?: string; closed?: boolean }>;
    location?: { address?: string; embedUrl?: string };
    activeModules?: Record<string, boolean>;
    [k: string]: unknown;
}
export interface GuestBranding {
    name?: string;
    slogan?: string;
    phone?: string;
    logo?: string;
    primaryColor?: string;
    accentColor?: string;
}
export interface CartConfig {
    dineInEnabled?: boolean;
    pickupEnabled?: boolean;
    deliveryEnabled?: boolean;
    ordersEnabled?: boolean;
    onlineOrdersEnabled?: boolean;
    isOpenNow?: boolean;
    closedReason?: string | null;
    [k: string]: unknown;
}

export const useGuestHome = () =>
    useQuery({ queryKey: ['g-home'], queryFn: () => publicGet<GuestHome>('homepage') });
export const useGuestBranding = () =>
    useQuery({ queryKey: ['g-branding'], queryFn: () => publicGet<GuestBranding>('branding') });
export const useGuestMenu = () =>
    useQuery({
        queryKey: ['g-menu'],
        queryFn: async () => (await publicGet<Dish[]>('menu')) || [],
    });
export const useGuestCategories = () =>
    useQuery({
        queryKey: ['g-categories'],
        queryFn: async () => {
            const c = (await publicGet<Category[]>('categories')) || [];
            return [...c].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        },
    });
export const useCartConfig = () =>
    useQuery({ queryKey: ['g-cart-config'], queryFn: () => publicGet<CartConfig>('cart/config') });

export interface OrderPayload {
    type: 'dine_in' | 'pickup' | 'delivery';
    items: { id: string; name: string; price: number; quantity: number }[];
    total: number;
    table?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    pickupTime?: string;
    deliveryAddress?: string;
    guestNote?: string;
}

// ── Cookie Consent ──────────────────────────────────────────────────────────
export interface CookieCookie {
    name: string;
    purpose: string;
    duration: string;
    provider: string;
}
export interface CookieCategory {
    id: string;
    label: string;
    description: string;
    required: boolean;
    cookies: CookieCookie[];
}
export interface CookieConfig {
    version: string;
    banner_text: string;
    privacy_url: string;
    categories: Record<string, CookieCategory>;
}

export const useCookieConfig = () =>
    useQuery({
        queryKey: ['g-cookie-config'],
        queryFn: () => publicGet<CookieConfig>('cookie-config'),
    });

export async function submitConsent(payload: {
    choices: Record<string, boolean>;
    config_version: string;
    source: string;
}): Promise<void> {
    try {
        await fetch('/api/cookie-consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch {
        /* Nachweis-Log ist best-effort; UI nicht blockieren */
    }
}

export async function submitOrder(
    payload: OrderPayload
): Promise<{ success?: boolean; reason?: string; orderToken?: string }> {
    try {
        const r = await fetch('/api/cart/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return await r.json();
    } catch {
        return { success: false, reason: 'Netzwerkfehler.' };
    }
}
