import * as React from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2, Utensils } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
    MENU_QUERY_KEY,
    WEEKDAYS,
    catMatchesFilter,
    formatRelativeTime,
    getCatLabel,
    normalizeCatId,
    type Dish,
    type MenuData,
} from './menu-api';
import { DishFormDialog } from './DishFormDialog';

type SortKey = 'name' | 'nr' | 'price' | 'cat';
const PAGE_SIZE = 25;

export function DishesTab({ data }: { data: MenuData }) {
    const qc = useQueryClient();
    const refresh = () => qc.invalidateQueries({ queryKey: MENU_QUERY_KEY });

    const [search, setSearch] = React.useState('');
    const [catFilter, setCatFilter] = React.useState('All');
    const [sort, setSort] = React.useState<SortKey>('name');
    const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
    const [page, setPage] = React.useState(1);
    const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
    const [formOpen, setFormOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<Dish | null>(null);

    const { menu, categories, allergens, additives } = data;

    const filtered = React.useMemo(() => {
        const dir = sortDir === 'desc' ? -1 : 1;
        const out = menu.filter((d) => {
            const matchesSearch =
                !search ||
                d.name.toLowerCase().includes(search.toLowerCase()) ||
                (d.number && d.number.toString().includes(search));
            const matchesCat =
                catFilter === 'All' || catMatchesFilter(d.cat, catFilter, categories);
            return matchesSearch && matchesCat;
        });
        out.sort((a, b) => {
            switch (sort) {
                case 'price':
                    return dir * ((a.price || 0) - (b.price || 0));
                case 'nr':
                    return (
                        dir * ((parseInt(a.number || '0') || 0) - (parseInt(b.number || '0') || 0))
                    );
                case 'cat':
                    return dir * getCatLabel(a.cat).localeCompare(getCatLabel(b.cat));
                default:
                    return dir * a.name.localeCompare(b.name);
            }
        });
        return out;
    }, [menu, categories, search, catFilter, sort, sortDir]);

    const grouped = catFilter === 'All' && !search;
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = grouped ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    function toggleSort(key: SortKey) {
        if (sort === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSort(key);
            setSortDir('asc');
        }
        setPage(1);
    }

    function toggleCollapse(id: string) {
        setCollapsed((s) => {
            const next = new Set(s);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    async function toggleAvailability(d: Dish, checked: boolean) {
        const res = await apiPut(`menu/${d.id}`, { available: checked });
        if (res.success !== false) refresh();
        else toast.error(res.reason || 'Fehler');
    }

    async function deleteDish(d: Dish) {
        if (!window.confirm(`„${d.name}" wirklich unwiderruflich löschen?`)) return;
        const res = await apiDelete(`menu/${d.id}`);
        if (res.success !== false) {
            toast.success('Gericht gelöscht.');
            refresh();
        } else toast.error(res.reason || 'Fehler');
    }

    function openAdd() {
        setEditing(null);
        setFormOpen(true);
    }
    function openEdit(d: Dish) {
        setEditing(d);
        setFormOpen(true);
    }

    // Gruppierte Ansicht: Gerichte den Kategorien zuordnen
    const renderGrouped = () => {
        const assigned = new Set<string>();
        const blocks: React.ReactNode[] = [];
        for (const cat of categories) {
            const catDishes = paged.filter(
                (d) =>
                    d.cat &&
                    (d.cat === cat.id ||
                        normalizeCatId(d.cat) === cat.id ||
                        d.cat.trim().toLowerCase() === (cat.label || '').trim().toLowerCase())
            );
            catDishes.forEach((d) => assigned.add(d.id));
            if (!catDishes.length) continue;
            blocks.push(renderCatBlock(cat.id, cat.label, catDishes));
        }
        const uncat = paged.filter((d) => !assigned.has(d.id));
        if (uncat.length) blocks.push(renderCatBlock('__uncat__', 'Unsortiert', uncat));
        return blocks;
    };

    const renderCatBlock = (id: string, label: string, dishes: Dish[]) => {
        const isCollapsed = collapsed.has(id);
        return (
            <React.Fragment key={id}>
                <TableRow
                    className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                    onClick={() => toggleCollapse(id)}
                >
                    <TableCell colSpan={7}>
                        <div className="flex items-center gap-3">
                            {isCollapsed ? (
                                <ChevronRight className="size-4 opacity-40" />
                            ) : (
                                <ChevronDown className="size-4 opacity-40" />
                            )}
                            <span className="text-sm font-extrabold uppercase tracking-wide text-primary">
                                {label}
                            </span>
                            <Badge variant="muted">{dishes.length}</Badge>
                        </div>
                    </TableCell>
                </TableRow>
                {!isCollapsed && dishes.map((d) => <DishRow key={d.id} d={d} />)}
            </React.Fragment>
        );
    };

    const DishRow = ({ d }: { d: Dish }) => {
        const isAvail = d.available !== false;
        const lastUpd = formatRelativeTime(d.updated_at);
        const hasImg = d.image && (d.image.startsWith('http') || d.image.startsWith('/'));
        const days = Array.isArray(d.available_days) ? d.available_days : [];
        const dayLabel =
            days.length > 0 && days.length < 7
                ? days
                      .slice()
                      .sort((a, b) => a - b)
                      .map((i) => WEEKDAYS[i])
                      .join(' ')
                : '';
        return (
            <TableRow className={cn(!isAvail && 'opacity-50')}>
                <TableCell className="font-bold text-muted-foreground">{d.number || '-'}</TableCell>
                <TableCell>
                    <div className="h-10 w-10 overflow-hidden rounded-md border bg-muted">
                        {hasImg ? (
                            <img src={d.image!} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <Utensils className="m-2.5 size-5 opacity-20" />
                        )}
                    </div>
                </TableCell>
                <TableCell>
                    <div className="font-bold text-primary">{d.name}</div>
                    {d.desc && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {d.desc}
                        </div>
                    )}
                    {dayLabel && (
                        <div className="mt-1 text-[0.65rem] text-muted-foreground">
                            <i className="fas fa-calendar-day" /> {dayLabel}
                        </div>
                    )}
                    <div className="mt-1 text-[0.65rem] opacity-40">{lastUpd || 'Neu'}</div>
                </TableCell>
                <TableCell>
                    <Badge variant="muted">{getCatLabel(d.cat)}</Badge>
                </TableCell>
                <TableCell className="font-mono font-extrabold text-secondary">
                    {(d.price ?? 0).toFixed(2)}€
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={isAvail}
                            onCheckedChange={(c) => toggleAvailability(d, c)}
                            aria-label="Verfügbarkeit"
                        />
                        <span className="text-xs font-semibold text-muted-foreground">
                            {isAvail ? 'AN' : 'AUS'}
                        </span>
                    </div>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openEdit(d)}>
                            <Pencil /> Bearbeiten
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteDish(d)}
                        >
                            <Trash2 />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
        );
    };

    const Th = ({ label, k }: { label: string; k: SortKey }) => (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(k)}>
            {label}{' '}
            <i
                className={cn(
                    'fas',
                    sort !== k
                        ? 'fa-sort opacity-30'
                        : sortDir === 'desc'
                          ? 'fa-sort-down'
                          : 'fa-sort-up'
                )}
            />
        </TableHead>
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <Card className="flex flex-wrap items-center gap-3 p-4">
                <div className="relative min-w-52 flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-40" />
                    <Input
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Gericht suchen…"
                        className="pl-9"
                    />
                </div>
                <select
                    className="h-9 w-44 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={catFilter}
                    onChange={(e) => {
                        setCatFilter(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="All">Alle Kategorien</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.label}
                        </option>
                    ))}
                </select>
                <select
                    className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                >
                    <option value="name">Name A-Z</option>
                    <option value="nr">Nr.</option>
                    <option value="price">Preis</option>
                    <option value="cat">Kategorie</option>
                </select>
                <Button onClick={openAdd}>
                    <Plus /> Neues Gericht
                </Button>
            </Card>

            <Card className="overflow-hidden p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <Th label="Nr." k="nr" />
                            <TableHead>Bild</TableHead>
                            <Th label="Name / Beschreibung" k="name" />
                            <Th label="Kategorie" k="cat" />
                            <Th label="Preis" k="price" />
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aktionen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {grouped ? renderGrouped() : paged.map((d) => <DishRow key={d.id} d={d} />)}
                    </TableBody>
                </Table>
                {filtered.length === 0 && (
                    <div className="p-16 text-center text-muted-foreground">
                        Keine Gerichte gefunden.
                    </div>
                )}
            </Card>

            {!grouped && totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                        Seite {page} von {totalPages} · {filtered.length} Einträge
                    </span>
                    <div className="flex gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            Zurück
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Weiter
                        </Button>
                    </div>
                </div>
            )}

            <DishFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                dish={editing}
                categories={categories}
                allergens={allergens}
                additives={additives}
                onSaved={refresh}
            />
        </div>
    );
}
