import * as React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Mini-Liniendiagramm (Port von sparkline()). */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
    const w = 100;
    const h = 30;
    const max = Math.max(1, ...values);
    const n = values.length;
    const pts = values
        .map((v, i) => `${n > 1 ? (i / (n - 1)) * w : 0},${(h - (v / max) * h).toFixed(1)}`)
        .join(' ');
    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className={cn('block h-9 w-full', className)}
        >
            <polyline
                points={pts}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

/** Prozentualer Trend-Vergleich (Port von trendBadge()). */
export function TrendBadge({ cur, prev }: { cur: number; prev: number }) {
    if (!prev) {
        if (cur > 0)
            return (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--success))]">
                    <ArrowUp className="size-3" /> Neu
                </span>
            );
        return <span className="text-xs text-muted-foreground">—</span>;
    }
    const diff = ((cur - prev) / prev) * 100;
    const up = diff >= 0;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-xs font-bold',
                up ? 'text-[hsl(var(--success))]' : 'text-destructive'
            )}
        >
            {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(Math.round(diff))}%
        </span>
    );
}

/**
 * Einheitlicher Widget-Rahmen (ersetzt .stat-widget). Optional klickbar →
 * navigiert per react-router (ersetzt window.switchTab).
 */
export function StatWidget({
    title,
    icon,
    to,
    className,
    children,
    accent,
}: {
    title?: string;
    icon?: string;
    to?: string;
    className?: string;
    children: React.ReactNode;
    accent?: boolean;
}) {
    const navigate = useNavigate();
    return (
        <Card
            onClick={to ? () => navigate(to) : undefined}
            className={cn(
                'flex h-full flex-col p-5 transition-shadow',
                to && 'cursor-pointer hover:shadow-md',
                accent && 'border-0 bg-primary text-primary-foreground',
                className
            )}
        >
            {(title || icon) && (
                <div className="mb-2 flex items-center justify-between">
                    {title && <h3 className="text-sm font-semibold tracking-tight">{title}</h3>}
                    {icon && <i className={cn('fas', icon, 'text-base opacity-50')} aria-hidden />}
                </div>
            )}
            {children}
        </Card>
    );
}

/** Große Kennzahl im Widget. */
export function WidgetValue({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return <div className={cn('text-3xl font-bold tracking-tight', className)}>{children}</div>;
}

/** Sekundärtext unter der Kennzahl. */
export function WidgetCaption({ children }: { children: React.ReactNode }) {
    return <p className="mt-1 text-sm text-muted-foreground">{children}</p>;
}
