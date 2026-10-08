import * as React from 'react';
import { toast } from 'sonner';
import { KeyRound, Pencil, Plus, ShieldOff, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPost, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { USERS_KEY, type User } from './settings-api';
import { TwoFactorCard } from './TwoFactorCard';

export function UsersTab({ users }: { users: User[] }) {
    const qc = useQueryClient();
    const refresh = () => qc.invalidateQueries({ queryKey: USERS_KEY });
    const [editing, setEditing] = React.useState<User | null>(null);
    const [open, setOpen] = React.useState(false);

    async function remove(u: User) {
        if (!window.confirm(`Zugang für „${u.user}" wirklich entfernen?`)) return;
        const res = await apiDelete(`users/${u.user}`);
        if (res.success !== false) {
            toast.success('Nutzer gelöscht');
            refresh();
        } else toast.error(res.reason || 'Fehler beim Löschen');
    }

    async function resetPw(u: User) {
        if (
            !window.confirm(
                `Dem Nutzer „${u.user}" wird ein neues Passwort generiert und per E-Mail gesendet.`
            )
        )
            return;
        const res = await apiPost(`users/${u.user}/reset`, {});
        if (res.success !== false) toast.success('Passwort zurückgesetzt & E-Mail gesendet!');
        else toast.error(res.reason || 'Senden fehlgeschlagen');
    }

    async function reset2fa(u: User) {
        if (!window.confirm(`Zwei-Faktor-Anmeldung von „${u.user}" zurücksetzen?`)) return;
        const res = await apiDelete(`admin/2fa/${u.user}`);
        if (res.success !== false) toast.success('2FA zurückgesetzt');
        else toast.error(res.reason || 'Fehler');
    }

    return (
        <div className="space-y-4">
            <TwoFactorCard />
            <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold">Nutzerverwaltung</h4>
                <Button
                    onClick={() => {
                        setEditing(null);
                        setOpen(true);
                    }}
                >
                    <Plus /> Neuer Nutzer
                </Button>
            </div>

            <Card className="overflow-hidden p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Benutzername</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>E-Mail</TableHead>
                            <TableHead>Rolle</TableHead>
                            <TableHead className="text-right">Aktion</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((u) => (
                            <TableRow key={u.user}>
                                <TableCell className="font-bold">{u.user}</TableCell>
                                <TableCell>
                                    {[u.name, u.last_name].filter(Boolean).join(' ') || '-'}
                                </TableCell>
                                <TableCell>{u.email || '-'}</TableCell>
                                <TableCell>{u.role}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            title="Bearbeiten"
                                            onClick={() => {
                                                setEditing(u);
                                                setOpen(true);
                                            }}
                                        >
                                            <Pencil />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            title="Passwort zurücksetzen"
                                            onClick={() => resetPw(u)}
                                        >
                                            <KeyRound />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            title="2FA zurücksetzen"
                                            onClick={() => reset2fa(u)}
                                        >
                                            <ShieldOff />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="text-destructive"
                                            title="Löschen"
                                            onClick={() => remove(u)}
                                        >
                                            <Trash2 />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <p className="text-sm text-muted-foreground">
                Hinweis: Neue Nutzer erhalten ihr Passwort per E-Mail und müssen es beim ersten
                Login ändern.
            </p>

            <UserFormDialog open={open} onOpenChange={setOpen} user={editing} onSaved={refresh} />
        </div>
    );
}

function UserFormDialog({
    open,
    onOpenChange,
    user,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    user: User | null;
    onSaved: () => void;
}) {
    const isNew = !user;
    const [f, setF] = React.useState<User>(
        user ?? { user: '', name: '', last_name: '', email: '', role: 'admin' }
    );
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (open) setF(user ?? { user: '', name: '', last_name: '', email: '', role: 'admin' });
    }, [open, user]);

    const set = <K extends keyof User>(k: K, v: User[K]) => setF((s) => ({ ...s, [k]: v }));

    async function save() {
        if (!f.user || !f.name || !f.email) {
            toast.error('Benutzername, Vorname und E-Mail sind erforderlich.');
            return;
        }
        setSaving(true);
        const payload = {
            user: f.user,
            name: f.name,
            last_name: f.last_name,
            email: f.email,
            role: f.role,
        };
        const res = isNew
            ? await apiPost('users', payload)
            : await apiPut(`users/${user!.user}`, payload);
        setSaving(false);
        if (res.success !== false) {
            toast.success(isNew ? 'Nutzer angelegt & E-Mail gesendet!' : 'Nutzer aktualisiert!');
            onOpenChange(false);
            onSaved();
        } else toast.error(res.reason || 'Fehler beim Speichern');
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isNew ? 'Neuer Nutzer' : 'Nutzer bearbeiten'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    {isNew && (
                        <div className="space-y-1">
                            <Label>Benutzername</Label>
                            <Input value={f.user} onChange={(e) => set('user', e.target.value)} />
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Vorname</Label>
                            <Input
                                value={f.name || ''}
                                onChange={(e) => set('name', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Nachname</Label>
                            <Input
                                value={f.last_name || ''}
                                onChange={(e) => set('last_name', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label>E-Mail-Adresse</Label>
                        <Input
                            type="email"
                            value={f.email || ''}
                            onChange={(e) => set('email', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Rolle</Label>
                        <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                            value={f.role}
                            onChange={(e) => set('role', e.target.value)}
                        >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                        </select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>
                    <Button onClick={save} disabled={saving}>
                        {saving ? 'Speichern…' : 'Speichern'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
