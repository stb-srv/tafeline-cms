import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { login } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export function LoginPage() {
    const navigate = useNavigate();
    const [user, setUser] = React.useState('');
    const [pass, setPass] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const res = await login(user, pass);
        setLoading(false);
        if (res.success) {
            navigate(res.requirePasswordChange ? '/password-change' : '/dashboard');
        } else {
            toast.error(res.reason || 'Anmeldung fehlgeschlagen.');
        }
    }

    return (
        <Card>
            <CardHeader className="text-center">
                <CardTitle className="font-display text-2xl">Tafeline CMS</CardTitle>
                <CardDescription>Bitte melden Sie sich an</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Anmelden…' : 'Anmelden'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
