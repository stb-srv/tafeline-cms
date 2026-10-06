import { useNavigate } from 'react-router-dom';
import { StatWidget, WidgetValue, WidgetCaption, Sparkline, TrendBadge } from './components';
import { getVacationStatus, type DashboardData } from './dashboard-data';
import { cn } from '@/lib/utils';

type W = (props: { d: DashboardData }) => React.ReactNode;

const eur = (v: number) => v.toFixed(2).replace('.', ',');
const numPrices = (d: DashboardData) =>
    d.menu.map((m) => parseFloat(String(m.price))).filter((p) => !isNaN(p));

const CHART_COLORS = [
    '#1b3a5c',
    '#c8a96e',
    '#2e86ab',
    '#e07b39',
    '#27ae60',
    '#8e44ad',
    '#e74c3c',
    '#16a085',
    '#d35400',
    '#2980b9',
];

const ListRow = ({ left, right }: { left: React.ReactNode; right: React.ReactNode }) => (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-0">
        <span className="truncate">{left}</span>
        <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {right}
        </span>
    </div>
);

const today_overview: W = ({ d }) => {
    const navigate = useNavigate();
    const today = new Date().toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
    });
    return (
        <StatWidget title={`Heute · ${today}`} icon="fa-calendar-day" className="overflow-auto">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                    <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <span>Reservierungen</span>
                        <span>{d.todayRes.length}</span>
                    </div>
                    {d.todayRes.length ? (
                        d.todayRes.slice(0, 6).map((r, i) => (
                            <ListRow
                                key={i}
                                left={
                                    <>
                                        <strong>{r.start_time || r.time || ''}</strong> ·{' '}
                                        {r.name || 'Gast'}
                                    </>
                                }
                                right={r.guests || 1}
                            />
                        ))
                    ) : (
                        <div className="py-3 text-center text-sm text-muted-foreground">
                            Keine Reservierungen heute
                        </div>
                    )}
                    {d.todayRes.length > 0 && (
                        <button
                            className="mt-2 text-xs font-medium text-primary hover:underline"
                            onClick={() => navigate('/reservations')}
                        >
                            Alle anzeigen
                        </button>
                    )}
                </div>
                <div>
                    <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <span>Offene Bestellungen</span>
                        <span>{d.pendingOrders.length}</span>
                    </div>
                    {d.pendingOrders.length ? (
                        d.pendingOrders
                            .slice(0, 6)
                            .map((o, i) => (
                                <ListRow
                                    key={i}
                                    left={o.table_name || o.tableNumber || o.table || 'Bestellung'}
                                    right={`${eur(parseFloat(String(o.total || 0)))}€`}
                                />
                            ))
                    ) : (
                        <div className="py-3 text-center text-sm text-muted-foreground">
                            Keine offenen Bestellungen
                        </div>
                    )}
                    {d.pendingOrders.length > 0 && (
                        <button
                            className="mt-2 text-xs font-medium text-primary hover:underline"
                            onClick={() => navigate('/orders')}
                        >
                            Zur Küche
                        </button>
                    )}
                </div>
            </div>
        </StatWidget>
    );
};

const kpi_trends: W = ({ d }) => {
    const w = d.week;
    return (
        <StatWidget title="Trend · letzte 7 Tage" icon="fa-chart-line">
            <div className="flex flex-wrap gap-7">
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <span>Umsatz</span>
                        <TrendBadge cur={w.revThis} prev={w.revLast} />
                    </div>
                    <div className="text-2xl font-bold">{w.revThis.toFixed(0)}€</div>
                    <div className="mb-1.5 text-xs text-muted-foreground">
                        Vorwoche: {w.revLast.toFixed(0)}€
                    </div>
                    <div className="text-secondary">
                        <Sparkline values={w.revSeries} />
                    </div>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <span>Reservierungen</span>
                        <TrendBadge cur={w.resThis} prev={w.resLast} />
                    </div>
                    <div className="text-2xl font-bold">{w.resThis}</div>
                    <div className="mb-1.5 text-xs text-muted-foreground">
                        Vorwoche: {w.resLast}
                    </div>
                    <div className="text-primary">
                        <Sparkline values={w.resSeries} />
                    </div>
                </div>
            </div>
        </StatWidget>
    );
};

const branding: W = ({ d }) => {
    const l = d.license;
    const planLabel = l.label || l.type || 'FREE';
    const exp = l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('de-DE') : null;
    return (
        <StatWidget accent>
            <div className="flex items-center gap-4">
                <i className="fas fa-store text-3xl opacity-80" aria-hidden />
                <div className="flex-1">
                    <h3 className="text-lg font-bold">{d.branding.name || 'Restaurant'}</h3>
                    <p className="text-sm opacity-90">
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                            {planLabel}
                        </span>{' '}
                        {l.isTrial && exp ? `· Trial bis ${exp}` : `· ${l.status || 'aktiv'}`}
                    </p>
                </div>
            </div>
        </StatWidget>
    );
};

