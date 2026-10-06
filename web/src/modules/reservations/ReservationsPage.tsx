import * as React from 'react';
import { toast } from 'sonner';
import {
    Calendar,
    CalendarDays,
    Check,
    Hourglass,
    List,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    Trash2,
    UserX,
    Armchair,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPut } from '@/lib/api';
import { useViewTitle } from '@/hooks/useViewTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { RES_STATUS, parseResDate, type Reservation, type ResTable } from './reservations-api';
import { ReservationCalendar } from './ReservationCalendar';
import {
    AssignTableDialog,
    EditReservationDialog,
    ManualReservationDialog,
} from './ReservationDialogs';

type ViewMode = 'list' | 'day' | 'week' | 'month';
const PAGE_SIZE = 20;
const VIEWS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'list', label: 'Liste', icon: <List className="size-3.5" /> },
    { id: 'day', label: 'Tag', icon: <Calendar className="size-3.5" /> },
    { id: 'week', label: 'Woche', icon: <CalendarDays className="size-3.5" /> },
    { id: 'month', label: 'Monat', icon: <Calendar className="size-3.5" /> },
];

export function ReservationsPage() {
    useViewTitle('Reservierungen');
    const qc = useQueryClient();
    const refresh = () => qc.invalidateQueries({ queryKey: ['reservations'] });

    const { data: reservations = [] } = useQuery({
        queryKey: ['reservations'],
        queryFn: async () => (await apiGet<Reservation[]>('reservations')) || [],
    });
    const { data: tables = [] } = useQuery({
        queryKey: ['tables'],
        queryFn: async () => (await apiGet<ResTable[]>('tables')) || [],
    });

    const totalCapacity = tables
        .filter((t) => t.active !== false)
        .reduce((s, t) => s + (Number(t.capacity) || 0), 0);

    const [view, setView] = React.useState<ViewMode>('list');
    const [cursor, setCursor] = React.useState(new Date());
    const [text, setText] = React.useState('');
    const [status, setStatus] = React.useState('All');
    const [dateFilter, setDateFilter] = React.useState('');
    const [page, setPage] = React.useState(1);

    const [editRes, setEditRes] = React.useState<Reservation | null>(null);
    const [assignRes, setAssignRes] = React.useState<Reservation | null>(null);
    const [manualOpen, setManualOpen] = React.useState(false);

    // ---- Liste filtern/sortieren ----
    const filtered = React.useMemo(() => {
        let res =
            status === 'Cancelled' || status === 'No-Show'
                ? reservations
                : reservations.filter((r) => r.status !== 'Cancelled' && r.status !== 'No-Show');
        if (text) {
            const t = text.toLowerCase();
            res = res.filter(
                (r) =>
                    (r.name || '').toLowerCase().includes(t) ||
                    (r.email || '').toLowerCase().includes(t) ||
                    (r.phone || '').includes(t)
            );
        }
        if (status !== 'All') res = res.filter((r) => r.status === status);
        if (dateFilter) {
            const [y, m, d] = dateFilter.split('-').map(Number);
            res = res.filter((r) => {
                const rd = parseResDate(r.date);
                return (
                    rd && rd.getFullYear() === y && rd.getMonth() + 1 === m && rd.getDate() === d
                );
            });
        }
        return res.sort(
            (a, b) =>
                (parseResDate(b.date)?.getTime() || 0) - (parseResDate(a.date)?.getTime() || 0)
        );
    }, [reservations, text, status, dateFilter]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const safePage = Math.max(1, Math.min(page, totalPages || 1));
    const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // ---- Aktionen ----
    async function setStatusOf(id: Reservation['id'], st: string, note?: string) {
        const res = await apiPut(
            `reservations/${id}`,
            note ? { status: st, note } : { status: st }
        );
        if (res.success !== false) {
            toast.success(`Status: ${st}`);
            refresh();
        } else toast.error(res.reason || 'Fehler');
    }
    async function noShow(id: Reservation['id']) {
        if (window.confirm('Gast ist nicht erschienen. Als No-Show markieren?'))
            setStatusOf(id, 'No-Show');
    }
    async function cancel(r: Reservation) {
        const reason = window.prompt('Grund der Stornierung (optional):');
        if (reason === null) return;
        const note = r.note
            ? `${r.note}\n--- STORNO-GRUND: ${reason || 'Kein Grund'}`
            : `STORNO-GRUND: ${reason || 'Kein Grund'}`;
        setStatusOf(r.id, 'Cancelled', note);
    }
    async function remove(id: Reservation['id']) {
        if (!window.confirm('Diese Reservierung wirklich unwiderruflich löschen?')) return;
        const res = await apiDelete(`reservations/${id}`);
        if (res.success !== false) {
            toast.success('Reservierung gelöscht.');
            refresh();
        } else toast.error(res.reason || 'Fehler');
    }

    function navCal(dir: number) {
        const c = new Date(cursor);
        if (view === 'month') c.setMonth(c.getMonth() + dir);
        else if (view === 'week') c.setDate(c.getDate() + dir * 7);
        else c.setDate(c.getDate() + dir);
        setCursor(c);
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="font-semibold">Aktive Reservierungen</h3>
                    <p className="text-sm text-muted-foreground">
                        Status und Tischzuweisungen bearbeiten.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-full border bg-muted p-0.5">
                        {VIEWS.map((v) => (
                            <button
                                key={v.id}
                                onClick={() => setView(v.id)}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                                    view === v.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground'
                                )}
                            >
                                {v.icon} {v.label}
                            </button>
                        ))}
                    </div>
                    <Button onClick={() => setManualOpen(true)}>
                        <Plus /> Manuelle Buchung
                    </Button>
                </div>
            </div>

            {view === 'list' ? (
                <>
                    <div className="flex flex-wrap gap-3">
                        <div className="relative min-w-60 flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-40" />
                            <Input
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    setPage(1);
                                }}
                                placeholder="Suchen…"
                                className="pl-9"
                            />
                        </div>
                        <select
                            className="h-9 w-44 rounded-md border border-input bg-transparent px-3 text-sm"
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                setPage(1);
                            }}
                        >
                            {RES_STATUS.map((s) => (
                                <option key={s} value={s}>
                                    {s === 'All' ? 'Alle Status' : s}
                                </option>
                            ))}
                        </select>
                        <Input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e.target.value);
                                setPage(1);
                            }}
                            className="w-40"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                                setText('');
                                setStatus('All');
                                setDateFilter('');
                                setPage(1);
                            }}
                        >
                            <RotateCcw />
                        </Button>
                    </div>

                    <Card className="overflow-hidden p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Gast</TableHead>
                                    <TableHead>Zeitraum</TableHead>
                                    <TableHead>Gäste</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Tische</TableHead>
                                    <TableHead className="text-right">Aktion</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paged.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-12 text-center text-muted-foreground"
                                        >
                                            Keine passenden Reservierungen
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paged.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell>
                                                <div className="font-bold">
                                                    {r.name || 'Unbekannt'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {r.email}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold">{r.date || '—'}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {r.start_time} {r.end_time && `- ${r.end_time}`}
                                                </div>
                                            </TableCell>
                                            <TableCell>{r.guests || 0}</TableCell>
                                            <TableCell>
                                                <span
                                                    className={cn(
                                                        'font-bold',
                                                        r.status === 'Blocked'
                                                            ? 'text-destructive'
                                                            : 'text-primary'
                                                    )}
                                                >
                                                    {r.status || 'Pending'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {(r.assigned_tables || [])
                                                    .map((t) =>
                                                        t.startsWith('C')
                                                            ? 'Combo ' + t.slice(1)
                                                            : t
                                                    )
                                                    .join(', ') || (
                                                    <span className="opacity-50">Keine</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <IconBtn
                                                        title="Tisch zuweisen"
                                                        onClick={() => setAssignRes(r)}
                                                    >
                                                        <Armchair />
                                                    </IconBtn>
                                                    <IconBtn
                                                        title="Bearbeiten"
                                                        onClick={() => setEditRes(r)}
                                                    >
                                                        <Pencil />
                                                    </IconBtn>
                                                    {r.status !== 'Confirmed' ? (
                                                        <IconBtn
                                                            title="Akzeptieren"
                                                            className="text-[hsl(var(--success))]"
                                                            onClick={() =>
                                                                setStatusOf(r.id, 'Confirmed')
                                                            }
                                                        >
                                                            <Check />
                                                        </IconBtn>
                                                    ) : (
                                                        <IconBtn
                                                            title="No-Show"
                                                            onClick={() => noShow(r.id)}
                                                        >
                                                            <UserX />
                                                        </IconBtn>
                                                    )}
                                                    {r.status !== 'Confirmed' &&
                                                        r.status !== 'Waitlist' && (
                                                            <IconBtn
                                                                title="Warteliste"
                                                                onClick={() =>
                                                                    setStatusOf(r.id, 'Waitlist')
                                                                }
                                                            >
                                                                <Hourglass />
                                                            </IconBtn>
                                                        )}
                                                    {r.status !== 'Cancelled' && (
                                                        <IconBtn
                                                            title="Stornieren"
                                                            onClick={() => cancel(r)}
                                                        >
                                                            <RotateCcw />
                                                        </IconBtn>
                                                    )}
                                                    <IconBtn
                                                        title="Löschen"
                                                        className="text-destructive"
                                                        onClick={() => remove(r.id)}
                                                    >
                                                        <Trash2 />
                                                    </IconBtn>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>
                                Seite {safePage} / {totalPages} · {filtered.length} Einträge
                            </span>
                            <div className="flex gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={safePage <= 1}
                                    onClick={() => setPage(safePage - 1)}
                                >
                                    Zurück
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={safePage >= totalPages}
                                    onClick={() => setPage(safePage + 1)}
                                >
                                    Weiter
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <Card className="p-5">
                    <ReservationCalendar
                        mode={view}
                        cursor={cursor}
                        reservations={reservations}
                        totalCapacity={totalCapacity}
                        onNav={navCal}
                        onToday={() => setCursor(new Date())}
                        onPickDay={(iso) => {
                            setView('list');
                            setDateFilter(iso);
                            setPage(1);
                        }}
                        onEdit={(r) => setEditRes(r)}
                    />
                </Card>
            )}

            <EditReservationDialog
                reservation={editRes}
                onClose={() => setEditRes(null)}
                onSaved={refresh}
            />
            <AssignTableDialog
                reservation={assignRes}
                onClose={() => setAssignRes(null)}
                onSaved={refresh}
            />
            <ManualReservationDialog
                open={manualOpen}
                onClose={() => setManualOpen(false)}
                onSaved={refresh}
            />
        </div>
    );
}

function IconBtn({
    children,
    title,
    className,
    onClick,
}: {
    children: React.ReactNode;
    title: string;
    className?: string;
    onClick: () => void;
}) {
    return (
        <Button variant="outline" size="icon" title={title} className={className} onClick={onClick}>
            {children}
        </Button>
    );
}
