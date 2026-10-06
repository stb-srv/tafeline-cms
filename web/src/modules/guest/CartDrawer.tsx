import * as React from 'react';
import { AlertTriangle, Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCart } from './cart-store';
import { submitOrder, useCartConfig, type OrderPayload } from './guest-api';

type Mode = 'dine_in' | 'pickup' | 'delivery';

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { items, setQty, remove, clear, total } = useCart();
    const { data: config } = useCartConfig();
    const [checkout, setCheckout] = React.useState(false);

    const modes: { id: Mode; label: string }[] = [];
    if (config?.dineInEnabled !== false) modes.push({ id: 'dine_in', label: 'Am Tisch' });
    if (config?.pickupEnabled) modes.push({ id: 'pickup', label: 'Abholung' });
    if (config?.deliveryEnabled) modes.push({ id: 'delivery', label: 'Lieferung' });

    return (
        <>
            <div
                className={cn(
                    'fixed inset-0 z-50 bg-black/50 transition-opacity',
                    open ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
                onClick={onClose}
            />
            <aside
                className={cn(
                    'fixed right-0 top-0 z-50 flex h-svh w-full max-w-md flex-col bg-background shadow-2xl transition-transform',
                    open ? 'translate-x-0' : 'translate-x-full'
                )}
            >
                <header className="flex items-center justify-between border-b p-4">
                    <h2 className="flex items-center gap-2 font-guest-display text-xl font-bold">
                        <ShoppingCart className="size-5" /> Warenkorb
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X />
                    </Button>
                </header>

                {config && modes.length === 0 && (
                    <div className="m-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <span>
                            Bestellungen über die Website (Lieferung, Abholung &amp; Bestellung am
                            Tisch) sind derzeit deaktiviert. Bitte bestellen Sie direkt vor Ort oder
                            telefonisch.
                        </span>
                    </div>
                )}

                {items.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                        <ShoppingCart className="mb-3 size-10 opacity-30" />
                        <p>Dein Warenkorb ist leer.</p>
                    </div>
                ) : (
                    <div className="flex-1 space-y-3 overflow-auto p-4">
                        {items.map((i) => (
                            <div
                                key={i.id}
                                className="flex items-center gap-3 rounded-lg border p-3"
                            >
                                <div className="flex-1">
                                    <div className="font-medium">{i.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {i.price.toFixed(2)} €
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="size-7"
                                        onClick={() => setQty(i.id, i.quantity - 1)}
                                    >
                                        <Minus className="size-3" />
                                    </Button>
                                    <span className="w-6 text-center text-sm font-bold">
                                        {i.quantity}
                                    </span>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="size-7"
                                        onClick={() => setQty(i.id, i.quantity + 1)}
                                    >
                                        <Plus className="size-3" />
                                    </Button>
                                </div>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => remove(i.id)}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {items.length > 0 && (
                    <footer className="space-y-3 border-t p-4">
                        <div className="flex items-center justify-between text-lg font-bold">
                            <span>Gesamt</span>
                            <span className="text-primary">{total().toFixed(2)} €</span>
                        </div>
                        {!checkout ? (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={clear}>
                                    Leeren
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => setCheckout(true)}
                                    disabled={modes.length === 0}
                                >
                                    Zur Kasse
                                </Button>
                            </div>
                        ) : (
                            <Checkout
                                modes={modes}
                                onDone={() => {
                                    setCheckout(false);
                                    onClose();
                                }}
                            />
                        )}
                    </footer>
                )}
            </aside>
        </>
    );
}

function Checkout({ modes, onDone }: { modes: { id: Mode; label: string }[]; onDone: () => void }) {
    const { items, total, clear } = useCart();
    const [mode, setMode] = React.useState<Mode>(modes[0]?.id || 'dine_in');
    const [f, setF] = React.useState({
        name: '',
        phone: '',
        email: '',
        table: '',
        time: '',
        address: '',
        note: '',
    });
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

    async function submit() {
        setError('');
        if (mode === 'dine_in' && !f.table) return setError('Bitte Tischnummer angeben.');
        if (mode !== 'dine_in' && (!f.name || !f.phone))
            return setError('Name und Telefon erforderlich.');
        setBusy(true);
        const payload: OrderPayload = {
            type: mode,
            items: items.map((i) => ({
                id: i.id,
                name: i.name,
                price: i.price,
                quantity: i.quantity,
            })),
            total: total(),
            ...(mode === 'dine_in'
                ? { table: f.table }
                : {
                      customerName: f.name,
                      customerPhone: f.phone,
                      customerEmail: f.email,
                      pickupTime: f.time,
                      guestNote: f.note,
                      ...(mode === 'delivery' ? { deliveryAddress: f.address } : {}),
                  }),
        };
        const res = await submitOrder(payload);
        setBusy(false);
        if (res.success) {
            clear();
            if (res.orderToken) window.location.href = `/status?token=${res.orderToken}`;
            else onDone();
        } else setError(res.reason || 'Fehler beim Senden.');
    }

    return (
        <div className="space-y-3">
            <div className="flex gap-1.5">
                {modes.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={cn(
                            'flex-1 rounded-md border py-1.5 text-sm font-medium',
                            mode === m.id ? 'border-primary bg-primary text-primary-foreground' : ''
                        )}
                    >
                        {m.label}
                    </button>
                ))}
            </div>
            {mode === 'dine_in' ? (
                <Field label="Tischnummer">
                    <Input value={f.table} onChange={(e) => set('table', e.target.value)} />
                </Field>
            ) : (
                <>
                    <Field label="Name">
                        <Input value={f.name} onChange={(e) => set('name', e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Telefon">
                            <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} />
                        </Field>
                        <Field label="Uhrzeit">
                            <Input
                                value={f.time}
                                onChange={(e) => set('time', e.target.value)}
                                placeholder="z.B. 18:30"
                            />
                        </Field>
                    </div>
                    <Field label="E-Mail">
                        <Input value={f.email} onChange={(e) => set('email', e.target.value)} />
                    </Field>
                    {mode === 'delivery' && (
                        <Field label="Lieferadresse">
                            <Input
                                value={f.address}
                                onChange={(e) => set('address', e.target.value)}
                            />
                        </Field>
                    )}
                    <Field label="Anmerkung">
                        <Textarea
                            className="h-16"
                            value={f.note}
                            onChange={(e) => set('note', e.target.value)}
                        />
                    </Field>
                </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={submit} disabled={busy}>
                {busy ? 'Wird gesendet…' : 'Bestellung übermitteln'}
            </Button>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            {children}
        </div>
    );
}