const dishes: W = ({ d }) => {
    const count = d.menu.length;
    const max = d.license.limits?.max_dishes || 30;
    const pct = Math.min(Math.round((count / max) * 100), 100);
    const warn = pct >= 85;
    return (
        <StatWidget title="Gerichte" icon="fa-utensils" to="/menu/dishes">
            <WidgetValue>{count}</WidgetValue>
            <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        'h-full rounded-full transition-all',
                        warn ? 'bg-[hsl(var(--warning))]' : 'bg-primary'
                    )}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <WidgetCaption>
                {count} / {max} ({pct}%)
            </WidgetCaption>
        </StatWidget>
    );
};

const reservations: W = ({ d }) => (
    <StatWidget title="Reservierungen" icon="fa-calendar-check" to="/reservations">
        <WidgetValue>{d.reservations.length}</WidgetValue>
        <WidgetCaption>insgesamt empfangen</WidgetCaption>
    </StatWidget>
);

const status: W = ({ d }) => (
    <StatWidget title="Status" icon="fa-circle" to="/opening">
        <WidgetValue
            className={cn('text-xl', d.isOpen ? 'text-[hsl(var(--success))]' : 'text-destructive')}
        >
            {d.isOpen ? 'Geöffnet' : 'Geschlossen'}
        </WidgetValue>
        <WidgetCaption>{d.ohText}</WidgetCaption>
    </StatWidget>
);

const vacation: W = ({ d }) => {
    const st = getVacationStatus(d.home.vacation);
    return (
        <StatWidget title="Urlaub" icon={st.icon} to="/designer/vacation">
            <WidgetValue className="text-xl">
                <span style={{ color: st.color }}>{st.label}</span>
            </WidgetValue>
            <WidgetCaption>{st.subText}</WidgetCaption>
        </StatWidget>
    );
};

const website: W = ({ d }) => (
    <StatWidget title="Website" icon="fa-magic" to="/designer">
        <WidgetValue className="text-xl">
            {d.home.promotionEnabled ? 'Aktion Aktiv' : 'Kein Banner'}
        </WidgetValue>
        <WidgetCaption>{d.home.promotionText || 'Tagesempfehlung'}</WidgetCaption>
    </StatWidget>
);

const categories: W = ({ d }) => (
    <StatWidget title="Menü-Vielfalt" icon="fa-tags" to="/menu/dishes">
        <WidgetValue>{d.catStats.length}</WidgetValue>
        <WidgetCaption>Speise-Kategorien</WidgetCaption>
    </StatWidget>
);

