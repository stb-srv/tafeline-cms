import * as React from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface CookieRow {
    name: string;
    purpose: string;
    duration: string;
    provider: string;
}
interface Category {
    id: string;
    label: string;
    description: string;
    required: boolean;
    enabled: boolean;
    cookies: CookieRow[];
}
interface CookieConfig {
    version: string;
    privacy_url: string;
    banner_text: string;
    categories: Record<string, Category>;
}
interface LogEntry {
    id: string;
    timestamp: string;
    config_version: string;
    ip_hash: string;
    choices: Record<string, boolean>;
    source: string;
}

export function CookiesTab() {
    const qc = useQueryClient();
    const { data } = useQuery({
        queryKey: ['cookie-config-admin'],
        queryFn: () => apiGet<CookieConfig>('cookie-config/admin'),
    });
    const [cfg, setCfg] = React.useState<CookieConfig | null>(null);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (data) setCfg(structuredClone(data));
    }, [data]);

    if (!cfg) return <div className="py-10 text-center text-muted-foreground">Lädt…</div>;

    function patch(p: Partial<CookieConfig>) {
        setCfg((c) => (c ? { ...c, ...p } : c));
    }
    function patchCat(id: string, p: Partial<Category>) {
        setCfg((c) =>
            c ? { ...c, categories: { ...c.categories, [id]: { ...c.categories[id], ...p } } } : c
        );
    }
    function patchCookie(catId: string, idx: number, p: Partial<CookieRow>) {
        setCfg((c) => {
            if (!c) return c;
            const cookies = c.categories[catId].cookies.map((ck, i) =>
                i === idx ? { ...ck, ...p } : ck
            );
            return {
                ...c,
                categories: { ...c.categories, [catId]: { ...c.categories[catId], cookies } },
            };
        });
    }
    function addCookie(catId: string) {
        setCfg((c) => {
            if (!c) return c;
            const cookies = [
                ...c.categories[catId].cookies,
                { name: '', purpose: '', duration: '', provider: '' },
            ];
            return {
                ...c,
                categories: { ...c.categories, [catId]: { ...c.categories[catId], cookies } },
            };
        });
    }
    function removeCookie(catId: string, idx: number) {
        setCfg((c) => {
            if (!c) return c;
            const cookies = c.categories[catId].cookies.filter((_, i) => i !== idx);
            return {
                ...c,
                categories: { ...c.categories, [catId]: { ...c.categories[catId], cookies } },
            };
        });
    }

    async function save() {
        if (!cfg) return;
        setSaving(true);
        const res = await apiPost('cookie-config/admin', cfg);
        setSaving(false);
        if (res.success) {
            toast.success('Cookie-Konfiguration gespeichert.');
            qc.invalidateQueries({ queryKey: ['cookie-config-admin'] });
        } else toast.error(res.reason || 'Speichern fehlgeschlagen.');
    }

    async function reconsent() {
        const res = await apiPost<{ success?: boolean; new_version?: string; reason?: string }>(
            'cookie-consent/recons',
            {}
        );
        if (res.success) {
            toast.success(`Re-Consent ausgelöst – neue Version ${res.new_version}.`);
            qc.invalidateQueries({ queryKey: ['cookie-config-admin'] });
        } else toast.error(res.reason || 'Fehlgeschlagen.');
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                    Banner-Version: <span className="font-mono">{cfg.version}</span>
                </div>
                <Button variant="outline" size="sm" onClick={reconsent}>
                    <RefreshCw /> Erneute Einwilligung anfordern
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                    <Label>Link zur Datenschutzerklärung</Label>
                    <Input
                        value={cfg.privacy_url}
                        onChange={(e) => patch({ privacy_url: e.target.value })}
                    />
                </div>
            </div>
            <div className="space-y-1">
                <Label>Banner-Text</Label>
                <Textarea
                    className="h-28"
                    value={cfg.banner_text}
                    onChange={(e) => patch({ banner_text: e.target.value })}
                />
            </div>

            <div className="space-y-4">
                {Object.values(cfg.categories).map((cat) => (
                    <div key={cat.id} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-2">
                                <Input
                                    className="font-medium"
                                    value={cat.label}
                                    onChange={(e) => patchCat(cat.id, { label: e.target.value })}
                                />
                                <Textarea
                                    className="h-16 text-sm"
                                    value={cat.description}
                                    onChange={(e) =>
                                        patchCat(cat.id, { description: e.target.value })
                                    }
                                />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <Switch
                                    checked={cat.required ? true : cat.enabled}
                                    disabled={cat.required}
                                    onCheckedChange={(v) => patchCat(cat.id, { enabled: v })}
                                />
                                <span className="text-xs text-muted-foreground">
                                    {cat.required ? 'Pflicht' : cat.enabled ? 'Aktiv' : 'Aus'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-3 space-y-2">
                            {cat.cookies.map((ck, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
                                >
                                    <Input
                                        placeholder="Name"
                                        value={ck.name}
                                        onChange={(e) =>
                                            patchCookie(cat.id, i, { name: e.target.value })
                                        }
                                    />
                                    <Input
                                        placeholder="Zweck"
                                        value={ck.purpose}
                                        onChange={(e) =>
                                            patchCookie(cat.id, i, { purpose: e.target.value })
                                        }
                                    />
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Dauer"
                                            value={ck.duration}
                                            onChange={(e) =>
                                                patchCookie(cat.id, i, { duration: e.target.value })
                                            }
                                        />
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="shrink-0 text-destructive"
                                            onClick={() => removeCookie(cat.id, i)}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                    <Input
                                        className="sm:col-span-3"
                                        placeholder="Anbieter"
                                        value={ck.provider}
                                        onChange={(e) =>
                                            patchCookie(cat.id, i, { provider: e.target.value })
                                        }
                                    />
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addCookie(cat.id)}>
                                <Plus /> Cookie hinzufügen
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>
                    {saving ? 'Speichern…' : 'Cookie-Konfiguration speichern'}
                </Button>
            </div>

            <ConsentLog />
        </div>
    );
}

function ConsentLog() {
    const qc = useQueryClient();
    const [page, setPage] = React.useState(1);
    const limit = 25;
    const { data } = useQuery({
        queryKey: ['consent-log', page],
        queryFn: () =>
            apiGet<{ total: number; entries: LogEntry[] }>(
                `cookie-consent/log?page=${page}&limit=${limit}`
            ),
    });

    async function clear() {
        if (!window.confirm('Gesamtes Consent-Log unwiderruflich löschen?')) return;
        const res = await apiDelete('cookie-consent/log');
        if (res.success) {
            toast.success('Consent-Log geleert.');
            qc.invalidateQueries({ queryKey: ['consent-log'] });
        } else toast.error(res.reason || 'Fehlgeschlagen.');
    }

    const entries = data?.entries || [];
    const total = data?.total || 0;
    const pages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="space-y-3 border-t pt-6">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">Einwilligungs-Nachweis ({total})</h3>
                {total > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={clear}
                    >
                        <Trash2 /> Log leeren
                    </Button>
                )}
            </div>
            {entries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                    Noch keine Einwilligungen erfasst.
                </p>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Zeitpunkt</TableHead>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Quelle</TableHead>
                                    <TableHead>Auswahl</TableHead>
                                    <TableHead>IP (Hash)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map((e) => (
                                    <TableRow key={e.id}>
                                        <TableCell className="whitespace-nowrap">
                                            {new Date(e.timestamp).toLocaleString('de-DE')}
                                        </TableCell>
                                        <TableCell className="font-mono">
                                            {e.config_version}
                                        </TableCell>
                                        <TableCell>{e.source}</TableCell>
                                        <TableCell className="text-xs">
                                            {Object.entries(e.choices)
                                                .map(([k, v]) => `${k}:${v ? '✓' : '✗'}`)
                                                .join('  ')}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {e.ip_hash}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {pages > 1 && (
                        <div className="flex items-center justify-center gap-3 text-sm">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                Zurück
                            </Button>
                            <span className="text-muted-foreground">
                                Seite {page} / {pages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= pages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Weiter
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
