import * as React from 'react';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useCookieConfig, submitConsent, type CookieCategory } from './guest-api';

const STORAGE_KEY = 'tafeline_consent';

interface StoredConsent {
    version: string;
    choices: Record<string, boolean>;
    timestamp: string;
}

function readStored(): StoredConsent | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as StoredConsent) : null;
    } catch {
        return null;
    }
}

/**
 * DSGVO-konformer Cookie-Banner. Zeigt sich, wenn noch keine Einwilligung
 * vorliegt oder die Config-Version sich geändert hat (Re-Consent). Speichert
 * die Wahl lokal und schickt einen Nachweis-Eintrag an /api/cookie-consent.
 */
export function CookieBanner() {
    const { data: config } = useCookieConfig();
    const [visible, setVisible] = React.useState(false);
    const [details, setDetails] = React.useState(false);
    const [choices, setChoices] = React.useState<Record<string, boolean>>({});

    const categories = React.useMemo<CookieCategory[]>(
        () => Object.values(config?.categories || {}),
        [config]
    );

    // Sichtbarkeit + Default-Auswahl bestimmen, sobald Config geladen ist
    React.useEffect(() => {
        if (!config) return;
        const stored = readStored();
        const init: Record<string, boolean> = {};
        for (const cat of Object.values(config.categories)) {
            init[cat.id] = cat.required ? true : (stored?.choices?.[cat.id] ?? false);
        }
        setChoices(init);
        // Banner zeigen, wenn keine Einwilligung oder neue Version
        if (!stored || stored.version !== config.version) setVisible(true);
    }, [config]);

    function persist(finalChoices: Record<string, boolean>, source: string) {
        if (!config) return;
        const entry: StoredConsent = {
            version: config.version,
            choices: finalChoices,
            timestamp: new Date().toISOString(),
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
        } catch {
            /* ignore */
        }
        submitConsent({ choices: finalChoices, config_version: config.version, source });
        setVisible(false);
        setDetails(false);
    }

    function acceptAll() {
        const all: Record<string, boolean> = {};
        for (const cat of categories) all[cat.id] = true;
        persist(all, 'accept_all');
    }

    function acceptNecessary() {
        const min: Record<string, boolean> = {};
        for (const cat of categories) min[cat.id] = !!cat.required;
        persist(min, 'necessary_only');
    }

    function saveSelection() {
        const sel: Record<string, boolean> = {};
        for (const cat of categories) sel[cat.id] = cat.required ? true : !!choices[cat.id];
        persist(sel, 'custom');
    }

    if (!config || categories.length === 0) return null;

    return (
        <>
            {/* Floating-Button: jederzeitiger Widerruf / erneutes Öffnen */}
            {!visible && (
                <button
                    onClick={() => setVisible(true)}
                    aria-label="Cookie-Einstellungen"
                    className="fixed bottom-4 left-4 z-40 flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-lg backdrop-blur transition hover:text-primary"
                >
                    <Cookie className="size-5" />
                </button>
            )}

            {visible && (
                <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 shadow-2xl backdrop-blur md:p-6">
                    <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center">
                        <div className="flex-1 text-sm text-muted-foreground">
                            <p className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                                <Cookie className="size-4" /> Datenschutz-Einstellungen
                            </p>
                            <p>{config.banner_text}</p>
                            <a
                                href={config.privacy_url}
                                className="mt-1 inline-block underline hover:text-primary"
                            >
                                Datenschutzerklärung
                            </a>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
                            <Button variant="outline" onClick={() => setDetails(true)}>
                                Einstellungen
                            </Button>
                            <Button variant="outline" onClick={acceptNecessary}>
                                Nur notwendige
                            </Button>
                            <Button onClick={acceptAll}>Alle akzeptieren</Button>
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={details} onOpenChange={setDetails}>
                <DialogContent className="max-h-[85vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Cookie className="size-5" /> Cookie-Einstellungen
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {categories.map((cat) => (
                            <div key={cat.id} className="rounded-lg border p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-medium">{cat.label}</p>
                                        <p className="mt-0.5 text-sm text-muted-foreground">
                                            {cat.description}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={cat.required ? true : !!choices[cat.id]}
                                        disabled={cat.required}
                                        onCheckedChange={(v) =>
                                            setChoices((s) => ({ ...s, [cat.id]: v }))
                                        }
                                    />
                                </div>
                                {cat.cookies.length > 0 && (
                                    <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                                        {cat.cookies.map((c, i) => (
                                            <li key={i}>
                                                <span className="font-mono">{c.name}</span> –{' '}
                                                {c.purpose} ({c.duration}, {c.provider})
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={acceptNecessary}>
                            Nur notwendige
                        </Button>
                        <Button onClick={saveSelection}>Auswahl speichern</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
