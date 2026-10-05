import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    number?: string | number;
}

interface CartState {
    items: CartItem[];
    add: (item: Omit<CartItem, 'quantity'>) => void;
    remove: (id: string) => void;
    setQty: (id: string, qty: number) => void;
    clear: () => void;
    total: () => number;
    count: () => number;
}

/** Warenkorb – komplett clientseitig, in localStorage persistiert (Port von cart.js). */
export const useCart = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            add: (item) =>
                set((s) => {
                    const existing = s.items.find((i) => i.id === item.id);
                    if (existing)
                        return {
                            items: s.items.map((i) =>
                                i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                            ),
                        };
                    return { items: [...s.items, { ...item, quantity: 1 }] };
                }),
            remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
            setQty: (id, qty) =>
                set((s) => ({
                    items:
                        qty <= 0
                            ? s.items.filter((i) => i.id !== id)
                            : s.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
                })),
            clear: () => set({ items: [] }),
            total: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
            count: () => get().items.reduce((s, i) => s + i.quantity, 0),
        }),
        { name: 'tafeline_cart' }
    )
);
