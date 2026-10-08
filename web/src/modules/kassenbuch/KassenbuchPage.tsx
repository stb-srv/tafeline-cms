import * as React from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
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
import type { Order } from '@/modules/orders/orders-api';

type Mode = 'day' | 'month';
const TYPE_LABELS: Record<string, string> = {
    dine_in: 'Vor Ort',
    pickup: 'Abholung',
    delivery: 'Lieferung',
};
const CANCELLED = ['cancelled', 'canceled', 'storniert', 'rejected'];
const fmt = (n: unknown) => (parseFloat(String(n)) || 0).toFixed(2) + ' €';

function orderDate(o: Order): Date | null {
    const d = new Date(o.timestamp || o.createdAt || 0);
    return isNaN(d.getTime()) ? null : d;
}

export function KassenbuchPage() {
    useViewTitle('Kassenbuch & Tagesabschluss');
    const [mode, setMode] = React.useState<Mode>('day');
    const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));

    const { data: orders = [] } = useQuery({
        queryKey: ['orders'],
        queryFn: async () => (await apiGet<Order[]>('orders')) || [],
    });

    const inRange = React.useCallback(
        (o: Order) => {
            const d = orderDate(o);
            if (!d) return false;
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                d.getDate()
            ).padStart(2, '0')}`;
            return mode === 'day' ? iso === date : iso.slice(0, 7) === date.slice(0, 7);
        },
        [mode, date]
    );

    const counted = React.useMemo(
        () =>
            orders
                .filter(inRange)
                .filter((o) => !CANCELLED.includes(String(o.status || '').toLowerCase()))
                .sort((a, b) => (orderDate(a)?.getTime() || 0) - (orderDate(b)?.getTime() || 0)),
        [orders, inRange]
    );

    const revenue = counted.reduce((s, o) => s + (parseFloat(String(o.total)) || 0), 0);
    const count = counted.length;
    const avg = count ? revenue / count : 0;

    const byType: Record<string, { count: number; sum: number }> = {};
    for (const o of counted) {
        const t = o.type || 'dine_in';
        byType[t] = byType[t] || { count: 0, sum: 0 };
        byType[t].count++;
        byType[t].sum += parseFloat(String(o.total)) || 0;
    }

    const periodLabel =
        mode === 'day'
            ? new Date(date).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
              })
            : new Date(date).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    function exportCSV() {
        const rows = [['Datum', 'Zeit', 'Beleg', 'Typ', 'Tisch/Kunde', 'Betrag']];
        for (const o of counted) {
            const d = orderDate(o);
            rows.push([
                d ? d.toLocaleDateString('de-DE') : '',
                d ? d.toLocaleTimeString('de-DE') : '',
                '#' + String(o.id || '').slice(-6),
                TYPE_LABELS[o.type || ''] || o.type || '',
                (o.table_name || o.customerName || '').replace(/;/g, ','),
                (parseFloat(String(o.total)) || 0).toFixed(2),
            ]);
        }
        const csv = rows.map((r) => r.join(';')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `kassenbuch_${date}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success('CSV exportiert.');
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 print:hidden">
                <div className="inline-flex rounded-full border bg-muted p-0.5">
                    {(['day', 'month'] as Mode[]).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={cn(
                                'rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                                mode === m
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground'
                            )}
                        >
                            {m === 'day' ? 'Tag' : 'Monat'}
                        </button>
                    ))}
                </div>
                <Input
                    type={mode === 'day' ? 'date' : 'month'}
                    value={mode === 'day' ? date : date.slice(0, 7)}
                    onChange={(e) =>
                        setDate(mode === 'day' ? e.target.value : e.target.value + '-01')
                    }
                    className="w-auto"
                />
                <Button variant="outline" onClick={() => window.print()}>
                    <Printer /> Tagesabschluss drucken
                </Button>
                <Button variant="outline" onClick={exportCSV}>
                    <FileSpreadsheet /> CSV
                </Button>
            </div>

            {/* Druck-Header */}
            <div className="hidden print:block">
                <h2 className="text-xl font-bold">Tagesabschluss (Z-Bon)</h2>
                <p className="text-muted-foreground">
                    {periodLabel} · erstellt {new Date().toLocaleString('de-DE')}
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-0 bg-primary p-5 text-primary-foreground">
                    <h3 className="text-sm font-semibold">
                        Umsatz {mode === 'day' ? 'Tag' : 'Monat'}
                    </h3>
                    <div className="text-3xl font-bold">{fmt(revenue)}</div>
                    <p className="text-sm opacity-90">{periodLabel}</p>
                </Card>
                <Card className="p-5">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Bestellungen</h3>
                        <i className="fas fa-receipt opacity-50" />
                    </div>
                    <div className="text-3xl font-bold">{count}</div>
                </Card>
                <Card className="p-5">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Ø Bonwert</h3>
                        <i className="fas fa-calculator opacity-50" />
                    </div>
                    <div className="text-3xl font-bold">{fmt(avg)}</div>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="p-5 lg:col-span-1">
                    <h3 className="mb-3 text-sm font-semibold">Nach Bestellart</h3>
                    {Object.keys(byType).length === 0 ? (
                        <div className="py-2.5 text-sm text-muted-foreground">
                            Keine Umsätze im Zeitraum.
                        </div>
                    ) : (
                        Object.entries(byType).map(([t, v]) => (
                            <div
                                key={t}
                                className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-0"
                            >
                                <span>
                                    {TYPE_LABELS[t] || t}{' '}
                                    <small className="opacity-50">({v.count})</small>
                                </span>
                                <strong>{fmt(v.sum)}</strong>
                            </div>
                        ))
                    )}
                </Card>

                <Card className="overflow-hidden p-0 lg:col-span-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Zeit</TableHead>
                                <TableHead>Beleg</TableHead>
                                <TableHead>Typ</TableHead>
                                <TableHead>Tisch/Kunde</TableHead>
                                <TableHead className="text-right">Betrag</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {counted.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="py-10 text-center text-muted-foreground"
                                    >
                                        Keine Bestellungen im Zeitraum.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                counted.map((o) => {
                                    const d = orderDate(o);
                                    const time = d
                                        ? d.toLocaleTimeString('de-DE', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : '--';
                                    return (
                                        <TableRow key={o.id}>
                                            <TableCell>
                                                {mode === 'month' && d
                                                    ? d.toLocaleDateString('de-DE') + ' '
                                                    : ''}
                                                {time}
                                            </TableCell>
                                            <TableCell>#{String(o.id || '').slice(-6)}</TableCell>
                                            <TableCell>
                                                {TYPE_LABELS[o.type || ''] || o.type || 'Vor Ort'}
                                            </TableCell>
                                            <TableCell>
                                                {o.table_name || o.customerName || '—'}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold">
                                                {fmt(o.total)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </div>
    );
}
