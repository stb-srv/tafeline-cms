import * as React from 'react';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { useViewTitle } from '@/hooks/useViewTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    SNAP,
    STATUS_COLOR,
    liveStatus,
    shapeSize,
    type PlannerArea,
    type PlannerPlan,
    type PlannerReservation,
    type PlannerTable,
} from './planner-api';

const SHAPES = [
    { v: 'square', l: 'Quadrat' },
    { v: 'rect-h', l: 'Rechteck ↔' },
    { v: 'rect-v', l: 'Rechteck ↕' },
    { v: 'round', l: 'Rund' },
];

export function TablePlannerPage() {
    useViewTitle('Tischplaner');
    const { data: plan } = useQuery({
        queryKey: ['table-plan'],
        queryFn: () => apiGet<PlannerPlan>('table-plan'),
    });
    const { data: reservations = [] } = useQuery({
        queryKey: ['reservations'],
        queryFn: async () => (await apiGet<PlannerReservation[]>('reservations')) || [],
    });

    const [areas, setAreas] = React.useState<PlannerArea[]>([]);
    const [tables, setTables] = React.useState<Record<string, PlannerTable[]>>({});
    const [view, setView] = React.useState<string>('all');
    const [snap, setSnap] = React.useState(true);
    const [dirty, setDirty] = React.useState(false);
    const [editTable, setEditTable] = React.useState<{
        areaId: string;
        table: PlannerTable;
    } | null>(null);
    const [areaModal, setAreaModal] = React.useState<PlannerArea | null>(null);
    const [newAreaOpen, setNewAreaOpen] = React.useState(false);

    // Add-Table-Form
    const [addNum, setAddNum] = React.useState('');
    const [addSeats, setAddSeats] = React.useState(4);
    const [addShape, setAddShape] = React.useState<PlannerTable['shape']>('square');
    const [addArea, setAddArea] = React.useState('');
    // Quick
    const [quickRows, setQuickRows] = React.useState([{ count: 5, seats: 4 }]);
    const [quickStart, setQuickStart] = React.useState(1);

    React.useEffect(() => {
        if (plan) {
            setAreas(plan.areas || []);
            setTables(plan.tables || {});
            setAddArea(plan.areas?.[0]?.id || '');
        }
    }, [plan]);

    const snapV = (v: number) => (snap ? Math.round(v / SNAP) * SNAP : v);

    function updateTable(areaId: string, id: string, patch: Partial<PlannerTable>) {
        setTables((s) => ({
            ...s,
            [areaId]: (s[areaId] || []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        setDirty(true);
    }

    // ---- Drag ----
    const dragRef = React.useRef<{ areaId: string; id: string; offX: number; offY: number } | null>(
        null
    );
    function onTablePointerDown(e: React.PointerEvent, areaId: string, t: PlannerTable) {
        e.stopPropagation();
        const canvas = (e.currentTarget as HTMLElement).parentElement!;
        const rect = canvas.getBoundingClientRect();
        dragRef.current = {
            areaId,
            id: t.id,
            offX: e.clientX - rect.left - t.x,
            offY: e.clientY - rect.top - t.y,
        };
        const move = (ev: PointerEvent) => {
            const d = dragRef.current;
            if (!d) return;
            const x = snapV(ev.clientX - rect.left - d.offX);
            const y = snapV(ev.clientY - rect.top - d.offY);
            updateTable(d.areaId, d.id, { x: Math.max(0, x), y: Math.max(0, y) });
        };
        const up = () => {
            dragRef.current = null;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    }

    function addTable() {
        if (!addArea) return toast.error('Bitte Bereich wählen');
        if (!addNum.trim()) return toast.error('Bitte Tischnummer eingeben');
        const { w, h } = shapeSize(addShape);
        const t: PlannerTable = {
            id: 'T' + Date.now(),
            num: addNum.trim(),
            seats: addSeats,
            shape: addShape,
            x: 20,
            y: 20,
            w,
            h,
        };
        setTables((s) => ({ ...s, [addArea]: [...(s[addArea] || []), t] }));
        setDirty(true);
        setAddNum('');
        toast.success(`Tisch ${t.num} hinzugefügt`);
    }

    function generateQuick() {
        if (!addArea) return toast.error('Bitte Bereich wählen');
        const COLS = 6,
            CELL = 80,
            OFF = 20;
        const existingNums = new Set(
            Object.values(tables)
                .flat()
                .map((t) => t.num)
        );
        let counter = quickStart,
            pos = 0;
        const newTables: PlannerTable[] = [];
        for (const { count, seats } of quickRows) {
            for (let i = 0; i < count; i++) {
                while (existingNums.has(String(counter))) counter++;
                const col = pos % COLS;
                const row = Math.floor(pos / COLS);
                const shape: PlannerTable['shape'] =
                    seats >= 6 ? 'rect-h' : seats === 2 ? 'round' : 'square';
                const { w, h } = shapeSize(shape);
                newTables.push({
                    id: 'T' + Date.now() + '_' + pos,
                    num: String(counter),
                    seats,
                    shape,
                    x: OFF + col * CELL,
                    y: OFF + row * CELL,
                    w,
                    h,
                });
                existingNums.add(String(counter));
                counter++;
                pos++;
            }
        }
        setTables((s) => ({ ...s, [addArea]: [...(s[addArea] || []), ...newTables] }));
        setDirty(true);
        toast.success(`${pos} Tische generiert`);
    }

    async function save() {
        const res = await apiPost('table-plan', {
            areas,
            tables,
            combined: plan?.combined || {},
            decors: plan?.decors || {},
        });
        if (res.success !== false) {
            setDirty(false);
            toast.success('Planer gespeichert.');
        } else toast.error(res.reason || 'Fehler');
    }

    function saveArea(a: PlannerArea, isNew: boolean) {
        if (isNew) {
            setAreas((s) => [...s, a]);
            setTables((s) => ({ ...s, [a.id]: [] }));
        } else {
            setAreas((s) => s.map((x) => (x.id === a.id ? a : x)));
        }
        setDirty(true);
    }
    function deleteArea(id: string) {
        setAreas((s) => s.filter((x) => x.id !== id));
        setTables((s) => {
            const n = { ...s };
            delete n[id];
            return n;
        });
        setDirty(true);
    }

    // Stats
    const stats = { free: 0, reserved: 0, occupied: 0 };
    Object.values(tables)
        .flat()
        .forEach((t) => stats[liveStatus(t.id, reservations)]++);

    const shownAreas = areas.filter((a) => view === 'all' || view === a.id);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    <TabBtn active={view === 'all'} onClick={() => setView('all')}>
                        Alle
                    </TabBtn>
                    {areas.map((a) => (
                        <TabBtn key={a.id} active={view === a.id} onClick={() => setView(a.id)}>
                            {a.icon} {a.name}
                        </TabBtn>
                    ))}
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <span>🟢 {stats.free}</span>
                    <span>🟡 {stats.reserved}</span>
                    <span>🔴 {stats.occupied}</span>
                    <Button onClick={save} disabled={!dirty}>
                        <Save /> Speichern
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
                {/* Sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardContent className="space-y-3 pt-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold uppercase text-muted-foreground">
                                    Bereiche
                                </h4>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setNewAreaOpen(true)}
                                >
                                    <Plus />
                                </Button>
                            </div>
                            {areas.map((a) => (
                                <button
                                    key={a.id}
                                    onClick={() => setAreaModal(a)}
                                    className="flex w-full items-center justify-between border-b py-1.5 text-sm last:border-0"
                                >
                                    <span>
                                        {a.icon || '🏠'} {a.name}
                                    </span>
                                    <i className="fas fa-edit opacity-50" />
                                </button>
                            ))}
                            {areas.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    Noch keine Bereiche.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="space-y-3 pt-6">
                            <h4 className="text-sm font-bold uppercase text-muted-foreground">
                                Tisch hinzufügen
                            </h4>
                            <select
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={addArea}
                                onChange={(e) => setAddArea(e.target.value)}
                            >
                                {areas.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    placeholder="Nr."
                                    value={addNum}
                                    onChange={(e) => setAddNum(e.target.value)}
                                />
                                <Input
                                    type="number"
                                    value={addSeats}
                                    onChange={(e) => setAddSeats(Number(e.target.value))}
                                />
                            </div>
                            <select
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={addShape}
                                onChange={(e) =>
                                    setAddShape(e.target.value as PlannerTable['shape'])
                                }
                            >
                                {SHAPES.map((s) => (
                                    <option key={s.v} value={s.v}>
                                        {s.l}
                                    </option>
                                ))}
                            </select>
                            <Button className="w-full" onClick={addTable}>
                                <Plus /> Tisch hinzufügen
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="space-y-3 pt-6">
                            <h4 className="text-sm font-bold uppercase text-muted-foreground">
                                Schnell generieren
                            </h4>
                            {quickRows.map((r, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                    <Input
                                        type="number"
                                        value={r.count}
                                        onChange={(e) =>
                                            setQuickRows((rows) =>
                                                rows.map((x, xi) =>
                                                    xi === i
                                                        ? { ...x, count: Number(e.target.value) }
                                                        : x
                                                )
                                            )
                                        }
                                    />
                                    <Input
                                        type="number"
                                        value={r.seats}
                                        onChange={(e) =>
                                            setQuickRows((rows) =>
                                                rows.map((x, xi) =>
                                                    xi === i
                                                        ? { ...x, seats: Number(e.target.value) }
                                                        : x
                                                )
                                            )
                                        }
                                    />
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={() =>
                                            setQuickRows((rows) => rows.filter((_, xi) => xi !== i))
                                        }
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => setQuickRows((r) => [...r, { count: 4, seats: 4 }])}
                            >
                                <Plus /> Zeile
                            </Button>
                            <div className="space-y-1">
                                <Label>Startnummer</Label>
                                <Input
                                    type="number"
                                    value={quickStart}
                                    onChange={(e) => setQuickStart(Number(e.target.value))}
                                />
                            </div>
                            <Button className="w-full" onClick={generateQuick}>
                                <Zap /> Generieren
                            </Button>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={snap}
                                    onChange={(e) => setSnap(e.target.checked)}
                                />
                                Am Raster einrasten ({SNAP}px)
                            </label>
                        </CardContent>
                    </Card>
                </div>

                {/* Canvas */}
                <div className="space-y-6 overflow-auto">
                    {shownAreas.map((a) => (
                        <div key={a.id}>
                            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                                <span>
                                    {a.icon} {a.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {a.w} × {a.h}
                                </span>
                            </div>
                            <div
                                className="relative rounded-xl border bg-muted/30"
                                style={{ width: a.w, height: a.h, maxWidth: '100%' }}
                            >
                                {(tables[a.id] || [])
                                    .filter((t) => !t.hidden)
                                    .map((t) => {
                                        const status = liveStatus(t.id, reservations);
                                        return (
                                            <div
                                                key={t.id}
                                                onPointerDown={(e) =>
                                                    onTablePointerDown(e, a.id, t)
                                                }
                                                onDoubleClick={() =>
                                                    setEditTable({ areaId: a.id, table: t })
                                                }
                                                className={cn(
                                                    'absolute flex cursor-move flex-col items-center justify-center border-2 text-xs font-bold text-white shadow',
                                                    t.shape === 'round'
                                                        ? 'rounded-full'
                                                        : 'rounded-md'
                                                )}
                                                style={{
                                                    left: t.x,
                                                    top: t.y,
                                                    width: t.w,
                                                    height: t.h,
                                                    background: STATUS_COLOR[status],
                                                    borderColor: STATUS_COLOR[status],
                                                }}
                                                title="Ziehen zum Verschieben · Doppelklick zum Bearbeiten"
                                            >
                                                <span>{t.num}</span>
                                                <span className="text-[0.6rem] opacity-90">
                                                    {t.seats} Pl.
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    ))}
                    {shownAreas.length === 0 && (
                        <Card className="p-16 text-center text-muted-foreground">
                            Noch keine Bereiche – links einen anlegen.
                        </Card>
                    )}
                </div>
            </div>

            {/* Tisch-Edit-Dialog */}
            {editTable && (
                <TableEditDialog
                    table={editTable.table}
                    onClose={() => setEditTable(null)}
                    onSave={(patch) => {
                        const { w, h } = shapeSize(patch.shape || editTable.table.shape);
                        updateTable(editTable.areaId, editTable.table.id, { ...patch, w, h });
                        setEditTable(null);
                    }}
                    onDelete={() => {
                        setTables((s) => ({
                            ...s,
                            [editTable.areaId]: s[editTable.areaId].filter(
                                (x) => x.id !== editTable.table.id
                            ),
                        }));
                        setDirty(true);
                        setEditTable(null);
                    }}
                />
            )}

            {/* Bereich-Dialoge */}
            {(areaModal || newAreaOpen) && (
                <AreaDialog
                    area={areaModal}
                    onClose={() => {
                        setAreaModal(null);
                        setNewAreaOpen(false);
                    }}
                    onSave={(a, isNew) => {
                        saveArea(a, isNew);
                        setAreaModal(null);
                        setNewAreaOpen(false);
                    }}
                    onDelete={
                        areaModal
                            ? () => {
                                  if (
                                      window.confirm('Bereich löschen? Alle Tische gehen verloren.')
                                  ) {
                                      deleteArea(areaModal.id);
                                      setAreaModal(null);
                                  }
                              }
                            : undefined
                    }
                />
            )}
        </div>
    );
}

function TabBtn({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'
            )}
        >
            {children}
        </button>
    );
}

function TableEditDialog({
    table,
    onClose,
    onSave,
    onDelete,
}: {
    table: PlannerTable;
    onClose: () => void;
    onSave: (patch: Partial<PlannerTable>) => void;
    onDelete: () => void;
}) {
    const [num, setNum] = React.useState(table.num);
    const [seats, setSeats] = React.useState(table.seats);
    const [shape, setShape] = React.useState(table.shape);
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tisch bearbeiten</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label>Nummer / Name</Label>
                        <Input value={num} onChange={(e) => setNum(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label>Sitzplätze</Label>
                        <Input
                            type="number"
                            value={seats}
                            onChange={(e) => setSeats(Number(e.target.value))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Form</Label>
                        <select
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                            value={shape}
                            onChange={(e) => setShape(e.target.value as PlannerTable['shape'])}
                        >
                            {SHAPES.map((s) => (
                                <option key={s.v} value={s.v}>
                                    {s.l}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <DialogFooter className="justify-between">
                    <Button variant="outline" className="text-destructive" onClick={onDelete}>
                        <Trash2 /> Löschen
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Abbrechen
                        </Button>
                        <Button onClick={() => onSave({ num, seats, shape })}>Übernehmen</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AreaDialog({
    area,
    onClose,
    onSave,
    onDelete,
}: {
    area: PlannerArea | null;
    onClose: () => void;
    onSave: (a: PlannerArea, isNew: boolean) => void;
    onDelete?: () => void;
}) {
    const isNew = !area;
    const [f, setF] = React.useState<PlannerArea>(
        area || { id: 'A' + Date.now(), name: '', icon: '🏠', w: 600, h: 450 }
    );
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isNew ? 'Neuer Bereich' : 'Bereich bearbeiten'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input
                            value={f.name}
                            onChange={(e) => setF({ ...f, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Icon (Emoji)</Label>
                        <Input
                            value={f.icon}
                            onChange={(e) => setF({ ...f, icon: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label>Breite (px)</Label>
                            <Input
                                type="number"
                                value={f.w}
                                onChange={(e) => setF({ ...f, w: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Höhe (px)</Label>
                            <Input
                                type="number"
                                value={f.h}
                                onChange={(e) => setF({ ...f, h: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter className="justify-between">
                    {onDelete ? (
                        <Button variant="outline" className="text-destructive" onClick={onDelete}>
                            <Trash2 /> Löschen
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Abbrechen
                        </Button>
                        <Button onClick={() => onSave(f, isNew)}>Speichern</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
