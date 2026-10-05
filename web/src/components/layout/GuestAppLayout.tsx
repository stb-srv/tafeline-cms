import * as React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Github, ShoppingCart } from 'lucide-react';
import { useGuestBranding } from '@/modules/guest/guest-api';
import { useCart } from '@/modules/guest/cart-store';
import { CartDrawer } from '@/modules/guest/CartDrawer';
import { CookieBanner } from '@/modules/guest/CookieBanner';

/**
 * Layout der öffentlichen Gäste-Website. Navigation, Footer und Cart-Drawer
 * existieren NUR hier (Single Source). Sektionen kommen via <Outlet/>.
 */
export function GuestAppLayout() {
    const { data: branding } = useGuestBranding();
    const count = useCart((s) => s.count());
    const [cartOpen, setCartOpen] = React.useState(false);

    return (
        <div className="flex min-h-svh flex-col font-guest-body">
            <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/90 px-6 backdrop-blur">
                <Link to="/" className="flex items-center gap-2">
                    {branding?.logo ? (
                        <img src={branding.logo} alt={branding.name} className="h-9" />
                    ) : (
                        <span className="font-guest-display text-2xl font-bold text-primary">
                            {branding?.name || 'Tafeline'}
                        </span>
                    )}
                </Link>
                <nav className="flex items-center gap-6 text-sm font-medium">
                    <Link to="/speisekarte" className="hidden hover:text-primary sm:inline">
                        Speisekarte
                    </Link>
                    <Link to="/#location" className="hidden hover:text-primary sm:inline">
                        Standort
                    </Link>
                    <button
                        onClick={() => setCartOpen(true)}
                        className="relative rounded-full bg-primary p-2.5 text-primary-foreground"
                        aria-label="Warenkorb"
                    >
                        <ShoppingCart className="size-5" />
                        {count > 0 && (
                            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                                {count}
                            </span>
                        )}
                    </button>
                </nav>
            </header>

            <main className="flex-1">
                <Outlet />
            </main>

            <footer className="border-t bg-muted/40 py-8 text-center text-sm text-muted-foreground">
                {branding?.phone && (
                    <p className="mb-1">
                        <a href={`tel:${branding.phone}`} className="hover:text-primary">
                            📞 {branding.phone}
                        </a>
                    </p>
                )}
                <p>
                    © {new Date().getFullYear()} {branding?.name || 'Tafeline'}
                </p>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs">
                    Ein Projekt von
                    <a
                        href="https://github.com/stb-srv"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium hover:text-primary"
                    >
                        <Github className="size-3.5" /> stb-srv
                    </a>
                </p>
            </footer>

            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
            <CookieBanner />
        </div>
    );
}
