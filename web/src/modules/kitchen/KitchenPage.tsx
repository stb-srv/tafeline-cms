import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import {
    STATUS_INFO,
    orderAge,
    typeInfo,
    type Order,
    type OrderStatus,
} from '@/modules/orders/orders-api';

const ACTIVE: OrderStatus[] = ['pending', 'confirmed', 'preparing'];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: 'preparing',
    confirmed: 'preparing',
    preparing: 'ready',
};
const KEY = ['orders'] as const;

/** Vollbild-Küchen-Display (ersetzt cms/kitchen.html). */
export function KitchenPage() {
    const qc = useQueryClient();
    const [connected, setConnected] = React.useState(false);
    const [clock, setClock] = React.useState('');

    const { data: orders = [] } = useQuery({
        queryKey: KEY,
        queryFn: async () => (await apiGet<Order[]>('orders')) || [],
    });

    React.useEffect(() => {
        const t = setInterval(() => setClock(new Date().toLocaleTimeString('de-DE')), 1000);
        return () => clearInterval(t);
    }, []);

    React.useEffect(() => {
        const socket = getSocket();
        setConnected(socket.connected);
        const onC = () => setConnected(true);
        const onD = () => setConnected(false);
        const onNew = (o: Order) => qc.setQueryData<Order[]>(KEY, (p = []) => [o, ...p]);
        const onUpd = (u: Partial<Order> & { id: string }) =>
            qc.setQueryData<Order[]>(KEY, (p = []) =>
                p.map((o) => (o.id === u.id ? { ...o, ...u } : o))
            );
        socket.on('connect', onC);
        socket.on('disconnect', onD);
        socket.on('new_order', onNew);
        socket.on('order-updated', onUpd);
        return () => {
            socket.off('connect', onC);
            socket.off('disconnect', onD);
            socket.off('new_order', onNew);
            socket.off('order-updated', onUpd);
        };
    }, [qc]);

    async function advance(o: Order) {
        const next = NEXT[o.status];
        if (!next) return;
        await apiPut(`orders/${o.id}/status`, { status: next });
        qc.setQueryData<Order[]>(KEY, (p = []) =>
            p.map((x) => (x.id === o.id ? { ...x, status: next } : x))
        );
    }

    const open = orders.filter((o) => ACTIVE.includes(o.status));
    const doneToday = orders.filter((o) => o.status === 'ready' || o.status === 'completed').length;

    return (
        <div className="flex h-svh flex-col bg-slate-950 text-white">
            <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <h1 className="text-xl font-extrabold">🍳 Küchen-Display</h1>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                'inline-block size-3 rounded-full',
                                connected ? 'bg-green-500' : 'bg-red-500'
                            )}
                        />
                        <span className="text-sm font-bold uppercase">
                            {connected ? 'Live' : 'Getrennt'}
                        </span>
                    </div>
                    <div className="font-mono text-2xl tabular-nums">{clock}</div>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6">
                {open.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-white/30">
                        <i className="fas fa-concierge-bell mb-4 text-5xl" />
                        <p className="text-lg">Keine offenen Bestellungen</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {open.map((o) => {
                            const ti = typeInfo(o);
                            const si = STATUS_INFO[o.status];
                            const { timeStr } = orderAge(o);
                            return (
                                <div
                                    key={o.id}
                                    className="flex flex-col rounded-xl bg-slate-800 shadow-lg"
                                >
                                    <div
                                        className="flex items-center justify-between rounded-t-xl px-4 py-2.5 font-bold"
                                        style={{ background: ti.color }}
                                    >
                                        <span>{ti.label}</span>
                                        <span className="text-sm">{timeStr}</span>
                                    </div>
                                    <ul className="flex-1 space-y-1.5 p-4 text-sm">
                                        {o.items.map((i, idx) => (
                                            <li key={idx} className="flex gap-2">
                                                <span className="font-bold text-amber-400">
                                                    ×{i.quantity}
                                                </span>
                                                <span>
                                                    {i.name}
                                                    {i.note && (
                                                        <em className="block text-xs text-amber-300">
                                                            📝 {i.note}
                                                        </em>
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        onClick={() => advance(o)}
                                        className="rounded-b-xl py-3 text-sm font-bold uppercase tracking-wide"
                                        style={{ background: si.color }}
                                    >
                                        {o.status === 'preparing' ? '✅ Fertig' : '🍳 Zubereiten'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <footer className="flex justify-center gap-12 border-t border-white/10 px-6 py-3 text-center">
                <div>
                    <div className="text-2xl font-extrabold">{open.length}</div>
                    <div className="text-xs uppercase text-white/50">Offen</div>
                </div>
                <div>
                    <div className="text-2xl font-extrabold text-green-400">{doneToday}</div>
                    <div className="text-xs uppercase text-white/50">Fertig</div>
                </div>
            </footer>
        </div>
    );
}
