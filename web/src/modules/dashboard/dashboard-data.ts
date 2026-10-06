/**
 * Datenmodell + Berechnungen für das Dashboard.
 * Port der Aggregationslogik aus cms/modules/dashboard.js (renderDashboard).
 */

export interface MenuItem {
    price?: number | string;
    cat?: string | { label?: string; id?: string };
}
export interface OrderItem {
    status?: string;
    total?: number | string;
    timestamp?: string;
    createdAt?: string;
    table?: string;
    tableNumber?: string | number;
    table_name?: string;
}
export interface Reservation {
    date?: string;
    status?: string;
    start_time?: string;
    time?: string;
    name?: string;
    guests?: number;
}
export interface TableEntity {
    active?: boolean;
    number?: string | number;
    id?: string | number;
    capacity?: number;
}
export interface Vacation {
    enabled?: boolean;
    start?: string;
    end?: string;
}
export interface HomeData {
    openingHours?: Record<string, { closed?: boolean; open?: string; close?: string }>;
    vacation?: Vacation;
    promotionEnabled?: boolean;
    promotionText?: string;
}
export interface License {
    isTrial?: boolean;
    label?: string;
    type?: string;
    status?: string;
    expiresAt?: string;
    limits?: { max_dishes?: number };
}
export interface Branding {
    name?: string;
}
export interface WidgetConfig {
    id: string;
    size?: string;
    vSize?: string;
    active?: boolean;
    type?: 'header';
    title?: string;
    description?: string;
}
export interface Settings {
    dashboardConfig?: WidgetConfig[];
    license?: License;
}

export interface WeekKpi {
    revSeries: number[];
    resSeries: number[];
    revThis: number;
    revLast: number;
    resThis: number;
    resLast: number;
}

export interface DashboardData {
    menu: MenuItem[];
    reservations: Reservation[];
    tables: TableEntity[];
    home: HomeData;
    branding: Branding;
    license: License;
    catStats: { label: string; count: number }[];
    todayOrders: OrderItem[];
    pendingOrders: OrderItem[];
    revenueToday: number;
    upcomingRes: Reservation[];
    todayRes: Reservation[];
    week: WeekKpi;
    ohText: string;
    isOpen: boolean;
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'today_overview', size: 'span-8' },
    { id: 'kpi_trends', size: 'span-4' },
    { id: 'branding', size: 'span-6' },
    { id: 'dishes', size: 'span-3' },
    { id: 'categories', size: 'span-3' },
    { id: 'orders_today', size: 'span-3' },
    { id: 'revenue_today', size: 'span-3' },
    { id: 'pending_orders', size: 'span-3' },
    { id: 'upcoming_reservations', size: 'span-3' },
    { id: 'reservations', size: 'span-4' },
    { id: 'status', size: 'span-4' },
    { id: 'vacation', size: 'span-4' },
    { id: 'quick_actions', size: 'span-4', active: false },
    { id: 'table_overview', size: 'span-8', active: false },
    { id: 'menu_breakdown', size: 'span-6' },
    { id: 'price_stats', size: 'span-3' },
    { id: 'avg_price', size: 'span-3' },
    { id: 'website', size: 'span-12' },
];

export const WIDGET_META: Record<string, { label: string; icon: string }> = {
    today_overview: { label: 'Heute-Übersicht', icon: 'fa-calendar-day' },
    kpi_trends: { label: 'Trend (7 Tage)', icon: 'fa-chart-line' },
    branding: { label: 'Restaurant Info', icon: 'fa-store' },
    dishes: { label: 'Gerichte-Zähler', icon: 'fa-utensils' },
    reservations: { label: 'Reservierungen', icon: 'fa-calendar-check' },
    status: { label: 'Heutige Zeiten', icon: 'fa-clock' },
    vacation: { label: 'Urlaubs-Status', icon: 'fa-umbrella-beach' },
    website: { label: 'Website Status', icon: 'fa-magic' },
    categories: { label: 'Kategorien', icon: 'fa-tags' },
    menu_breakdown: { label: 'Speisen nach Kategorie', icon: 'fa-chart-bar' },
    price_stats: { label: 'Preisspanne', icon: 'fa-euro-sign' },
    avg_price: { label: 'Durchschnittspreis', icon: 'fa-calculator' },
    orders_today: { label: 'Bestellungen Heute', icon: 'fa-receipt' },
    revenue_today: { label: 'Umsatz Heute', icon: 'fa-coins' },
    pending_orders: { label: 'Ausstehende Bestellungen', icon: 'fa-hourglass-half' },
    upcoming_reservations: { label: 'Bald: Reservierungen', icon: 'fa-calendar-alt' },
    quick_actions: { label: 'Schnellzugriff', icon: 'fa-bolt' },
    table_overview: { label: 'Tischübersicht', icon: 'fa-chair' },
};

const DAY_MS = 86400000;

