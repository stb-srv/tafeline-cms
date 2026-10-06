import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    LEVEL_CLASS,
    RES_MONTHS,
    RES_WD,
    dayCapacity,
    isoOf,
    mondayIndex,
    resOfDay,
    resSameDay,
    type Reservation,
} from './reservations-api';

type Mode = 'day' | 'week' | 'month';

export function ReservationCalendar({
    mode,
    cursor,
    reservations,
    totalCapacity,
    onNav,
    onToday,
    onPickDay,
    onEdit,
}: {
    mode: Mode;
    cursor: Date;
    reservations: Reservation[];
    totalCapacity: number;
    onNav: (dir: number) => void;
    onToday: () => void;
    onPickDay: (iso: string) => void;
    onEdit: (r: Reservation) => void;
}) {
    const today = new Date();

    let title = '';
    if (mode === 'month') title = `${RES_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    else if (mode === 'week') {
        const start = new Date(cursor);
        start.setDate(cursor.getDate() - mondayIndex(cursor));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        title = `${start.getDate()}. ${RES_MONTHS[start.getMonth()].slice(0, 3)} – ${end.getDate()}. ${RES_MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
    } else {
        title = cursor.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
    }

    return (
        <div>
            <div className="mb-4 flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => onNav(-1)}>
                    <ChevronLeft />
                </Button>
                <Button variant="outline" onClick={onToday}>
                    Heute
                </Button>
                <Button variant="outline" size="icon" onClick={() => onNav(1)}>
                    <ChevronRight />
                </Button>
                <h3 className="ml-2 font-semibold">{title}</h3>
                {totalCapacity > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                        Kapazität/Tag: <strong>{totalCapacity}</strong> Plätze
                    </span>
                )}
            </div>

            {mode === 'month' && (
                <MonthGrid
                    cursor={cursor}
                    reservations={reservations}
                    totalCapacity={totalCapacity}
                    today={today}
                    onPickDay={onPickDay}
                />
            )}
            {mode === 'week' && (
                <WeekGrid
                    cursor={cursor}
                    reservations={reservations}
                    totalCapacity={totalCapacity}
                    today={today}
                    onPickDay={onPickDay}
                    onEdit={onEdit}
                />
            )}
            {mode === 'day' && (
                <DayView
                    cursor={cursor}
                    reservations={reservations}
                    totalCapacity={totalCapacity}
                    onEdit={onEdit}
                />
            )}
        </div>
    );
}

function MonthGrid({
    cursor,
    reservations,
    totalCapacity,
    today,
    onPickDay,
}: {
    cursor: Date;
    reservations: Reservation[];
    totalCapacity: number;
    today: Date;
    onPickDay: (iso: string) => void;
}) {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = mondayIndex(first);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} />);
    for (let day = 1; day <= daysInMonth; day++) {
        const dt = new Date(cursor.getFullYear(), cursor.getMonth(), day);
        const cap = dayCapacity(dt, reservations, totalCapacity);
        const items = resOfDay(dt, reservations);
        const isToday = resSameDay(dt, today);
        cells.push(
            <button
                key={day}
                onClick={() => onPickDay(isoOf(dt))}
                className={cn(
                    'min-h-20 rounded-lg border p-2 text-left text-xs hover:bg-accent',
                    LEVEL_CLASS[cap.level],
                    isToday && 'ring-2 ring-primary'
                )}
            >
                <div className="font-bold">{day}</div>
                {items.length > 0 && (
                    <div className="mt-1 text-muted-foreground">
                        {cap.guests} P · {items.length} Res.
                    </div>
                )}
            </button>
        );
    }
    return (
        <div className="grid grid-cols-7 gap-1.5">
            {RES_WD.map((w) => (
                <div key={w} className="pb-1 text-center text-xs font-bold text-muted-foreground">
                    {w}
                </div>
            ))}
            {cells}
        </div>
    );
}

function WeekGrid({
    cursor,
    reservations,
    totalCapacity,
    today,
    onPickDay,
    onEdit,
}: {
    cursor: Date;
    reservations: Reservation[];
    totalCapacity: number;
    today: Date;
    onPickDay: (iso: string) => void;
    onEdit: (r: Reservation) => void;
}) {
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - mondayIndex(cursor));
    return (
        <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
                const dt = new Date(start);
                dt.setDate(start.getDate() + i);
                const cap = dayCapacity(dt, reservations, totalCapacity);
                const items = resOfDay(dt, reservations);
                const isToday = resSameDay(dt, today);
                return (
                    <div key={i} className="rounded-lg border">
                        <button
                            onClick={() => onPickDay(isoOf(dt))}
                            className={cn(
                                'flex w-full flex-col rounded-t-lg border-b p-2 text-xs',
                                LEVEL_CLASS[cap.level],
                                isToday && 'ring-1 ring-primary'
                            )}
                        >
                            <strong>
                                {RES_WD[i]} {dt.getDate()}.
                            </strong>
                            <span>
                                {cap.guests}/{totalCapacity || '∞'} P.
                            </span>
                        </button>
                        <div className="space-y-1 p-1.5">
                            {items.length ? (
                                items.map((r) => (
                                    <button
                                        key={r.id}
                                        onClick={() => onEdit(r)}
                                        className="block w-full truncate rounded bg-primary/10 px-1.5 py-1 text-left text-xs"
                                    >
                                        <strong>{r.start_time || r.time}</strong> {r.name}
                                    </button>
                                ))
                            ) : (
                                <div className="py-2 text-center text-xs opacity-30">—</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DayView({
    cursor,
    reservations,
    totalCapacity,
    onEdit,
}: {
    cursor: Date;
    reservations: Reservation[];
    totalCapacity: number;
    onEdit: (r: Reservation) => void;
}) {
    const items = resOfDay(cursor, reservations);
    const cap = dayCapacity(cursor, reservations, totalCapacity);
    return (
        <div>
            <div
                className={cn(
                    'mb-4 flex items-center justify-between rounded-xl border p-4',
                    LEVEL_CLASS[cap.level]
                )}
            >
                <div>
                    <span className="text-2xl font-bold">{cap.guests}</span>{' '}
                    <span className="opacity-60">/ {totalCapacity || '∞'} Plätze belegt</span>
                </div>
                <div className="font-bold">
                    {cap.level === 'full'
                        ? '⚠ Ausgebucht'
                        : cap.level === 'warn'
                          ? '⚠ Fast voll'
                          : 'Verfügbar'}
                </div>
            </div>
            {items.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                    Keine Reservierungen an diesem Tag
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map((r) => (
                        <button
                            key={r.id}
                            onClick={() => onEdit(r)}
                            className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
                        >
                            <span>
                                <strong>{r.start_time || r.time}</strong> · {r.name} ({r.guests})
                            </span>
                            <span className="text-xs text-muted-foreground">{r.status}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
