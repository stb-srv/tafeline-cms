import * as React from 'react';
import { toast } from 'sonner';
import { ChevronDown, Download, RotateCcw, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useViewTitle } from '@/hooks/useViewTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { parseResDate, type Reservation } from './reservations-api';

export function ArchivePage() {
    useViewTitle('Archiv');
    const { data: reservations = [] } = useQuery({
        queryKey: ['reservations'],
        queryFn: async () => (await apiGet<Reservation[]>('reservations')) || [],
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const monthFirst = new Date(now.getFullYear(), now.getMonth(), 2).toISOString().split('T')[0];
    const monthLast = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        .toISOString()
        .split('T')[0];

    const [search, setSearch] = React.useState('');
    const [from, setFrom] = React.useState(monthFirst);
    const [to, setTo] = React.useState(monthLast);
    const [openDates, setOpenDates] = React.useState<Set<string>>(new Set());

    const filtered = React.useMemo(() => {
        let arc = reservations.filter((r) => {
            const rd = parseResDate(r.date);
            return r.status === 'Cancelled' || r.status === 'No-Show' || (rd && rd < now);
        });
        if (search) {
            const s = search.toLowerCase();
            arc = arc.filter(
                (r) =>
                    (r.name || '').toLowerCase().includes(s) ||
                    (r.email || '').toLowerCase().includes(s) ||
                    (r.phone || '').includes(s)
            );
        }
        if (from && to) {
            const dF = new Date(from);
            const dT = new Date(to);
            dT.setHours(23, 59, 59, 999);
            arc = arc.filter((r) => {
                const rd = parseResDate(r.date);
                return rd && rd >= dF && rd <= dT;
            });
        }
        return arc;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservations, search, from, to]);

    const grouped = React.useMemo(() => {
        const g: Record<string, Reservation[]> = {};
        for (const r of filtered) (g[r.date || 'Unbekannt'] ??= []).push(r);
        return Object.entries(g).sort(
            ([a], [b]) => (parseResDate(b)?.getTime() || 0) - (parseResDate(a)?.getTime() || 0)
        );
    }, [filtered]);

    function exportCSV() {
        if (!filtered.length) {
            toast.warning('Keine Daten zum Exportieren.');
            return;
        }
        const headers = [
            'Name',
            'E-Mail',
            'Telefon',
            'Datum',
            'Uhrzeit',
            'Personen',
            'Status',
            'Notiz',
        ];
        const rows = filtered.map((r) =>
            [
                r.name,
                r.email,
                r.phone,
                r.date,
                r.start_time,
                r.guests,
                r.status,
                (r.note || '').replace(/\n/g, ' '),
            ]
                .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
                .join(';')
        );
        const csv = [headers.join(';'), ...rows].join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `reservierungen-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="font-semibold">Reservierungs-Archiv</h3>
                    <p className="text-sm text-muted-foreground">
                        Historische Daten durchsuchen und exportieren.
                    </p>
                </div>
                <Button variant="outline" onClick={exportCSV}>
                    <Download /> CSV Export
                </Button>
            </div>

            <Card>
                <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                    <div className="relative min-w-60 flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-40" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Name, E-Mail oder Tel…"
                            className="pl-9"
                        />
                    </div>
                    <span className="text-xs font-bold uppercase opacity-50">Zeitraum</span>
                    <Input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="w-40"
                    />
                    <span className="opacity-40">bis</span>
                    <Input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="w-40"
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                            setSearch('');
                            setFrom(monthFirst);
                            setTo(monthLast);
                        }}
                    >
                        <RotateCcw />
                    </Button>
                </CardContent>
            </Card>

            {grouped.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                    Keine Archiv-Einträge gefunden.
                </div>
            ) : (
                <div className="space-y-3">
                    {grouped.map(([date, items]) => {
                        const open = openDates.has(date);
                        return (
                            <Card key={date} className="overflow-hidden p-0">
                                <button
                                    onClick={() =>
                                        setOpenDates((s) => {
                                            const n = new Set(s);
                                            n.has(date) ? n.delete(date) : n.add(date);
                                            return n;
                                        })
                                    }
                                    className="flex w-full items-center justify-between bg-muted/40 p-4 text-left"
                                >
                                    <h4 className="font-semibold">
                                        {date}{' '}
                                        <span className="ml-2 text-sm font-normal opacity-50">
                                            ({items.length} Reservierungen)
                                        </span>
                                    </h4>
                                    <ChevronDown
                                        className={cn(
                                            'size-4 transition-transform',
                                            open && 'rotate-180'
                                        )}
                                    />
                                </button>
                                {open && (
                                    <div className="divide-y">
                                        {items.map((r) => (
                                            <div
                                                key={r.id}
                                                className="flex items-center justify-between px-4 py-2.5 text-sm"
                                            >
                                                <div>
                                                    <strong>{r.name || '—'}</strong>{' '}
                                                    <span className="text-muted-foreground">
                                                        {r.start_time} · {r.guests} P.
                                                    </span>
                                                </div>
                                                <span
                                                    className={cn(
                                                        'font-bold',
                                                        r.status === 'Cancelled' &&
                                                            'text-destructive'
                                                    )}
                                                >
                                                    {r.status || 'Pending'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
