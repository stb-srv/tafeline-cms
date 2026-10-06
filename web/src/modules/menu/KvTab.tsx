import * as React from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { MENU_QUERY_KEY, type KvMap } from './menu-api';

/** Editor für allergens / additives (Port von renderKVTab). */
export function KvTab({ kind, data }: { kind: 'allergens' | 'additives'; data: KvMap }) {
    const qc = useQueryClient();
    const refresh = () => qc.invalidateQueries({ queryKey: MENU_QUERY_KEY });
    const [code, setCode] = React.useState('');
    const [name, setName] = React.useState('');

    const title = kind === 'allergens' ? 'Allergene' : 'Zusatzstoffe';
    const helpText =
        kind === 'allergens'
            ? 'Pflichtangabe gemäß EU-Lebensmittelinformationsverordnung (LMIV). Vergib ein kurzes Kürzel (z.B. gluten) und einen lesbaren Namen (z.B. Gluten).'
            : 'Kennzeichnungspflichtige Zusatzstoffe (z.B. E-Nummern). Vergib ein Kürzel (z.B. e120) und die Bezeichnung.';
    const placeholder = kind === 'allergens' ? 'Name des Allergens…' : 'Name des Zusatzstoffes…';

    const entries = Object.entries(data);

    async function add() {
        if (!code.trim() || !name.trim()) {
            toast.error('Code und Name nötig');
            return;
        }
        const next = { ...data, [code.trim()]: name.trim() };
        const res = await apiPost(kind, next);
        if (res.success !== false) {
            setCode('');
            setName('');
            refresh();
        } else toast.error(res.reason || 'Fehler');
    }

    async function remove(c: string) {
        if (!window.confirm('Eintrag wirklich löschen?')) return;
        const next = { ...data };
        delete next[c];
        const res = await apiPost(kind, next);
        if (res.success !== false) refresh();
        else toast.error(res.reason || 'Fehler');
    }

    return (
        <Card className="max-w-3xl">
            <CardContent className="space-y-6 pt-6">
                <div>
                    <h3 className="text-lg font-semibold">{title} verwalten</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{helpText}</p>
                </div>

                <div className="flex items-center gap-2.5">
                    <Input
                        className="w-32"
                        placeholder="Kürzel"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                    <Input
                        className="flex-1"
                        placeholder={placeholder}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && add()}
                    />
                    <Button onClick={add}>
                        <Plus /> Hinzufügen
                    </Button>
                </div>

                {entries.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 p-10 text-center text-sm text-muted-foreground">
                        Noch keine {title} angelegt.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-36">Kürzel</TableHead>
                                <TableHead>Bezeichnung</TableHead>
                                <TableHead className="w-20 text-right">Aktion</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map(([c, n]) => (
                                <TableRow key={c}>
                                    <TableCell>
                                        <code className="rounded bg-muted px-2 py-0.5 text-xs">
                                            {c}
                                        </code>
                                    </TableCell>
                                    <TableCell>{n}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => remove(c)}
                                        >
                                            <Trash2 />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
