import { toast } from 'sonner';
import { Share2, UserPlus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { useViewTitle } from '@/hooks/useViewTitle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Employee {
    id: string | number;
    name: string;
}
interface Shift {
    employee_id: string | number;
    date: string;
    start_time: string;
    end_time: string;
}

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const COLORS = ['#1b3a5c', '#2d6a4f', '#92400e', '#7c3aed', '#9f1239', '#0e7490', '#374151'];

function getWeekNumber(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const year = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - year.getTime()) / 86400000 + 1) / 7);
}
function isToday(d: Date) {
    const t = new Date();
    return d.toDateString() === t.toDateString();
}

export function ShiftsPage() {
    useViewTitle('Schichtplan');
    const qc = useQueryClient();
    const { data: shifts = [] } = useQuery({
        queryKey: ['shifts-week'],
        queryFn: async () => (await apiGet<Shift[]>('shifts/week')) || [],
    });
    const { data: employees = [] } = useQuery({
        queryKey: ['shifts-employees'],
        queryFn: async () => (await apiGet<Employee[]>('shifts/employees')) || [],
    });

    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const weekDates = DAYS.map((_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });

    function shareLink() {
        const url = `${location.origin}/shifts/view?week=${monday.toISOString().slice(0, 10)}`;
        navigator.clipboard.writeText(url).then(() => toast.success('Link kopiert!'));
    }

    async function addEmployee() {
        const name = window.prompt('Name des Mitarbeiters:');
        if (!name?.trim()) return;
        const res = await apiPost('shifts/employees', { name: name.trim() });
        if (res.success !== false) qc.invalidateQueries({ queryKey: ['shifts-employees'] });
        else toast.error(res.reason || 'Fehler');
    }

    async function editShift(empId: string | number, date: string) {
        const existing = shifts.find(
            (s) => String(s.employee_id) === String(empId) && s.date === date
        );
        const start = window.prompt(
            'Schicht-Beginn (z.B. 09:00):',
            existing?.start_time || '09:00'
        );
        if (!start) return;
        const end = window.prompt('Schicht-Ende (z.B. 17:00):', existing?.end_time || '17:00');
        if (!end) return;
        const res = await apiPost('shifts', {
            employee_id: empId,
            date,
            start_time: start,
            end_time: end,
        });
        if (res.success !== false) qc.invalidateQueries({ queryKey: ['shifts-week'] });
        else toast.error(res.reason || 'Fehler');
    }

    return (
        <Card className="p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">
                    KW {getWeekNumber(monday)} ·{' '}
                    {monday.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} –{' '}
                    {weekDates[6].toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                    })}
                </h3>
                <div className="flex gap-2">
                    <Button onClick={shareLink}>
                        <Share2 /> Link teilen
                    </Button>
                    <Button variant="outline" onClick={addEmployee}>
                        <UserPlus /> Mitarbeiter
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse">
                    <thead>
                        <tr>
                            <th className="w-36 border-b-2 p-2.5 text-left text-sm text-muted-foreground">
                                Mitarbeiter
                            </th>
                            {DAYS.map((day, i) => (
                                <th
                                    key={day}
                                    className={cn(
                                        'rounded border-b-2 p-2.5 text-center text-xs text-muted-foreground',
                                        isToday(weekDates[i]) && 'bg-primary/5'
                                    )}
                                >
                                    <div className="font-extrabold">{day.slice(0, 2)}</div>
                                    <div>
                                        {weekDates[i].getDate()}.{weekDates[i].getMonth() + 1}.
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {employees.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="p-10 text-center text-sm text-muted-foreground"
                                >
                                    Noch keine Mitarbeiter. Klicken Sie auf „+ Mitarbeiter".
                                </td>
                            </tr>
                        ) : (
                            employees.map((emp, ei) => {
                                const color = COLORS[ei % COLORS.length];
                                return (
                                    <tr key={emp.id}>
                                        <td className="p-2.5 text-sm font-bold">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="flex size-7 items-center justify-center rounded-full text-xs font-extrabold text-white"
                                                    style={{ background: color }}
                                                >
                                                    {emp.name
                                                        .split(' ')
                                                        .map((p) => p[0])
                                                        .join('')
                                                        .slice(0, 2)
                                                        .toUpperCase()}
                                                </div>
                                                {emp.name}
                                            </div>
                                        </td>
                                        {weekDates.map((date) => {
                                            const dateStr = date.toISOString().slice(0, 10);
                                            const shift = shifts.find(
                                                (s) =>
                                                    String(s.employee_id) === String(emp.id) &&
                                                    s.date === dateStr
                                            );
                                            return (
                                                <td key={dateStr} className="p-1 text-center">
                                                    <div
                                                        onClick={() => editShift(emp.id, dateStr)}
                                                        className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg p-1 text-xs font-bold transition-colors"
                                                        style={
                                                            shift
                                                                ? {
                                                                      background: color + '22',
                                                                      color,
                                                                  }
                                                                : {
                                                                      border: '1.5px dashed hsl(var(--border))',
                                                                      color: 'hsl(var(--muted-foreground))',
                                                                  }
                                                        }
                                                    >
                                                        {shift
                                                            ? `${shift.start_time}–${shift.end_time}`
                                                            : '+'}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
