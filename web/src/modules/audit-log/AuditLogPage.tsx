import * as React from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useViewTitle } from '@/hooks/useViewTitle';
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

interface AuditEntry {
    action: string;
    actor?: string;
    entity?: string;
    entity_id?: string | number;
    detail?: Record<string, unknown>;
    ts?: string;
}

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
    'menu.update': { icon: 'fa-pen', color: 'hsl(var(--primary))', label: 'Gericht geändert' },
    'menu.bulk.enable': { icon: 'fa-eye', color: '#22c55e', label: 'Gerichte aktiviert' },
    'menu.bulk.disable': { icon: 'fa-eye-slash', color: '#6b7280', label: 'Gerichte deaktiviert' },
    'menu.bulk.delete': { icon: 'fa-trash', color: '#ef4444', label: 'Gerichte gelöscht' },
    'menu.bulk.set_category': { icon: 'fa-tags', color: '#c8a96e', label: 'Kategorie zugewiesen' },
    'reservation.update': {
        icon: 'fa-calendar-check',
        color: 'hsl(var(--primary))',
        label: 'Reservierung geändert',
    },
    'reservation.delete': {
        icon: 'fa-calendar-xmark',
        color: '#ef4444',
        label: 'Reservierung gelöscht',
    },
    'settings.update': {
        icon: 'fa-sliders-h',
        color: 'hsl(var(--primary))',
        label: 'Einstellungen geändert',
    },
    'settings.modules': { icon: 'fa-toggle-on', color: '#c8a96e', label: 'Module geändert' },
    'branding.update': {
        icon: 'fa-palette',
        color: 'hsl(var(--primary))',
        label: 'Branding geändert',
    },
    'license.activate': { icon: 'fa-key', color: '#22c55e', label: 'Lizenz aktiviert' },
    'user.create': { icon: 'fa-user-plus', color: '#22c55e', label: 'Benutzer angelegt' },
    'user.update': {
        icon: 'fa-user-pen',
        color: 'hsl(var(--primary))',
        label: 'Benutzer geändert',
    },
    'user.delete': { icon: 'fa-user-minus', color: '#ef4444', label: 'Benutzer gelöscht' },
    'user.reset_password': { icon: 'fa-lock', color: '#c8a96e', label: 'Passwort zurückgesetzt' },
    'feedback.delete': { icon: 'fa-star', color: '#ef4444', label: 'Bewertung gelöscht' },
};

function metaFor(action: string) {
    return (
        ACTION_META[action] || {
            icon: 'fa-clipboard-list',
            color: 'hsl(var(--muted-foreground))',
            label: action,
        }
    );
}

function relTime(iso?: string) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000),
        h = Math.floor(diff / 3600000),
        d = Math.floor(diff / 86400000);
    if (min < 1) return 'gerade eben';
    if (min < 60) return `vor ${min} Min.`;
    if (h < 24) return `vor ${h} Std.`;
    if (d < 30) return `vor ${d} Tag${d > 1 ? 'en' : ''}`;
    return new Date(iso).toLocaleDateString('de-DE');
}

export function AuditLogPage() {
    useViewTitle('Änderungsprotokoll');
    const [filter, setFilter] = React.useState('');
    const { data: log = [] } = useQuery({
        queryKey: ['audit-log'],
        queryFn: async () => (await apiGet<AuditEntry[]>('audit-log')) || [],
    });

    const filtered = filter
        ? log.filter((e) => JSON.stringify(e).toLowerCase().includes(filter.toLowerCase()))
        : log;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="font-semibold">Änderungsprotokoll</h3>
                    <p className="text-sm text-muted-foreground">
                        Wer hat wann was geändert – für den Mehrbenutzerbetrieb.
                    </p>
                </div>
                <div className="relative min-w-60">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-40" />
                    <Input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filtern…"
                        className="pl-9"
                    />
                </div>
            </div>
            <Card className="overflow-hidden p-0">
                {log.length === 0 ? (
                    <div className="p-16 text-center text-muted-foreground">
                        Noch keine protokollierten Änderungen.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Aktion</TableHead>
                                <TableHead>Benutzer</TableHead>
                                <TableHead>Objekt</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Zeit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="py-8 text-center text-muted-foreground"
                                    >
                                        Kein Treffer.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((e, i) => {
                                    const m = metaFor(e.action);
                                    const detail =
                                        e.detail && typeof e.detail === 'object'
                                            ? Object.entries(e.detail)
                                                  .map(
                                                      ([k, v]) =>
                                                          `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`
                                                  )
                                                  .join(' · ')
                                            : '';
                                    return (
                                        <TableRow key={i}>
                                            <TableCell>
                                                <span className="inline-flex items-center gap-2">
                                                    <i
                                                        className={`fas ${m.icon}`}
                                                        style={{ color: m.color }}
                                                    />
                                                    {m.label}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {e.actor || <em className="opacity-40">System</em>}
                                            </TableCell>
                                            <TableCell className="text-xs opacity-70">
                                                {e.entity || ''}{' '}
                                                {e.entity_id
                                                    ? '#' + String(e.entity_id).slice(0, 24)
                                                    : ''}
                                            </TableCell>
                                            <TableCell className="text-xs opacity-60">
                                                {detail}
                                            </TableCell>
                                            <TableCell
                                                className="text-xs"
                                                title={
                                                    e.ts
                                                        ? new Date(e.ts).toLocaleString('de-DE')
                                                        : ''
                                                }
                                            >
                                                {relTime(e.ts)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                )}
            </Card>
        </div>
    );
}
