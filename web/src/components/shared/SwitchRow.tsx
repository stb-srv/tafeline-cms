import { Switch } from '@/components/ui/switch';

interface SwitchRowProps {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function SwitchRow({ label, description, checked, onChange, disabled }: SwitchRowProps) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{checked ? 'An' : 'Aus'}</span>
                <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
            </div>
        </div>
    );
}
