import * as React from 'react';
import { toast } from 'sonner';
import { ExternalLink, FlaskConical, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SETTINGS_KEY, type ImageApiKeys, type SettingsData } from './settings-api';

// Hinweis: Verbindungstests, Puter-Login und der Stapel-Generator (ImageBatch)
// sind bewusst noch nicht portiert (Folge-TODO) – hier nur die Key-Verwaltung.
export function ImageAiTab({ settings }: { settings: SettingsData }) {
    const qc = useQueryClient();
    const keys = settings.imageApiKeys || {};
    const [provider, setProvider] = React.useState(keys.defaultProvider || 'none');
    const [unsplash, setUnsplash] = React.useState('');
    const [pexels, setPexels] = React.useState('');
    const [googleAi, setGoogleAi] = React.useState('');
    const [puter, setPuter] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [testing, setTesting] = React.useState(false);

    async function save() {
        setSaving(true);
        // Frische Settings holen, um bestehende (maskierte) Keys nicht zu überschreiben
        const current = (await apiGet<SettingsData>('settings')) || {};
        const existing = current.imageApiKeys || {};
        const newKeys: ImageApiKeys = {
            unsplashKey: unsplash.trim() || existing.unsplashKey || '',
            pexelsKey: pexels.trim() || existing.pexelsKey || '',
            googleAiKey: googleAi.trim() || existing.googleAiKey || '',
            puterToken: puter.trim() || existing.puterToken || '',
            defaultProvider: provider,
        };
        const res = await apiPost('settings', { imageApiKeys: newKeys });
        setSaving(false);
        if (res.success !== false) {
            toast.success('Bild-KI Einstellungen gespeichert! ✨');
            qc.invalidateQueries({ queryKey: SETTINGS_KEY });
        } else toast.error(res.reason || 'Fehler beim Speichern.');
    }

    async function testConnection() {
        setTesting(true);
        const res = await apiPost<{
            success?: boolean;
            results?: Record<string, string>;
            reason?: string;
        }>('image-ai/test', {});
        setTesting(false);
        if (res.success !== false && res.results) {
            const r = res.results;
            const lines = [
                r.unsplash && `Unsplash: ${r.unsplash}`,
                r.pexels && `Pexels: ${r.pexels}`,
                r.googleAi && `Google AI: ${r.googleAi}`,
            ].filter(Boolean);
            const allOk = Object.values(r).every((v) => v === 'ok' || v.startsWith('Kein API'));
            if (allOk) toast.success(lines.join(' · '));
            else toast.error(lines.join('\n'));
        } else {
            toast.error(res.reason || 'Test fehlgeschlagen.');
        }
    }

    const keyField = (
        label: string,
        link: string,
        linkText: string,
        value: string,
        onChange: (v: string) => void,
        hasExisting: boolean
    ) => (
        <div className="space-y-1">
            <Label className="flex items-center gap-2">
                {label}
                <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-secondary"
                >
                    <ExternalLink className="size-3" /> {linkText}
                </a>
            </Label>
            <Input
                type="password"
                className="font-mono"
                placeholder={hasExisting ? '••••••••••••••••' : 'API Key…'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                    <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                        <Sparkles className="size-5" />
                    </div>
                    <div>
                        <h4 className="font-semibold">Bild-KI & Automatische Bilder</h4>
                        <p className="text-sm text-muted-foreground">
                            API-Keys für automatische Bildsuche oder KI-Bildgenerierung bei
                            Gerichten.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-1">
                        <Label>Standard-Bildquelle für Gerichte</Label>
                        <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                        >
                            <option value="none">Nicht aktiv</option>
                            <option value="unsplash">🔍 Unsplash (Suche)</option>
                            <option value="pexels">🔍 Pexels (Suche)</option>
                            <option value="gemini">✨ Google Gemini Imagen (KI)</option>
                            <option value="puter">🪐 Puter (KI, Browser)</option>
                        </select>
                    </div>
                    {keyField(
                        'Unsplash API Key',
                        'https://unsplash.com/developers',
                        'Key holen',
                        unsplash,
                        setUnsplash,
                        !!keys.unsplashKey
                    )}
                    {keyField(
                        'Pexels API Key',
                        'https://www.pexels.com/api/',
                        'Key holen',
                        pexels,
                        setPexels,
                        !!keys.pexelsKey
                    )}
                    {keyField(
                        'Google AI API Key (Gemini Imagen)',
                        'https://aistudio.google.com/app/apikey',
                        'Google AI Studio',
                        googleAi,
                        setGoogleAi,
                        !!keys.googleAiKey
                    )}
                    {keyField(
                        'Puter Token (optional)',
                        'https://puter.com/',
                        'puter.com',
                        puter,
                        setPuter,
                        !!keys.puterToken
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={testConnection} disabled={testing}>
                    <FlaskConical /> {testing ? 'Teste…' : 'Verbindung testen'}
                </Button>
                <Button onClick={save} disabled={saving}>
                    {saving ? 'Speichern…' : 'Einstellungen speichern'}
                </Button>
            </div>
        </div>
    );
}
