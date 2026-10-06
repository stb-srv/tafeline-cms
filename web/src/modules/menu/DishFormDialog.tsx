import * as React from 'react';
import { toast } from 'sonner';
import { Camera, ImageIcon, Upload } from 'lucide-react';
import { apiPost, apiPut, apiUpload } from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
    WEEKDAYS,
    normalizeCatId,
    parseTranslations,
    type Category,
    type Dish,
    type KvMap,
} from './menu-api';

const TRANS_LANGS = ['en', 'el'] as const;

interface DishFormState {
    number: string;
    name: string;
    price: string;
    cat: string;
    desc: string;
    image: string;
    is_daily_special: boolean;
    allergens: string[];
    additives: string[];
    available_days: number[];
    translations: Record<string, { name?: string; description?: string }>;
}

function toFormState(dish: Dish | null, categories: Category[]): DishFormState {
    if (!dish)
        return {
            number: '',
            name: '',
            price: '',
            cat: categories[0]?.id ?? '',
            desc: '',
            image: '',
            is_daily_special: false,
            allergens: [],
            additives: [],
            available_days: [],
            translations: {},
        };
    // Kategorie-Label → ID auflösen
    const resolvedCat = dish.cat
        ? categories.find(
              (c) =>
                  c.id === dish.cat ||
                  normalizeCatId(dish.cat) === c.id ||
                  (dish.cat || '').trim().toLowerCase() === (c.label || '').trim().toLowerCase()
          )?.id || dish.cat
        : '';
    return {
        number: dish.number || '',
        name: dish.name || '',
        price: dish.price != null ? String(dish.price) : '',
        cat: resolvedCat,
        desc: dish.desc || '',
        image: dish.image || '',
        is_daily_special: !!dish.is_daily_special,
        allergens: dish.allergens || [],
        additives: dish.additives || [],
        available_days: Array.isArray(dish.available_days) ? dish.available_days.map(Number) : [],
        translations: parseTranslations(dish.translations),
    };
}

