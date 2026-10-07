import * as React from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { apiGet, apiPost, type ApiResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

type Phase = 'loading' | 'off' | 'setup' | 'on' | 'disable';

/** Zwei-Faktor-Anmeldung (TOTP) für das eigene Konto. */
export function TwoFactorCard() {
    const [phase, setPhase] = React.useState<Phase>('loading');
    const [qr, setQr] = React.useState('');
    const [secret, setSecret] = React.useState('');
    const [code, setCode] = React.useState('');
    const [pass, setPass] = React.useState('');

    React.useEffect(() => {
        apiGet<{ enabled?: boolean }>('admin/2fa/status').then((r) =>
            setPhase(r?.enabled ? 'on' : 'off')
        );
    }, []);

    async function startSetup() {
        const res = await apiPost<ApiResult & { qr?: string; secret?: string }>(
            'admin/2fa/setup',
            {}
        );
        if (res.success === false || !res.qr) return toast.error(res.reason || 'Fehler');
        setQr(res.qr);
        setSecret(res.secret || '');
        setCode('');
        setPhase('setup');
    }

    async function enable() {
        const res = await apiPost('admin/2fa/enable', { code });
        if (res.success === false) return toast.error(res.reason || 'Code ungültig.');
        toast.success('Zwei-Faktor-Anmeldung aktiviert');
        setCode('');
        setPhase('on');
    }

    async function disable() {
        const res = await apiPost('admin/2fa/disable', { pass, code });
        if (res.success === false) return toast.error(res.reason || 'Fehler');
        toast.success('Zwei-Faktor-Anmeldung deaktiviert');
        setCode('');
        setPass('');
        setPhase('off');
    }

    if (phase === 'loading') return null;

    return (
        <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
                <ShieldCheck className="size-5" />
                <h4 className="font-semibold">Zwei-Faktor-Anmeldung (eigenes Konto)</h4>
            </div>

            {phase === 'off' && (
                <>
                    <p className="text-sm text-muted-foreground">
                        Schützt Ihren Zugang zusätzlich mit einem Code aus einer Authenticator-App.
                    </p>
                    <Button onClick={startSetup}>Einrichten</Button>
                </>
            )}

            {phase === 'setup' && (
                <div className="space-y-3">
                    <p className="text-sm">
                        QR-Code mit der Authenticator-App scannen, dann den angezeigten Code
                        eingeben.
                    </p>
                    <img src={qr} alt="QR-Code für 2FA" className="size-44 rounded bg-white p-2" />
                    <p className="break-all text-xs text-muted-foreground">
                        Manuell: <code>{secret}</code>
                    </p>
                    <div className="flex max-w-xs gap-2">
                        <Input
                            placeholder="6-stelliger Code"
                            inputMode="numeric"
                            maxLength={6}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        />
                        <Button onClick={enable} disabled={code.length !== 6}>
                            Aktivieren
                        </Button>
                    </div>
                </div>
            )}

            {phase === 'on' && (
                <>
                    <p className="text-sm text-muted-foreground">
                        Aktiv. Bei der Anmeldung wird zusätzlich ein Code abgefragt.
                    </p>
                    <Button variant="outline" onClick={() => setPhase('disable')}>
                        Deaktivieren
                    </Button>
                </>
            )}

            {phase === 'disable' && (
                <div className="flex max-w-xs flex-col gap-2">
                    <Input
                        type="password"
                        placeholder="Passwort"
                        autoComplete="current-password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                    />
                    <Input
                        placeholder="Aktueller 6-stelliger Code"
                        inputMode="numeric"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <div className="flex gap-2">
                        <Button onClick={disable} disabled={!pass || code.length !== 6}>
                            Deaktivieren
                        </Button>
                        <Button variant="outline" onClick={() => setPhase('on')}>
                            Abbrechen
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
