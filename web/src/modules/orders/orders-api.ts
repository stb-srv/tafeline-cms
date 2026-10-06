export interface OrderItem {
    number?: string | number;
    quantity: number;
    name: string;
    desc?: string;
    variant?: string;
    extras?: string[];
    note?: string;
}

export type OrderType = 'dine_in' | 'pickup' | 'delivery';
export type OrderStatus =
    'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Order {
    id: string;
    type?: OrderType;
    status: OrderStatus;
    tableNumber?: string | number;
    table?: string | number;
    table_name?: string;
    timestamp?: string;
    createdAt?: string;
    total?: number | string;
    items: OrderItem[];
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    deliveryAddress?: string;
    pickupTime?: string;
    estimatedTime?: string;
    guestNote?: string;
}

export type OrderFilter = 'active' | 'all' | 'completed';

const DONE_STATES: OrderStatus[] = ['ready', 'completed', 'cancelled'];

export function isExternal(o: Order): boolean {
    return o.type === 'pickup' || o.type === 'delivery';
}

export function isDone(o: Order): boolean {
    return DONE_STATES.includes(o.status);
}

export function filterOrders(orders: Order[], filter: OrderFilter): Order[] {
    if (filter === 'active') return orders.filter((o) => !isDone(o));
    if (filter === 'completed') return orders.filter((o) => isDone(o));
    return orders;
}

export interface TypeInfo {
    label: string;
    color: string;
    icon: string;
}
export function typeInfo(o: Order): TypeInfo {
    switch (o.type) {
        case 'pickup':
            return { label: 'Abholung', color: '#f59e0b', icon: 'fa-shopping-bag' };
        case 'delivery':
            return { label: 'Lieferung', color: '#10b981', icon: 'fa-motorcycle' };
        case 'dine_in':
            return {
                label: 'Tisch ' + (o.tableNumber || o.table || '?'),
                color: '#3b82f6',
                icon: 'fa-utensils',
            };
        default:
            return { label: o.type || '?', color: '#6b7280', icon: 'fa-question' };
    }
}

export const STATUS_INFO: Record<OrderStatus, { label: string; color: string; icon: string }> = {
    pending: { label: 'Ausstehend', color: '#f59e0b', icon: 'fa-clock' },
    confirmed: { label: 'Bestätigt', color: '#3b82f6', icon: 'fa-thumbs-up' },
    preparing: { label: 'In Zubereitung', color: '#8b5cf6', icon: 'fa-fire' },
    ready: { label: 'Fertig', color: '#22c55e', icon: 'fa-check-circle' },
    completed: { label: 'Abgeschlossen', color: '#6b7280', icon: 'fa-check-double' },
    cancelled: { label: 'Abgelehnt', color: '#ef4444', icon: 'fa-times-circle' },
};

export interface ActionBtn {
    status: OrderStatus;
    label: string;
    color?: string;
}

/** Mögliche Status-Übergänge je nach Bestellart/Status (Port von renderActions). */
export function nextActions(o: Order): ActionBtn[] {
    const ext = isExternal(o);
    if (o.status === 'cancelled' || o.status === 'completed') return [];
    const btns: ActionBtn[] = [];
    if (ext && o.status === 'pending') {
        btns.push({ status: 'confirmed', label: '✅ Bestätigen', color: '#22c55e' });
        btns.push({ status: 'cancelled', label: '❌ Ablehnen', color: '#ef4444' });
    }
    if (o.status === 'confirmed' || (!ext && o.status === 'pending'))
        btns.push({ status: 'preparing', label: '🍳 In Zubereitung' });
    if (o.status === 'preparing') btns.push({ status: 'ready', label: '✅ Fertig' });
    if (o.status === 'ready' && ext)
        btns.push({ status: 'completed', label: '📦 Übergeben', color: '#6b7280' });
    return btns;
}

export function orderAge(o: Order): { timeStr: string; sub: string } {
    const t = new Date(o.timestamp || o.createdAt || '');
    const timeStr = t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const isToday = t.toDateString() === new Date().toDateString();
    const minAgo = Math.floor((Date.now() - t.getTime()) / 60000);
    const ageStr =
        minAgo < 1
            ? 'Gerade eben'
            : minAgo < 60
              ? `vor ${minAgo} Min.`
              : `${Math.floor(minAgo / 60)}h ${minAgo % 60}m`;
    const dateStr = t.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    return { timeStr, sub: isToday ? ageStr : dateStr };
}
