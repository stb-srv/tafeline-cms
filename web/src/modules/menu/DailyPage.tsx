import * as React from 'react';
import { toast } from 'sonner';
import { Search, Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiPut } from '@/lib/api';
import { useViewTitle } from '@/hooks/useViewTitle';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { MENU_QUERY_KEY, catMatchesFilter, getCatLabel, useMenuData, type Dish } from './menu-api';

export function DailyPage() {
    useViewTitle('Tagesgerichte');
    const qc = useQueryClient();
    const { data, isLoading } = useMenuData();
    const [q, setQ] = React.useState('');
    const [cat, setCat] = React.useState('');

    async function toggle(d: Dish, on: boolean) {
        const res = await apiPut(`menu/${d.id}`, { is_daily_special: on });
        if (res.success !== false) {
            qc.invalidateQueries({ queryKey: MENU_QUERY_KEY });
            toast.success(on ? `„${d.name}" ist Tagesempfehlung` : `„${d.name}" entfernt`);
        } else toast.error(res.reason || 'Fehler');
    }

    if (isLoading || !data) {
        return <Card className="h-96 animate-pulse bg-muted/50" />;
    }

    const specials = data.menu.filter((d) => d.is_daily_special);

    const filtered = data.menu.filter((d) => {
        const matchQ =
            !q ||
            d.name.toLowerCase().includes(q.toLowerCase()) ||
            (d.desc || '').toLowerCase().includes(q.toLowerCase());
        const matchCat = !cat || catMatchesFilter(d.cat, cat, data.categories);
        return matchQ && matchCat;
    });

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold">Tagesgerichte & Empfehlungen</h3>
                <p className="text-sm text-muted-foreground">
                    Gerichte als Tagesempfehlung markieren – sie erhalten auf der Speisekarte ein
                    goldenes Badge. Aktuell markiert: <strong>{specials.length}</strong>
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Gericht suchen…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
                <select
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                >
                    <option value="">Alle Kategorien</option>
                    {data.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.label}
                        </option>
                    ))}
                </select>
            </div>

            <Card className="overflow-hidden p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12" />
                            <TableHead>Nr.</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Kategorie</TableHead>
                            <TableHead>Preis</TableHead>
                            <TableHead className="text-right">Tagesempfehlung</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((d) => (
                            <TableRow key={d.id}>
                                <TableCell>
                                    {!!d.is_daily_special && (
                                        <Star className="size-4 fill-yellow-400 text-yellow-400" />
                                    )}
                                </TableCell>
                                <TableCell className="font-bold text-muted-foreground">
                                    {d.number && d.number !== '0' ? d.number : '-'}
                                </TableCell>
                                <TableCell className="font-bold text-primary">{d.name}</TableCell>
                                <TableCell>{getCatLabel(d.cat)}</TableCell>
                                <TableCell className="font-mono">
                                    {(d.price ?? 0).toFixed(2)}€
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end">
                                        <Switch
                                            checked={!!d.is_daily_special}
                                            onCheckedChange={(c) => toggle(d, c)}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-8 text-center text-muted-foreground"
                                >
                                    Keine Gerichte gefunden.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
