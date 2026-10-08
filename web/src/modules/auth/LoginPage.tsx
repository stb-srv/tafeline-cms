import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { login, login2fa, type LoginResult } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginPage() {
    const navigate = useNavigate();
    const [user, setUser] = React.useState('');
    const [pass, setPass] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [tempToken, setTempToken] = React.useState<string | null>(null);
    const [code, setCode] = React.useState('');

    function handleResult(res: LoginResult) {
        if (res.success && res.twoFactorRequired && res.tempToken) {
            setTempToken(res.tempToken);
        } else if (res.success) {
            navigate(res.requirePasswordChange ? '/password-change' : '/dashboard');
        } else {
            toast.error(res.reason || 'Anmeldung fehlgeschlagen.');
            // Zwischenschritt abgelaufen: zurück zur Passwort-Eingabe
            if (tempToken && /abgelaufen/i.test(res.reason || '')) setTempToken(null);
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const res = tempToken ? await login2fa(tempToken, code) : await login(user, pass);
        setLoading(false);
        handleResult(res);
    }

    return (
        <Card>
            <CardHeader className="text-center">
                <CardTitle className="font-display text-2xl">Tafeline CMS</CardTitle>
                <CardDescription>
                    {tempToken
                        ? 'Code aus Ihrer Authenticator-App eingeben'
                        : 'Bitte melden Sie sich an'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} className="flex flex-col gap-4">
                    {tempToken ? (
                        <Input
                            placeholder="6-stelliger Code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            autoFocus
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                            required
                        />
                    ) : (
                        <>
                            <Input
                                placeholder="Benutzername"
                                autoComplete="username"
                                value={user}
                                onChange={(e) => setUser(e.target.value)}
                                required
                            />
                            <Input
                                type="password"
                                placeholder="Passwort"
                                autoComplete="current-password"
                                value={pass}
                                onChange={(e) => setPass(e.target.value)}
                                required
                            />
                        </>
                    )}
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Anmelden…' : 'Anmelden'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
