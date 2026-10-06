import { toast } from 'sonner';
import { Star, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet } from '@/lib/api';
import { useViewTitle } from '@/hooks/useViewTitle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface Review {
    id: string | number;
    guest_name?: string;
    rating?: number;
    comment?: string;
    created_at?: string;
}

function Stars({ n }: { n: number }) {
    const r = Math.max(0, Math.min(5, Math.round(n) || 0));
    return (
        <span className="whitespace-nowrap text-yellow-400">
            {'★'.repeat(r) + '☆'.repeat(5 - r)}
        </span>
    );
}

export function FeedbackPage() {
    useViewTitle('Gäste-Bewertungen');
    const qc = useQueryClient();
    const { data: reviews = [] } = useQuery({
        queryKey: ['feedback'],
        queryFn: async () => (await apiGet<Review[]>('feedback')) || [],
    });

    const avg = reviews.length
        ? (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
        : '—';

    async function remove(id: string | number) {
        if (!window.confirm('Diese Bewertung unwiderruflich entfernen?')) return;
        const res = await apiDelete('feedback/' + id);
        if (res.success !== false) {
            toast.success('Bewertung gelöscht.');
            qc.invalidateQueries({ queryKey: ['feedback'] });
        } else toast.error(res.reason || 'Löschen fehlgeschlagen');
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="font-semibold">Gäste-Bewertungen</h3>
                    <p className="text-sm text-muted-foreground">
                        Bewertungen moderieren und unpassende Einträge entfernen.
                    </p>
                </div>
                <Badge className="gap-1.5 text-sm">
                    <Star className="size-3.5" /> {avg} / 5.0 · {reviews.length} Bewertungen
                </Badge>
            </div>
            <Card className="overflow-hidden p-0">
                {reviews.length === 0 ? (
                    <div className="p-16 text-center text-muted-foreground">
                        Noch keine Bewertungen erhalten.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Gast</TableHead>
                                <TableHead>Bewertung</TableHead>
                                <TableHead>Kommentar</TableHead>
                                <TableHead>Datum</TableHead>
                                <TableHead className="text-right">Aktion</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reviews.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="font-bold">
                                        {r.guest_name || 'Anonymer Gast'}
                                    </TableCell>
                                    <TableCell>
                                        <Stars n={Number(r.rating) || 0} />
                                    </TableCell>
                                    <TableCell className="opacity-80">
                                        {r.comment || <em className="opacity-40">—</em>}
                                    </TableCell>
                                    <TableCell className="text-xs opacity-60">
                                        {r.created_at
                                            ? new Date(r.created_at).toLocaleDateString('de-DE')
                                            : ''}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => remove(r.id)}
                                        >
                                            <Trash2 />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>
        </div>
    );
}