const menu_breakdown: W = ({ d }) => {
    const total = d.menu.length;
    if (!total)
        return (
            <StatWidget>
                <div className="flex h-full items-center justify-center text-muted-foreground">
                    Keine Gerichte vorhanden
                </div>
            </StatWidget>
        );
    return (
        <StatWidget title="Speisen nach Kategorie" icon="fa-chart-bar" className="overflow-auto">
            <div className="mb-3 text-xs text-muted-foreground">{total} Gerichte gesamt</div>
            {d.catStats.map((cs, i) => {
                const pct = Math.round((cs.count / total) * 100);
                return (
                    <div key={cs.label} className="mb-2.5">
                        <div className="mb-1 flex items-baseline justify-between">
                            <span className="max-w-[55%] truncate text-sm font-semibold">
                                {cs.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {cs.count} Gerichte • {pct}%
                            </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${pct}%`,
                                    background: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </StatWidget>
    );
};

const price_stats: W = ({ d }) => {
    const prices = numPrices(d);
    const min = prices.length ? Math.min(...prices).toFixed(2) : '—';
    const max = prices.length ? Math.max(...prices).toFixed(2) : '—';
    return (
        <StatWidget title="Preisspanne" icon="fa-euro-sign" to="/menu/dishes">
            <div className="my-2 space-y-1.5">
                <div className="flex items-center gap-2">
                    <span className="w-8 text-xs text-muted-foreground">MIN</span>
                    <span className="text-xl font-extrabold text-[#27ae60]">{min} €</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-8 text-xs text-muted-foreground">MAX</span>
                    <span className="text-xl font-extrabold text-[#e07b39]">{max} €</span>
                </div>
            </div>
            <WidgetCaption>{prices.length} Preise ausgewertet</WidgetCaption>
        </StatWidget>
    );
};

const avg_price: W = ({ d }) => {
    const prices = numPrices(d);
    const avg = prices.length
        ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
        : '—';
    return (
        <StatWidget title="Durchschnittspreis" icon="fa-calculator" to="/menu/dishes">
            <WidgetValue>{avg} €</WidgetValue>
            <WidgetCaption>Ø über alle Gerichte</WidgetCaption>
        </StatWidget>
    );
};

const orders_today: W = ({ d }) => {
    const pending = d.pendingOrders.length;
    return (
        <StatWidget title="Bestellungen Heute" icon="fa-receipt" to="/orders">
            <WidgetValue>{d.todayOrders.length}</WidgetValue>
            <WidgetCaption>
                {pending > 0 ? (
                    <span className="font-bold text-[hsl(var(--warning))]">
                        {pending} ausstehend
                    </span>
                ) : (
                    'Alle erledigt'
                )}
            </WidgetCaption>
        </StatWidget>
    );
};

const revenue_today: W = ({ d }) => {
    const count = d.todayOrders.length;
    return (
        <StatWidget title="Umsatz Heute" icon="fa-coins" to="/orders">
            <WidgetValue>{eur(d.revenueToday)} €</WidgetValue>
            <WidgetCaption>
                {count} Bestellung{count !== 1 ? 'en' : ''}
            </WidgetCaption>
        </StatWidget>
    );
};

const pending_orders: W = ({ d }) => {
    const count = d.pendingOrders.length;
    const urgent = count > 0;
    return (
        <StatWidget title="Ausstehend" icon="fa-hourglass-half" to="/orders">
            <WidgetValue
                className={urgent ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--success))]'}
            >
                {count}
            </WidgetValue>
            <WidgetCaption>
                {urgent ? 'Aktion erforderlich' : 'Keine offenen Bestellungen'}
            </WidgetCaption>
        </StatWidget>
    );
};

const upcoming_reservations: W = ({ d }) => {
    const navigate = useNavigate();
    const items = d.upcomingRes.slice(0, 4);
    return (
        <StatWidget title="Bald" icon="fa-calendar-alt" className="overflow-auto">
            {items.length ? (
                items.map((r, i) => (
                    <ListRow key={i} left={r.name} right={`${r.date} ${r.start_time}`} />
                ))
            ) : (
                <div className="py-3 text-center text-sm text-muted-foreground">
                    Keine Reservierungen
                </div>
            )}
            {items.length > 0 && (
                <button
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                    onClick={() => navigate('/reservations')}
                >
                    Alle anzeigen
                </button>
            )}
        </StatWidget>
    );
};

const quick_actions: W = () => {
    const navigate = useNavigate();
    const actions = [
        { icon: 'fa-plus-circle', label: 'Gericht', to: '/menu/dishes' },
        { icon: 'fa-receipt', label: 'Bestellungen', to: '/orders' },
        { icon: 'fa-calendar-check', label: 'Reservierung', to: '/reservations' },
        { icon: 'fa-cog', label: 'Einstellungen', to: '/settings/branding' },
    ];
    return (
        <StatWidget title="Schnellzugriff" icon="fa-bolt">
            <div className="grid grid-cols-2 gap-2">
                {actions.map((a) => (
                    <button
                        key={a.to}
                        onClick={() => navigate(a.to)}
                        className="flex flex-col items-center gap-1.5 rounded-md border border-border p-3 text-sm hover:bg-accent"
                    >
                        <i className={cn('fas', a.icon, 'text-lg text-primary')} aria-hidden />
                        {a.label}
                    </button>
                ))}
            </div>
        </StatWidget>
    );
};

const table_overview: W = ({ d }) => {
    const tables = d.tables.filter((t) => t.active);
    if (!tables.length)
        return (
            <StatWidget>
                <div className="flex h-full items-center justify-center text-muted-foreground">
                    Keine aktiven Tische
                </div>
            </StatWidget>
        );
    const pendingNums = new Set(d.pendingOrders.map((o) => String(o.tableNumber || o.table || '')));
    const free = tables.filter((t) => !pendingNums.has(String(t.number || t.id || ''))).length;
    return (
        <StatWidget title="Tischübersicht" icon="fa-chair">
            <div className="flex flex-wrap gap-2">
                {tables.map((t) => {
                    const occupied = pendingNums.has(String(t.number || t.id || ''));
                    return (
                        <div
                            key={String(t.id ?? t.number)}
                            title={`Tisch ${t.number || t.id} · ${t.capacity} P.`}
                            className={cn(
                                'flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold',
                                occupied
                                    ? 'bg-destructive/15 text-destructive'
                                    : 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]'
                            )}
                        >
                            {t.number || t.id}
                        </div>
                    );
                })}
            </div>
            <WidgetCaption>
                {free} / {tables.length} frei
            </WidgetCaption>
        </StatWidget>
    );
};

export const WIDGETS: Record<string, W> = {
    today_overview,
    kpi_trends,
    branding,
    dishes,
    reservations,
    status,
    vacation,
    website,
    categories,
    menu_breakdown,
    price_stats,
    avg_price,
    orders_today,
    revenue_today,
    pending_orders,
    upcoming_reservations,
    quick_actions,
    table_overview,
};
