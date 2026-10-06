import * as React from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { useViewTitle } from '@/hooks/useViewTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface QrItem {
    table: number;
    dataUrl: string;
}

export function QrCodesPage() {
    useViewTitle('QR-Codes');
    const [count, setCount] = React.useState(10);
    const [baseUrl, setBaseUrl] = React.useState(`${window.location.origin}/#menu`);
    const [items, setItems] = React.useState<QrItem[]>([]);

    async function generate() {
        const out: QrItem[] = [];
        for (let t = 1; t <= count; t++) {
            const url = `${baseUrl}?table=${t}`;
            const dataUrl = await QRCode.toDataURL(url, {
                width: 280,
                margin: 1,
                color: { dark: '#1B3A5C', light: '#ffffff' },
            });
            out.push({ table: t, dataUrl });
        }
        setItems(out);
    }

    function download(item: QrItem) {
        const a = document.createElement('a');
        a.download = `Tisch_${item.table}.png`;
        a.href = item.dataUrl;
        a.click();
    }

    return (
        <div className="space-y-5">
            <Card>
                <CardContent className="space-y-4 pt-6">
                    <h3 className="font-semibold">QR-Code Generator</h3>
                    <p className="text-sm text-muted-foreground">
                        QR-Codes pro Tisch erzeugen. Gäste scannen und landen direkt auf der
                        Speisekarte.
                    </p>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-1">
                            <Label>Anzahl Tische</Label>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={count}
                                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                                className="w-24"
                            />
                        </div>
                        <div className="min-w-64 flex-1 space-y-1">
                            <Label>Basis-URL</Label>
                            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                        </div>
                        <Button onClick={generate}>QR-Codes generieren</Button>
                        {items.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    items.forEach((it, i) =>
                                        setTimeout(() => download(it), i * 150)
                                    )
                                }
                            >
                                <Download /> Alle laden
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {items.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                    {items.map((it) => (
                        <Card key={it.table} className="p-4 text-center">
                            <img
                                src={it.dataUrl}
                                alt={`Tisch ${it.table}`}
                                className="mx-auto w-full"
                            />
                            <div className="my-2 font-bold">Tisch {it.table}</div>
                            <Button size="sm" variant="outline" onClick={() => download(it)}>
                                <Download /> PNG
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
