import * as React from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { useViewTitle } from '@/hooks/useViewTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DayHours {
    open: string;
    close: string;
    closed: boolean;
}
type OpeningHours = Record<string, DayHours>;

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const LABELS: Record<string, string> = {
    Mo: 'Montag',
    Di: 'Dienstag',
    Mi: 'Mittwoch',
    Do: 'Donnerstag',
    Fr: 'Freitag',
    Sa: 'Samstag',
    So: 'Sonntag',
};

export function OpeningPage() {
    useViewTitle('Öffnungszeiten');
    const { data: home } = useQuery({
        queryKey: ['homepage'],
        queryFn: () => apiGet<{ openingHours?: OpeningHours; [k: string]: unknown }>('homepage'),
    });

    const [oh, setOh] = React.useState<OpeningHours>({});
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (home) {
            const base: OpeningHours = {};
            for (const d of DAYS)
                base[d] = home.openingHours?.[d] || {
                    open: '12:00',
                    close: '22:00',
                    closed: false,
                };
            setOh(base);
        }
    }, [home]);

    const setDay = (d: string, patch: Partial<DayHours>) =>
        setOh((s) => ({ ...s, [d]: { ...s[d], ...patch } }));

    async function save() {
        setSaving(true);
        const res = await apiPost('homepage', { ...(home || {}), openingHours: oh });
        setSaving(false);
        if (res.success !== false) toast.success('Öffnungszeiten gespeichert!');
        else toast.error(res.reason || 'Fehler');
    }

    return (
        <div className="space-y-5">
            <div>
                <h3 className="font-semibold">Reguläre Öffnungszeiten</h3>
                <p className="text-sm text-muted-foreground">
                    Tägliche Geschäftszeiten bearbeiten.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {DAYS.map((d) => {
                    const day = oh[d] || { open: '12:00', close: '22:00', closed: false };
                    return (
                        <Card key={d}>
                            <CardContent className="pt-6">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="font-medium">{LABELS[d]}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                            {day.closed ? 'Geschlossen' : 'Geöffnet'}
                                        </span>
                                        <Switch
                                            checked={day.closed}
                                            onCheckedChange={(c) => setDay(d, { closed: c })}
                                            aria-label="Geschlossen"
                                        />
                                    </div>
                                </div>
                                <div
                                    className={cn(
                                        'flex items-center gap-2',
                                        day.closed && 'pointer-events-none opacity-30'
                                    )}
                                >
                                    <Input
                                        type="time"
                                        value={day.open}
                                        onChange={(e) => setDay(d, { open: e.target.value })}
                                    />
                                    <span>-</span>
                                    <Input
                                        type="time"
                                        value={day.close}
                                        onChange={(e) => setDay(d, { close: e.target.value })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>
                    {saving ? 'Speichern…' : 'Öffnungszeiten speichern'}
                </Button>
            </div>
        </div>
    );
}
