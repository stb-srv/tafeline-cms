import * as React from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Reservation, ResTable } from './reservations-api';

export function EditReservationDialog({
    reservation,
    onClose,
    onSaved,
}: {
    reservation: Reservation | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [f, setF] = React.useState<Reservation>(reservation || ({} as Reservation));
    React.useEffect(() => setF(reservation || ({} as Reservation)), [reservation]);
    if (!reservation) return null;
    const set = <K extends keyof Reservation>(k: K, v: Reservation[K]) =>
        setF((s) => ({ ...s, [k]: v }));

    async function save() {
        const res = await apiPut(`reservations/${reservation!.id}`, {
            name: f.name,
            guests: Number(f.guests) || 0,
            date: f.date,
            start_time: f.start_time,
            email: f.email,
            note: f.note,
        });
        if (res.success !== false) {
            toast.success('Änderungen gespeichert.');
            onSaved();
            onClose();
        } else toast.error(res.reason || 'Fehler');
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reservierung bearbeiten</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Name">
                        <Input value={f.name || ''} onChange={(e) => set('name', e.target.value)} />
                    </Field>
                    <Field label="Personen">
                        <Input
                            type="number"
                            value={f.guests ?? ''}
                            onChange={(e) => set('guests', Number(e.target.value))}
                        />
                    </Field>
                    <Field label="Datum (TT.MM.JJJJ)">
                        <Input value={f.date || ''} onChange={(e) => set('date', e.target.value)} />
                    </Field>
                    <Field label="Uhrzeit">
                        <Input
                            value={f.start_time || ''}
                            onChange={(e) => set('start_time', e.target.value)}
                        />
                    </Field>
                    <Field label="E-Mail" full>
                        <Input
                            type="email"
                            value={f.email || ''}
                            onChange={(e) => set('email', e.target.value)}
                        />
                    </Field>
                    <Field label="Notizen" full>
                        <Textarea
                            className="h-24"
                            value={f.note || ''}
                            onChange={(e) => set('note', e.target.value)}
                        />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button onClick={save}>Speichern</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ManualReservationDialog({
    open,
    onClose,
    onSaved,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const empty = {
        name: '',
        email: '',
        phone: '',
        guests: 2,
        time: '18:00',
        date: new Date().toISOString().split('T')[0],
        note: '',
    };
    const [f, setF] = React.useState(empty);
    React.useEffect(() => {
        if (open) setF(empty);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    const set = (k: keyof typeof empty, v: string | number) => setF((s) => ({ ...s, [k]: v }));

    async function save() {
        if (!f.name) {
            toast.error('Bitte Namen eingeben');
            return;
        }
        const date = f.date.split('-').reverse().join('.');
        const res = await apiPost('reservations/submit', { ...f, date, status: 'Confirmed' });
        if (res.success !== false) {
            toast.success('Manuelle Reservierung angelegt.');
            onSaved();
            onClose();
        } else toast.error(res.reason || 'Fehler beim Anlegen');
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manuelle Reservierung</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Gast Name" full>
                        <Input value={f.name} onChange={(e) => set('name', e.target.value)} />
                    </Field>
                    <Field label="E-Mail">
                        <Input value={f.email} onChange={(e) => set('email', e.target.value)} />
                    </Field>
                    <Field label="Telefon">
                        <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} />
                    </Field>
                    <Field label="Personen">
                        <Input
                            type="number"
                            value={f.guests}
                            onChange={(e) => set('guests', Number(e.target.value))}
                        />
                    </Field>
                    <Field label="Uhrzeit">
                        <Input
                            type="time"
                            value={f.time}
                            onChange={(e) => set('time', e.target.value)}
                        />
                    </Field>
                    <Field label="Datum" full>
                        <Input
                            type="date"
                            value={f.date}
                            onChange={(e) => set('date', e.target.value)}
                        />
                    </Field>
                    <Field label="Notiz (intern)" full>
                        <Textarea
                            className="h-20"
                            value={f.note}
                            onChange={(e) => set('note', e.target.value)}
                        />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button onClick={save}>Reservierung anlegen</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function AssignTableDialog({
    reservation,
    onClose,
    onSaved,
}: {
    reservation: Reservation | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [tables, setTables] = React.useState<ResTable[]>([]);
    const [available, setAvailable] = React.useState<string[]>([]);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        if (!reservation) return;
        setSelected(new Set(reservation.assigned_tables || []));
        apiGet<ResTable[]>('tables').then((t) => setTables(t || []));
        apiPost<{ success?: boolean; tables?: string[] }>('reservations/check', {
            date: reservation.date,
            time: reservation.start_time,
            guests: reservation.guests,
        }).then((c) => setAvailable(c.tables || []));
    }, [reservation]);

    if (!reservation) return null;

    function toggle(id: string) {
        setSelected((s) => {
            const next = new Set(s);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    async function save() {
        const res = await apiPut(`reservations/${reservation!.id}`, {
            assigned_tables: Array.from(selected),
        });
        if (res.success !== false) {
            toast.success('Tische zugewiesen.');
            onSaved();
            onClose();
        } else toast.error(res.reason || 'Fehler');
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tischzuweisung</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    {reservation.name} · {reservation.date} {reservation.start_time} ·{' '}
                    {reservation.guests} Gäste
                </p>
                <div className="grid max-h-80 grid-cols-2 gap-2.5 overflow-y-auto">
                    {tables.map((t) => {
                        const isAssigned = selected.has(t.id);
                        const isAvail = available.includes(t.id);
                        const label = t.id.startsWith('C') ? 'Combo ' + t.name : 'Tisch ' + t.name;
                        return (
                            <button
                                key={t.id}
                                onClick={() => toggle(t.id)}
                                className={cn(
                                    'flex items-center justify-between rounded-xl border p-3 text-left',
                                    isAssigned ? 'border-primary bg-primary/10' : 'border-border',
                                    !isAvail && !isAssigned && 'opacity-40'
                                )}
                            >
                                <div>
                                    <div className="font-bold">{label}</div>
                                    <div className="text-xs opacity-70">
                                        Kapazität: {t.capacity}
                                    </div>
                                </div>
                                {isAssigned && <i className="fas fa-check-circle text-primary" />}
                            </button>
                        );
                    })}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button onClick={save}>Speichern</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Field({
    label,
    children,
    full,
}: {
    label: string;
    children: React.ReactNode;
    full?: boolean;
}) {
    return (
        <div className={cn('space-y-1', full && 'col-span-2')}>
            <Label>{label}</Label>
            {children}
        </div>
    );
}
