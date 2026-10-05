import * as React from 'react';
import { toast } from 'sonner';
import { Check, KeyRound, RefreshCw, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LICENSE_INFO_KEY, SETTINGS_KEY, type SettingsData } from './settings-api';
import type { LicenseInfo } from '@/hooks/useLicense';

interface PlanDef {
    plan_id: string;
    label: string;
    note?: string;
    menu_items?: number;
    max_tables?: number;
    price?: number;
    currency?: string;
    modules?: Record<string, boolean>;
}

interface PlansResponse {
    plans: PlanDef[];
    source: 'live' | 'cache';
    fetchedAt: string | null;
}

const MOD_SHORT: Record<string, string> = {
    menu_edit: 'Speisekarte',
    orders_kitchen: 'Bestellungen',
    online_orders: 'Online-Bestell.',
    reservations: 'Reservierung',
    custom_design: 'Design',
    analytics: 'Statistiken',
    qr_pay: 'QR-Pay',
};

export function LicenseTab({
    settings,
    licInfo,
}: {
    settings: SettingsData;
    licInfo: LicenseInfo;
}) {
    const qc = useQueryClient();
    const l = settings.license || {};
    const [key, setKey] = React.useState(l.status === 'active' ? (l.key as string) || '' : '');
    const [busy, setBusy] = React.useState(false);

    const { data: plansData, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
        queryKey: ['license-plans'],
        queryFn: () => apiGet<PlansResponse>('license/plans'),
        staleTime: 5 * 60 * 1000,
    });
    const plans = plansData?.plans ?? [];

    const isTrial = l.isTrial || l.status === 'trial';
    const isActive = l.status === 'active';
    const expiresAt = l.expiresAt ? new Date(l.expiresAt as string) : null;
    const daysLeft = expiresAt
        ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)
        : null;
    const expired = daysLeft !== null && daysLeft <= 0;

    let badge: { variant: 'muted' | 'default' | 'destructive'; text: string } = {
        variant: 'muted',
        text: 'Unbekannt',
    };
    if (isTrial && !expired) badge = { variant: 'default', text: `Trial • noch ${daysLeft} Tage` };
    if (isTrial && expired) badge = { variant: 'destructive', text: 'Trial abgelaufen' };
    if (isActive) badge = { variant: 'default', text: 'Aktiv' };

    async function activate() {
        if (!key.trim()) {
            toast.error('Bitte Lizenz-Key eingeben.');
            return;
        }
        setBusy(true);
        const res = await apiPost<{ success?: boolean; reason?: string; license?: LicenseInfo }>(
            'license/validate',
            { key: key.trim() }
        );
        setBusy(false);
        if (res.success) {
            toast.success('Lizenz erfolgreich aktiviert! 🎉');
            qc.invalidateQueries({ queryKey: SETTINGS_KEY });
            qc.invalidateQueries({ queryKey: LICENSE_INFO_KEY });
        } else {
            toast.error(res.reason || 'Aktivierung fehlgeschlagen.');
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="flex flex-wrap items-center gap-5 pt-6">
                    <div className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <ShieldCheck />
                    </div>
                    <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2.5">
                            <h3 className="font-semibold">Tafeline CMS</h3>
                            <Badge variant={badge.variant}>{badge.text}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Plan:{' '}
                            <strong>
                                {(l.label as string) || (l.type as string) || 'FREE'}
                            </strong>{' '}
                            &nbsp;•&nbsp; Inhaber:{' '}
                            <strong>{(l.customer as string) || '–'}</strong> &nbsp;•&nbsp; Key:{' '}
                            <code className="text-xs">{(l.key as string) || 'N/A'}</code>
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="space-y-3 pt-6">
                    <h4 className="flex items-center gap-2 font-semibold">
                        <KeyRound className="size-4 text-[hsl(var(--success))]" /> Lizenz aktivieren
                        / wechseln
                    </h4>
                    <p className="text-sm text-muted-foreground">
                        Geben Sie Ihren Lizenz-Key ein, um auf einen höheren Plan zu wechseln oder
                        eine abgelaufene Lizenz zu erneuern.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && activate()}
                            placeholder="z.B. TAFELINE-XXXX-XXXX-XXXX-XXXX"
                            className="min-w-64 flex-1 font-mono tracking-wide"
                        />
                        <Button onClick={activate} disabled={busy}>
                            {busy ? 'Wird geprüft…' : 'Lizenz aktivieren'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div>
                <div className="mb-3 flex items-center gap-2">
                    <h4 className="font-semibold">Verfügbare Pläne</h4>
                    {!plansLoading && plansData && (
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem]',
                                plansData.source === 'live'
                                    ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]'
                                    : 'bg-muted text-muted-foreground'
                            )}
                            title={
                                plansData.source === 'live'
                                    ? `Direkt vom Lizenzserver (${plansData.fetchedAt ? new Date(plansData.fetchedAt).toLocaleString('de-DE') : ''})`
                                    : 'Zwischengespeicherte Daten – Lizenzserver nicht erreichbar'
                            }
                        >
                            {plansData.source === 'live' ? (
                                <Wifi className="size-3" />
                            ) : (
                                <WifiOff className="size-3" />
                            )}
                            {plansData.source === 'live' ? 'Live' : 'Cache'}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => refetchPlans()}
                        className="ml-auto inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        title="Pläne neu laden"
                    >
                        <RefreshCw className="size-3" /> Aktualisieren
                    </button>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                    {plansLoading && (
                        <div className="col-span-full text-sm text-muted-foreground">
                            Pläne werden geladen…
                        </div>
                    )}
                    {plans.map((p) => {
                        const isCurrent = (l.type || 'FREE') === p.plan_id;
                        return (
                            <Card
                                key={p.plan_id}
                                className={cn(
                                    'relative p-4',
                                    isCurrent && 'border-primary bg-primary/5'
                                )}
                            >
                                {isCurrent && (
                                    <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[0.7rem] text-primary-foreground">
                                        Aktiv
                                    </span>
                                )}
                                <div className="font-bold">{p.label}</div>
                                {p.price !== undefined && (
                                    <div className="mb-1 text-xs font-medium text-primary">
                                        {p.price === 0 ? 'Kostenlos' : `${p.price} ${p.currency ?? 'EUR'}/Monat`}
                                    </div>
                                )}
                                <div className="mb-2.5 text-xs text-muted-foreground">
                                    {p.note || ''}
                                </div>
                                <div className="flex flex-col gap-1 text-xs">
                                    {p.menu_items !== undefined && <span>🍽 {p.menu_items} Speisen</span>}
                                    {p.max_tables !== undefined && <span>🪑 {p.max_tables} Tische</span>}
                                    {Object.entries(p.modules || {}).map(([mod, on]) => (
                                        <span
                                            key={mod}
                                            className={cn(
                                                'flex items-center gap-1.5',
                                                on
                                                    ? 'text-[hsl(var(--success))]'
                                                    : 'text-muted-foreground'
                                            )}
                                        >
                                            {on ? (
                                                <Check className="size-3" />
                                            ) : (
                                                <X className="size-3" />
                                            )}
                                            {MOD_SHORT[mod] || mod}
                                        </span>
                                    ))}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
