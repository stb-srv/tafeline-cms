export interface Reservation {
    id: number | string;
    name?: string;
    email?: string;
    phone?: string;
    guests?: number;
    date?: string;
    start_time?: string;
    time?: string;
    end_time?: string;
    status?: string;
    note?: string;
    assigned_tables?: string[];
}

export interface ResTable {
    id: string;
    name?: string;
    capacity?: number;
    active?: boolean;
}

export const RES_WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const RES_MONTHS = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
];

export function parseResDate(str?: string): Date | null {
    if (!str) return null;
    let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(String(str).trim());
    if (m) {
        let y = +m[3];
        if (y < 100) y += 2000;
        return new Date(y, +m[2] - 1, +m[1]);
    }
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

export function resSameDay(a?: Date | null, b?: Date | null): boolean {
    return (
        !!a &&
        !!b &&
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export const isoOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

export function resOfDay(dateObj: Date, resRaw: Reservation[]): Reservation[] {
    return resRaw
        .filter((r) => {
            const rd = parseResDate(r.date);
            return (
                rd && resSameDay(rd, dateObj) && !['Cancelled', 'No-Show'].includes(r.status || '')
            );
        })
        .sort((a, b) =>
            String(a.start_time || a.time || '').localeCompare(String(b.start_time || b.time || ''))
        );
}

export interface DayCap {
    guests: number;
    count: number;
    ratio: number;
    level: 'ok' | 'warn' | 'full';
    totalCapacity: number;
}

export function dayCapacity(dateObj: Date, resRaw: Reservation[], totalCapacity: number): DayCap {
    const counted = resRaw.filter((r) => {
        const rd = parseResDate(r.date);
        return rd && resSameDay(rd, dateObj) && ['Confirmed', 'Pending'].includes(r.status || '');
    });
    const guests = counted.reduce((s, r) => s + (Number(r.guests) || 0), 0);
    const ratio = totalCapacity > 0 ? guests / totalCapacity : 0;
    let level: DayCap['level'] = 'ok';
    if (ratio >= 1) level = 'full';
    else if (ratio >= 0.8) level = 'warn';
    return { guests, count: counted.length, ratio, level, totalCapacity };
}

export const LEVEL_CLASS: Record<DayCap['level'], string> = {
    ok: 'border-border',
    warn: 'border-[hsl(var(--warning))] bg-[hsl(var(--warning))]/5',
    full: 'border-destructive bg-destructive/5',
};

export const RES_STATUS = [
    'All',
    'Pending',
    'Confirmed',
    'Waitlist',
    'Inquiry',
    'Blocked',
    'Cancelled',
    'No-Show',
];