export function parseFlexibleDate(s?: string | Date | null): Date | null {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(String(s).trim());
    if (m) {
        let y = +m[3];
        if (y < 100) y += 2000;
        return new Date(y, +m[2] - 1, +m[1]);
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

export function sameDay(a?: Date | null, b?: Date | null): boolean {
    return (
        !!a &&
        !!b &&
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

const num = (v: unknown): number => parseFloat(String(v ?? 0)) || 0;

export interface RawInputs {
    menu: MenuItem[] | null;
    orders: OrderItem[] | null;
    reservations: Reservation[] | null;
    home: HomeData | null;
    branding: Branding | null;
    settings: Settings | null;
    tables: TableEntity[] | null;
}

export function computeDashboardData(input: RawInputs): DashboardData {
    const menu = Array.isArray(input.menu) ? input.menu : [];
    const orders = Array.isArray(input.orders) ? input.orders : [];
    const reservations = Array.isArray(input.reservations) ? input.reservations : [];
    const tables = Array.isArray(input.tables) ? input.tables : [];
    const home = input.home ?? {};
    const branding = input.branding ?? {};
    const license = input.settings?.license ?? {};

    const day = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date().getDay()];
    const ohToday = home.openingHours?.[day] ?? { closed: true };

    // Kategorie-Verteilung
    const catMap: Record<string, number> = {};
    for (const m of menu) {
        const label =
            m.cat && typeof m.cat === 'object'
                ? m.cat.label || m.cat.id || 'Unsortiert'
                : (m.cat as string) || 'Unsortiert';
        catMap[label] = (catMap[label] || 0) + 1;
    }
    const catStats = Object.entries(catMap)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

    const todayStr = new Date().toLocaleDateString('de-DE');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('de-DE');

    const todayOrders = orders.filter(
        (o) => new Date(o.timestamp || o.createdAt || '').toLocaleDateString('de-DE') === todayStr
    );
    const pendingOrders = orders.filter((o) => ['pending', 'preparing'].includes(o.status || ''));
    const revenueToday = todayOrders.reduce((s, o) => s + num(o.total), 0);
    const upcomingRes = reservations.filter(
        (r) => (r.date === todayStr || r.date === tomorrowStr) && r.status === 'Confirmed'
    );

    const todayDate = new Date();
    const todayRes = reservations
        .filter((r) => {
            const rd = parseFlexibleDate(r.date);
            return rd && sameDay(rd, todayDate) && r.status !== 'Cancelled';
        })
        .sort((a, b) =>
            String(a.start_time || a.time || '').localeCompare(String(b.start_time || b.time || ''))
        );

    // KPI-Zeitreihen: letzte 7 Tage vs. die 7 davor
    const days7 = [...Array(7)].map((_, i) => new Date(todayDate.getTime() - (6 - i) * DAY_MS));
    const inLast7 = (dt?: Date | null) =>
        !!dt &&
        todayDate.getTime() - dt.getTime() >= 0 &&
        todayDate.getTime() - dt.getTime() < 7 * DAY_MS;
    const inPrev7 = (dt?: Date | null) =>
        !!dt &&
        todayDate.getTime() - dt.getTime() >= 7 * DAY_MS &&
        todayDate.getTime() - dt.getTime() < 14 * DAY_MS;

    const orderDate = (o: OrderItem) => new Date(o.timestamp || o.createdAt || '');

    const revSeries = days7.map((d) =>
        orders.filter((o) => sameDay(orderDate(o), d)).reduce((s, o) => s + num(o.total), 0)
    );
    const revThis = orders
        .filter((o) => inLast7(orderDate(o)))
        .reduce((s, o) => s + num(o.total), 0);
    const revLast = orders
        .filter((o) => inPrev7(orderDate(o)))
        .reduce((s, o) => s + num(o.total), 0);

    const resSeries = days7.map(
        (d) => reservations.filter((r) => sameDay(parseFlexibleDate(r.date), d)).length
    );
    const resThis = reservations.filter((r) => inLast7(parseFlexibleDate(r.date))).length;
    const resLast = reservations.filter((r) => inPrev7(parseFlexibleDate(r.date))).length;

    const ohText = ohToday.closed ? 'Heute geschlossen' : `${ohToday.open} - ${ohToday.close}`;

    return {
        menu,
        reservations,
        tables,
        home,
        branding,
        license,
        catStats,
        todayOrders,
        pendingOrders,
        revenueToday,
        upcomingRes,
        todayRes,
        week: { revSeries, revThis, revLast, resSeries, resThis, resLast },
        ohText,
        isOpen: !ohText.includes('geschlossen'),
    };
}

export interface VacationStatus {
    label: string;
    color: string;
    icon: string;
    subText: string;
}

export function getVacationStatus(vac?: Vacation): VacationStatus {
    if (!vac)
        return {
            label: 'Inaktiv',
            color: 'var(--muted-foreground)',
            icon: 'fa-umbrella-beach',
            subText: 'Kein Urlaub geplant',
        };
    const now = new Date();
    const start = vac.start ? new Date(vac.start) : null;
    const end = vac.end ? new Date(vac.end) : null;
    if (vac.enabled === true)
        return {
            label: 'Aktiv (Manuell)',
            color: 'hsl(var(--primary))',
            icon: 'fa-exclamation-circle',
            subText: 'Sofort-Modus ist AN',
        };
    if (start && end) {
        if (now >= start && now <= end)
            return {
                label: 'Aktuell aktiv',
                color: 'hsl(var(--primary))',
                icon: 'fa-umbrella-beach',
                subText: `Bis ${end.toLocaleDateString('de-DE')}`,
            };
        if (now < start)
            return {
                label: 'In Kürze',
                color: '#f59e0b',
                icon: 'fa-calendar-alt',
                subText: `Ab ${start.toLocaleDateString('de-DE')}`,
            };
    }
    return {
        label: 'Inaktiv',
        color: 'var(--muted-foreground)',
        icon: 'fa-plane-departure',
        subText: 'Kein Zeitplan aktiv',
    };
}
