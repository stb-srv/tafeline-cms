import * as React from 'react';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useGuestCategories, useGuestMenu } from './guest-api';
import { useCart } from './cart-store';
import { getCatLabel, normalizeCatId, type Category, type Dish } from '@/modules/menu/menu-api';

function dishInCat(d: Dish, c: Category): boolean {
    if (!d.cat) return false;
    return (
        d.cat === c.id ||
        normalizeCatId(d.cat) === c.id ||
        d.cat.trim().toLowerCase() === (c.label || '').trim().toLowerCase()
    );
}

export function MenuPage() {
    const { data: menu = [] } = useGuestMenu();
    const { data: categories = [] } = useGuestCategories();
    const add = useCart((s) => s.add);

    const [query, setQuery] = React.useState('');
    const [activeCat, setActiveCat] = React.useState<string | null>(null);
    const term = query.trim().toLowerCase();

    function addToCart(d: Dish) {
        add({ id: d.id, name: d.name, price: Number(d.price) || 0, number: d.number });
        toast.success(`„${d.name}" hinzugefügt`);
    }

    const grouped = categories
        .filter((c) => !activeCat || c.id === activeCat)
        .map((c) => ({
            cat: c,
            dishes: menu.filter(
                (d) =>
                    d.available !== false &&
                    dishInCat(d, c) &&
                    (!term ||
                        d.name.toLowerCase().includes(term) ||
                        (d.desc || '').toLowerCase().includes(term))
            ),
        }))
        .filter((g) => g.dishes.length > 0);

    const totalHits = grouped.reduce((n, g) => n + g.dishes.length, 0);

    return (
        <div className="mx-auto max-w-5xl px-6 py-12">
            <h1 className="mb-2 text-center font-guest-display text-4xl font-bold text-primary">
                Unsere Speisekarte
            </h1>
            <p className="mb-8 text-center text-muted-foreground">
                Stöbern Sie durch unsere Gerichte – nach Kategorie filtern oder direkt suchen.
            </p>

            {/* Suche */}
            <div className="relative mx-auto mb-6 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Gericht suchen…"
                    className="pl-9"
                />
            </div>

            {/* Kategorie-Filter */}
            <div className="mb-10 flex flex-wrap justify-center gap-2">
                <button
                    onClick={() => setActiveCat(null)}
                    className={cn(
                        'rounded-full border px-4 py-1.5 text-sm font-medium transition',
                        !activeCat
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'hover:border-primary'
                    )}
                >
                    Alle
                </button>
                {categories.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => setActiveCat(c.id)}
                        className={cn(
                            'rounded-full border px-4 py-1.5 text-sm font-medium transition',
                            activeCat === c.id
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'hover:border-primary'
                        )}
                    >
                        {getCatLabel(c)}
                    </button>
                ))}
            </div>

            {totalHits === 0 ? (
                <p className="py-16 text-center text-muted-foreground">
                    {term
                        ? `Keine Gerichte gefunden für „${query}".`
                        : 'Speisekarte folgt in Kürze.'}
                </p>
            ) : (
                <div className="space-y-12">
                    {grouped.map(({ cat, dishes }) => (
                        <div key={cat.id}>
                            <h2 className="mb-5 border-b pb-2 font-guest-display text-2xl font-bold text-secondary">
                                {getCatLabel(cat)}
                            </h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {dishes.map((d) => (
                                    <div
                                        key={d.id}
                                        className="flex gap-4 rounded-xl border bg-card p-4"
                                    >
                                        {d.image && (
                                            <img
                                                src={d.image}
                                                alt={d.name}
                                                className="size-20 shrink-0 rounded-lg object-cover"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <h3 className="font-bold">
                                                    {d.is_daily_special ? '⭐ ' : ''}
                                                    {d.name}
                                                </h3>
                                                <span className="font-mono font-bold text-secondary">
                                                    {(Number(d.price) || 0).toFixed(2)} €
                                                </span>
                                            </div>
                                            {d.desc && (
                                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                                    {d.desc}
                                                </p>
                                            )}
                                            <button
                                                onClick={() => addToCart(d)}
                                                className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                                            >
                                                <Plus className="size-3.5" /> Hinzufügen
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
