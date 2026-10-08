export interface PlannerArea {
    id: string;
    name: string;
    icon?: string;
    w: number;
    h: number;
}
export interface PlannerTable {
    id: string;
    num: string;
    seats: number;
    shape: 'square' | 'rect-h' | 'rect-v' | 'round';
    x: number;
    y: number;
    w: number;
    h: number;
    hidden?: boolean;
}
export interface PlannerPlan {
    areas: PlannerArea[];
    tables: Record<string, PlannerTable[]>;
    combined: Record<string, unknown[]>;
    decors: Record<string, unknown[]>;
}
export interface PlannerReservation {
    date?: string;
    status?: string;
    start_time?: string;
    end_time?: string;
    assigned_tables?: string[];
    name?: string;
}

export const SNAP = 20;
export type TableStatus = 'free' | 'reserved' | 'occupied';

export function parseTimeToMins(str?: string): number {
    if (!str) return 0;
    const [h, m] = str
        .replace(/[^0-9:]/g, '')
        .split(':')
        .map(Number);
    return h * 60 + (m || 0);
}
function todayStr(): string {
    const n = new Date();
    return `${String(n.getDate()).padStart(2, '0')}.${String(n.getMonth() + 1).padStart(2, '0')}.${n.getFullYear()}`;
}

export function liveStatus(tableId: string, reservations: PlannerReservation[]): TableStatus {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const date = todayStr();
    const blocks = (r: PlannerReservation) => (r.assigned_tables || []).includes(tableId);
    const active = reservations.find(
        (r) =>
            r.date === date &&
            r.status !== 'Cancelled' &&
            blocks(r) &&
            cur >= parseTimeToMins(r.start_time) &&
            cur <= parseTimeToMins(r.end_time)
    );
    if (active) return 'occupied';
    const future = reservations.find(
        (r) =>
            r.date === date &&
            r.status !== 'Cancelled' &&
            blocks(r) &&
            parseTimeToMins(r.start_time) > cur
    );
    return future ? 'reserved' : 'free';
}

export const STATUS_COLOR: Record<TableStatus, string> = {
    free: '#22c55e',
    reserved: '#f59e0b',
    occupied: '#ef4444',
};

export function shapeSize(shape: PlannerTable['shape']): { w: number; h: number } {
    if (shape === 'rect-h') return { w: 100, h: 60 };
    if (shape === 'rect-v') return { w: 60, h: 100 };
    return { w: 60, h: 60 };
}
