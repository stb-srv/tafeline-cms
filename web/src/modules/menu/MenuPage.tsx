import * as React from 'react';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import { useViewTitle } from '@/hooks/useViewTitle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MENU_QUERY_KEY, useMenuData } from './menu-api';
import { DishesTab } from './DishesTab';
import { CategoriesTab } from './CategoriesTab';
import { KvTab } from './KvTab';

type MenuTab = 'dishes' | 'categories' | 'allergens' | 'additives';

const TITLES: Record<MenuTab, string> = {
    dishes: 'Speisekarte · Gerichte',
    categories: 'Speisekarte · Kategorien',
    allergens: 'Speisekarte · Allergene',
    additives: 'Speisekarte · Zusatzstoffe',
};

function MenuPage({ tab }: { tab: MenuTab }) {
    useViewTitle(TITLES[tab]);
    const { data, isLoading } = useMenuData();
    const qc = useQueryClient();
    const importRef = React.useRef<HTMLInputElement>(null);
    const [importing, setImporting] = React.useState(false);

    async function handleExport() {
        try {
            const res = await fetch('/api/menu/export', {
                headers: { 'x-admin-token': sessionStorage.getItem('tafeline_admin_token') || '' },
            });
            if (!res.ok) {
                toast.error('Export fehlgeschlagen.');
                return;
            }
            const blob = await res.blob();
            const cd = res.headers.get('content-disposition') || '';
            const name = cd.match(/filename="([^"]+)"/)?.[1] || 'speisekarte-backup.json';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Export fehlgeschlagen.');
        }
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setImporting(true);
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const res = await apiPost('menu/import', json);
            if (res.success !== false) {
                toast.success('Speisekarte erfolgreich importiert!');
                qc.invalidateQueries({ queryKey: MENU_QUERY_KEY });
            } else {
                toast.error(res.reason || 'Import fehlgeschlagen.');
            }
        } catch {
            toast.error('Ungültige JSON-Datei.');
        } finally {
            setImporting(false);
        }
    }

    if (isLoading || !data) {
        return (
            <div className="space-y-4">
                <Card className="h-16 animate-pulse bg-muted/50" />
                <Card className="h-96 animate-pulse bg-muted/50" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end gap-2">
                <input ref={importRef} type="file" accept=".json" hidden onChange={handleImport} />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importRef.current?.click()}
                    disabled={importing}
                >
                    <Upload /> {importing ? 'Importiere…' : 'JSON importieren'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download /> JSON exportieren
                </Button>
            </div>
            {tab === 'categories' && <CategoriesTab data={data} />}
            {tab === 'allergens' && <KvTab kind="allergens" data={data.allergens} />}
            {tab === 'additives' && <KvTab kind="additives" data={data.additives} />}
            {tab === 'dishes' && <DishesTab data={data} />}
        </div>
    );
}

export const MenuDishesPage = () => <MenuPage tab="dishes" />;
export const MenuCategoriesPage = () => <MenuPage tab="categories" />;
export const MenuAllergensPage = () => <MenuPage tab="allergens" />;
export const MenuAdditivesPage = () => <MenuPage tab="additives" />;