export function DishFormDialog({
    open,
    onOpenChange,
    dish,
    categories,
    allergens,
    additives,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    dish: Dish | null;
    categories: Category[];
    allergens: KvMap;
    additives: KvMap;
    onSaved: () => void;
}) {
    const [f, setF] = React.useState<DishFormState>(() => toFormState(dish, categories));
    const [saving, setSaving] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const uploadRef = React.useRef<HTMLInputElement>(null);
    const captureRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (open) setF(toFormState(dish, categories));
    }, [open, dish, categories]);

    const set = <K extends keyof DishFormState>(k: K, v: DishFormState[K]) =>
        setF((s) => ({ ...s, [k]: v }));

    const toggleArr = (k: 'allergens' | 'additives' | 'available_days', v: string | number) =>
        setF((s) => {
            const arr = s[k] as (string | number)[];
            return {
                ...s,
                [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v],
            };
        });

    async function handleUpload(file: File | undefined) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Bitte eine Bilddatei wählen.');
            return;
        }
        setUploading(true);
        const res = await apiUpload<{ success?: boolean; url?: string; reason?: string }>(file);
        setUploading(false);
        if (res.success && res.url) {
            set('image', res.url);
            toast.success('Bild hochgeladen.');
        } else {
            toast.error(res.reason || 'Upload fehlgeschlagen.');
        }
    }

    function setTrans(lang: string, field: 'name' | 'description', value: string) {
        setF((s) => ({
            ...s,
            translations: {
                ...s.translations,
                [lang]: { ...s.translations[lang], [field]: value },
            },
        }));
    }

    async function save() {
        if (!f.name.trim() || !f.price) {
            toast.error('Name und Preis erforderlich');
            return;
        }
        setSaving(true);
        // Übersetzungen bereinigen (leere weglassen)
        const translations: Record<string, { name?: string; description?: string }> = {};
        for (const lang of TRANS_LANGS) {
            const t = f.translations[lang];
            if (t?.name?.trim()) (translations[lang] ??= {}).name = t.name.trim();
            if (t?.description?.trim())
                (translations[lang] ??= {}).description = t.description.trim();
        }
        const payload: Dish = {
            id: dish ? dish.id : Date.now().toString(),
            number: f.number.trim(),
            name: f.name.trim(),
            price: parseFloat(f.price),
            cat: f.cat,
            desc: f.desc.trim(),
            image: f.image || null,
            is_daily_special: f.is_daily_special,
            allergens: f.allergens,
            additives: f.additives,
            available: dish ? dish.available !== false : true,
            available_days: f.available_days,
            updated_at: new Date().toISOString(),
            translations: JSON.stringify(translations),
        };
        const res = dish
            ? await apiPut(`menu/${payload.id}`, payload)
            : await apiPost('menu', payload);
        setSaving(false);
        if (res.success !== false) {
            toast.success('Gericht gespeichert!');
            onOpenChange(false);
            onSaved();
        } else {
            toast.error(res.reason || 'Fehler');
        }
    }

    const hasImg = f.image && (f.image.startsWith('http') || f.image.startsWith('/'));
    const sectionLabel =
        'mb-2.5 text-xs font-extrabold uppercase tracking-widest text-muted-foreground/70';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{dish ? 'Gericht bearbeiten' : 'Neues Gericht'}</DialogTitle>
                </DialogHeader>

                {/* Grunddaten */}
                <div>
                    <div className={sectionLabel}>Grunddaten</div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[80px_1fr_130px_1fr]">
                        <div className="space-y-1">
                            <Label>Nr.</Label>
                            <Input
                                value={f.number}
                                onChange={(e) => set('number', e.target.value)}
                                placeholder="101"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Name *</Label>
                            <Input
                                value={f.name}
                                onChange={(e) => set('name', e.target.value)}
                                placeholder="z.B. Mousaka"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Preis (€) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={f.price}
                                onChange={(e) => set('price', e.target.value)}
                                placeholder="12.50"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Kategorie</Label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={f.cat}
                                onChange={(e) => set('cat', e.target.value)}
                            >
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mt-3 space-y-1">
                        <Label>Beschreibung</Label>
                        <Textarea
                            value={f.desc}
                            onChange={(e) => set('desc', e.target.value)}
                            className="h-20"
                            placeholder="Zutaten, Zubereitung, Besonderheiten…"
                        />
                    </div>
                </div>

                {/* Bild & Status */}
                <div className="rounded-xl border bg-muted/30 p-4">
                    <div className={sectionLabel}>Bild & Status</div>
                    <div className="flex flex-wrap items-start gap-2">
                        <Input
                            value={f.image}
                            onChange={(e) => set('image', e.target.value)}
                            placeholder="https://… oder hochladen"
                            className="min-w-[160px] flex-1"
                        />
                        <input
                            ref={uploadRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => handleUpload(e.target.files?.[0])}
                        />
                        <input
                            ref={captureRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            hidden
                            onChange={(e) => handleUpload(e.target.files?.[0])}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={uploading}
                            onClick={() => uploadRef.current?.click()}
                            title="Bild hochladen"
                        >
                            <Upload />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={uploading}
                            onClick={() => captureRef.current?.click()}
                            title="Foto aufnehmen"
                        >
                            <Camera />
                        </Button>
                        <label className="ml-auto flex cursor-pointer items-center gap-2 whitespace-nowrap pt-2 text-sm">
                            <Checkbox
                                checked={f.is_daily_special}
                                onChange={(e) => set('is_daily_special', e.target.checked)}
                            />
                            ⭐ Tagesempfehlung
                        </label>
                    </div>
                    <div className="mt-3 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40">
                        {hasImg ? (
                            <img src={f.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <ImageIcon className="size-8 opacity-20" />
                        )}
                    </div>
                    <div className="mt-3">
                        <Label className="mb-1.5 flex items-center gap-2">
                            Verfügbarkeit nach Wochentag
                            <span className="text-xs font-normal text-muted-foreground">
                                (keine Auswahl = immer verfügbar)
                            </span>
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                            {WEEKDAYS.map((wd, i) => {
                                const active = f.available_days.includes(i);
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => toggleArr('available_days', i)}
                                        className={cn(
                                            'h-8 w-10 rounded-md border text-xs font-semibold transition-colors',
                                            active
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-input hover:bg-accent'
                                        )}
                                    >
                                        {wd}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Deklaration */}
                <div className="rounded-xl border bg-muted/30 p-4">
                    <div className={sectionLabel}>Deklaration (Allergene & Zusatzstoffe)</div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <KvCheckList
                            title="Allergene"
                            data={allergens}
                            selected={f.allergens}
                            onToggle={(code) => toggleArr('allergens', code)}
                            emptyHint='Keine Allergene definiert. Zuerst unter „Allergene" anlegen.'
                        />
                        <KvCheckList
                            title="Zusatzstoffe"
                            data={additives}
                            selected={f.additives}
                            onToggle={(code) => toggleArr('additives', code)}
                            emptyHint='Keine Zusatzstoffe definiert. Zuerst unter „Zusatzstoffe" anlegen.'
                        />
                    </div>
                </div>

                {/* Mehrsprachigkeit */}
                <div className="rounded-xl border bg-muted/30 p-4">
                    <div className={sectionLabel}>Mehrsprachigkeit</div>
                    <div className="grid gap-2.5">
                        {TRANS_LANGS.map((lang) => (
                            <div
                                key={lang}
                                className="grid grid-cols-[36px_1fr_2fr] items-start gap-2.5"
                            >
                                <span className="mt-2.5 text-xs font-extrabold uppercase opacity-50">
                                    {lang}
                                </span>
                                <Input
                                    value={f.translations[lang]?.name || ''}
                                    onChange={(e) => setTrans(lang, 'name', e.target.value)}
                                    placeholder={`Name (${lang})`}
                                />
                                <Textarea
                                    value={f.translations[lang]?.description || ''}
                                    onChange={(e) => setTrans(lang, 'description', e.target.value)}
                                    placeholder={`Beschreibung (${lang})`}
                                    className="h-[42px] resize-none"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>
                    <Button onClick={save} disabled={saving} className="min-w-44">
                        {saving ? 'Speichern…' : 'Gericht speichern'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function KvCheckList({
    title,
    data,
    selected,
    onToggle,
    emptyHint,
}: {
    title: string;
    data: KvMap;
    selected: string[];
    onToggle: (code: string) => void;
    emptyHint: string;
}) {
    const entries = Object.entries(data);
    return (
        <div>
            <Label className="mb-2 block font-bold">{title}</Label>
            <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border bg-background/50 p-2.5 sm:grid-cols-2">
                {entries.length === 0 ? (
                    <span className="col-span-full text-xs italic opacity-40">{emptyHint}</span>
                ) : (
                    entries.map(([code, name]) => (
                        <label
                            key={code}
                            className="flex cursor-pointer items-center gap-1.5 py-0.5 text-xs"
                        >
                            <Checkbox
                                checked={selected.includes(code)}
                                onChange={() => onToggle(code)}
                            />
                            {code}: {name}
                        </label>
                    ))
                )}
            </div>
        </div>
    );
}
