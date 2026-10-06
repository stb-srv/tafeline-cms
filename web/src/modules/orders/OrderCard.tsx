import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    STATUS_INFO,
    isExternal,
    isDone,
    nextActions,
    orderAge,
    typeInfo,
    type Order,
    type OrderStatus,
} from './orders-api';

export function OrderCard({
    order,
    onAction,
    onSaveEta,
}: {
    order: Order;
    onAction: (id: string, status: OrderStatus, eta?: string) => void;
    onSaveEta: (id: string, eta: string) => void;
}) {
    const ext = isExternal(order);
    const ti = typeInfo(order);
    const si = STATUS_INFO[order.status] || {
        label: order.status,
        color: '#6b7280',
        icon: 'fa-question',
    };
    const { timeStr, sub } = orderAge(order);
    const editableEta = ['confirmed', 'preparing'].includes(order.status) && ext;
    const [eta, setEta] = React.useState(order.estimatedTime || '');
    const actions = nextActions(order);

    return (
        <Card
            className={cn(
                'relative flex flex-col gap-0 overflow-hidden p-4',
                isDone(order) && 'opacity-70',
                order.status === 'pending' && ext && 'ring-2 ring-destructive/50'
            )}
        >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: si.color }} />

            {/* Header */}
            <div className="flex items-start justify-between gap-2 border-b pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold"
                        style={{
                            background: ti.color + '22',
                            color: ti.color,
                            borderColor: ti.color + '44',
                        }}
                    >
                        <i className={cn('fas', ti.icon)} /> {ti.label}
                    </span>
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                        style={{ background: si.color + '22', color: si.color }}
                    >
                        <i className={cn('fas', si.icon)} /> {si.label}
                    </span>
                </div>
                <div className="shrink-0 text-right">
                    <div className="text-sm font-extrabold">{timeStr}</div>
                    <div className="text-xs text-muted-foreground">{sub}</div>
                </div>
            </div>

            {/* Kunde (extern) */}
            {ext && (
                <div className="border-b py-2.5 text-sm">
                    <div className="mb-1.5 text-[0.65rem] font-extrabold uppercase tracking-widest text-muted-foreground">
                        Kunde
                    </div>
                    <div className="flex flex-col gap-0.5">
                        {order.customerName && (
                            <div>
                                👤 <strong>{order.customerName}</strong>
                            </div>
                        )}
                        {order.customerPhone && (
                            <div>
                                📞{' '}
                                <a href={`tel:${order.customerPhone}`} className="text-primary">
                                    {order.customerPhone}
                                </a>
                            </div>
                        )}
                        {order.customerEmail && (
                            <div className="text-muted-foreground">✉️ {order.customerEmail}</div>
                        )}
                        {order.type === 'delivery' && order.deliveryAddress && (
                            <div>📍 {order.deliveryAddress}</div>
                        )}
                        {order.type === 'pickup' && order.pickupTime && (
                            <div>
                                ⏰ Abholen um: <strong>{order.pickupTime}</strong>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Artikel */}
            <div className="py-2.5">
                <div className="mb-2 text-[0.65rem] font-extrabold uppercase tracking-widest text-muted-foreground">
                    Bestellung
                </div>
                {order.items.map((i, idx) => (
                    <div key={idx} className="mb-1.5">
                        <div className="flex flex-wrap items-baseline gap-1.5">
                            {i.number != null && (
                                <span className="min-w-5 text-xs font-extrabold text-primary/80">
                                    {i.number}.
                                </span>
                            )}
                            <span className="font-bold">{i.quantity}×</span>
                            <span className="font-bold">{i.name}</span>
                        </div>
                        {i.desc && (
                            <div className="ml-4 text-xs leading-snug text-muted-foreground">
                                {i.desc}
                            </div>
                        )}
                        {i.variant && (
                            <span className="ml-4 text-xs text-muted-foreground">
                                ({i.variant})
                            </span>
                        )}
                        {i.extras && i.extras.length > 0 && (
                            <div className="ml-4 text-xs text-muted-foreground">
                                + {i.extras.join(', ')}
                            </div>
                        )}
                        {i.note && (
                            <div className="ml-4 mt-0.5 text-xs font-bold text-primary">
                                📝 {i.note}
                            </div>
                        )}
                    </div>
                ))}
                {order.guestNote && (
                    <div className="mt-2.5 rounded-md border-l-4 border-yellow-400 bg-yellow-100 px-3 py-2.5 text-xs text-yellow-900">
                        <strong>Hinweis:</strong> {order.guestNote}
                    </div>
                )}
            </div>

            {/* Total */}
            {order.total != null && (
                <div className="border-t py-1.5 text-sm font-bold">
                    Gesamt:{' '}
                    <span className="text-primary">
                        {parseFloat(String(order.total)).toFixed(2)} €
                    </span>
                </div>
            )}

            {/* ETA */}
            {editableEta ? (
                <div className="flex flex-wrap items-center gap-2 py-2">
                    <label className="text-xs font-bold text-muted-foreground">
                        ⏱️ Voraussichtlich:
                    </label>
                    <Input
                        value={eta}
                        onChange={(e) => setEta(e.target.value)}
                        placeholder="z.B. 30 Min. / 18:45 Uhr"
                        className="h-8 min-w-32 flex-1 text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={() => onSaveEta(order.id, eta)}>
                        Speichern
                    </Button>
                </div>
            ) : (
                order.estimatedTime && (
                    <div className="py-1 text-xs text-muted-foreground">
                        ⏱️ {order.estimatedTime}
                    </div>
                )
            )}

            {/* Aktionen */}
            <div className="flex flex-wrap gap-2 border-t pt-2.5">
                {order.status === 'cancelled' && (
                    <span className="text-sm font-bold text-destructive">Abgelehnt</span>
                )}
                {order.status === 'completed' && (
                    <span className="text-sm font-bold text-muted-foreground">Abgeschlossen</span>
                )}
                {order.status === 'ready' && !ext && (
                    <span className="text-sm font-extrabold text-[#22c55e]">Fertig für Tisch</span>
                )}
                {actions.map((a) => (
                    <Button
                        key={a.status}
                        size="sm"
                        onClick={() => onAction(order.id, a.status, editableEta ? eta : undefined)}
                        style={a.color ? { background: a.color, borderColor: a.color } : undefined}
                    >
                        {a.label}
                    </Button>
                ))}
            </div>
        </Card>
    );
}
