import { NavLink, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { NAV_CONFIG, type NavGroup, type NavItem } from '@/config/navigation';
import { useLicense } from '@/hooks/useLicense';
import { NavUser } from '@/components/shared/NavUser';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
    collapsed: boolean;
}

/**
 * EINZIGE Sidebar-Definition im Projekt. Datengetrieben aus NAV_CONFIG.
 * Eine Änderung hier wirkt auf allen Admin-Seiten.
 */
export function AppSidebar({ collapsed }: AppSidebarProps) {
    const { hasModule } = useLicense();
    const navigate = useNavigate();

    function renderItem(item: NavItem) {
        const locked = !hasModule(item.module);

        const inner = (
            <>
                <i className={cn('fa', item.icon, 'w-5 text-center text-base')} aria-hidden />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && locked && <Lock className="ml-auto size-3.5 opacity-50" />}
            </>
        );

        const baseCls =
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors';

        // Externe Seiten (z. B. Küchen-Display) → neuer Tab
        if (item.external) {
            const node = (
                <button
                    type="button"
                    disabled={locked}
                    onClick={() => window.open(item.external, '_blank')}
                    className={cn(
                        baseCls,
                        'w-full text-left text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        locked && 'cursor-not-allowed opacity-50',
                        collapsed && 'justify-center'
                    )}
                >
                    {inner}
                </button>
            );
            return wrapTooltip(item, node, collapsed);
        }

        const node = (
            <NavLink
                to={locked ? '#' : item.path}
                end
                onClick={(e) => {
                    if (locked) {
                        e.preventDefault();
                        navigate('/settings/license');
                    }
                }}
                className={({ isActive }) =>
                    cn(
                        baseCls,
                        isActive && !locked
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        locked && 'cursor-not-allowed opacity-50',
                        collapsed && 'justify-center'
                    )
                }
            >
                {inner}
            </NavLink>
        );
        return wrapTooltip(item, node, collapsed);
    }

    function renderGroup(group: NavGroup) {
        return (
            <div key={group.id} className="px-2 py-1">
                {!collapsed && (
                    <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                        {group.label}
                    </div>
                )}
                <nav className="flex flex-col gap-0.5">
                    {group.items?.map((it) => <span key={it.id}>{renderItem(it)}</span>)}
                    {group.sections?.map((sec) => (
                        <div key={sec.label} className="mt-1">
                            {!collapsed && (
                                <div className="px-3 pb-0.5 pt-2 text-[0.65rem] font-medium uppercase text-sidebar-foreground/40">
                                    {sec.label}
                                </div>
                            )}
                            {sec.items.map((it) => (
                                <span key={it.id}>{renderItem(it)}</span>
                            ))}
                        </div>
                    ))}
                </nav>
            </div>
        );
    }

    return (
        <aside
            className={cn(
                'flex h-svh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
                collapsed ? 'w-14' : 'w-60'
            )}
        >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
                <img src="/logo.svg" alt="Tafeline" className="h-7" />
                {!collapsed && <span className="font-display font-bold">Tafeline</span>}
            </div>

            <div className="flex-1 overflow-y-auto py-2">
                {NAV_CONFIG.map(renderGroup)}
            </div>

            <div className="border-t border-sidebar-border p-2">
                <NavUser collapsed={collapsed} />
            </div>
        </aside>
    );
}

function wrapTooltip(item: NavItem, node: React.ReactNode, collapsed: boolean) {
    if (!collapsed) return node;
    return (
        <Tooltip key={item.id} delayDuration={0}>
            <TooltipTrigger asChild>{node}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
    );
}
