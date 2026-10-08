import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useViewTitle } from '@/hooks/useViewTitle';
import {
    computeDashboardData,
    type Branding,
    type HomeData,
    type MenuItem,
    type OrderItem,
    type Reservation,
    type Settings,
    type TableEntity,
} from './dashboard-data';
import { WIDGETS } from './widgets';
import { VisibilityDialog, mergeConfig } from './VisibilityDialog';
import { cn } from '@/lib/utils';

// span-N → responsive Tailwind-Spalten (mobil immer volle Breite)
const SIZE_CLASS: Record<string, string> = {
    'span-12': 'md:col-span-12',
    'span-8': 'md:col-span-8',
    'span-6': 'md:col-span-6',
    'span-4': 'md:col-span-4',
    'span-3': 'lg:col-span-3 md:col-span-6',
};

async function fetchDashboard() {
    const [menu, orders, reservations, home, branding, settings, tables] = await Promise.all([
        apiGet<MenuItem[]>('menu'),
        apiGet<OrderItem[]>('orders').catch(() => null),
        apiGet<Reservation[]>('reservations'),
        apiGet<HomeData>('homepage'),
        apiGet<Branding>('branding'),
        apiGet<Settings>('settings'),
        apiGet<TableEntity[]>('tables').catch(() => null),
    ]);
    return { menu, orders, reservations, home, branding, settings, tables };
}

export function DashboardPage() {
    useViewTitle('Dashboard');
    const [visOpen, setVisOpen] = React.useState(false);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['dashboard'],
        queryFn: fetchDashboard,
    });

    // Echtzeit: bei neuer/aktualisierter Bestellung neu laden
    React.useEffect(() => {
        const socket = getSocket();
        const onChange = () => refetch();
        socket.on('new_order', onChange);
        socket.on('order-updated', onChange);
        return () => {
            socket.off('new_order', onChange);
            socket.off('order-updated', onChange);
        };
    }, [refetch]);

    if (isLoading || !data) {
        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="h-32 animate-pulse bg-muted/50 md:col-span-3" />
                ))}
            </div>
        );
    }

    const d = computeDashboardData(data);
    const config = mergeConfig(data.settings?.dashboardConfig);
    const activeWidgets = config.filter(
        (w) => w.active !== false && w.type !== 'header' && WIDGETS[w.id]
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={() => setVisOpen(true)}>
                    <i className="fas fa-cog" /> Sichtbarkeit
                </Button>
            </div>

            {activeWidgets.length === 0 ? (
                <div className="py-24 text-center text-muted-foreground">
                    <h3 className="text-lg font-semibold">Keine Widgets aktiv</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                    {activeWidgets.map((w) => {
                        const Widget = WIDGETS[w.id];
                        return (
                            <div
                                key={w.id}
                                className={cn('col-span-1', SIZE_CLASS[w.size || 'span-4'])}
                            >
                                <Widget d={d} />
                            </div>
                        );
                    })}
                </div>
            )}

            <VisibilityDialog
                open={visOpen}
                onOpenChange={setVisOpen}
                config={config}
                onSaved={refetch}
            />
        </div>
    );
}
