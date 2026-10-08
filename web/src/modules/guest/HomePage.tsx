import * as React from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { useGuestBranding, useGuestHome } from './guest-api';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAY_LABELS: Record<string, string> = {
    Mo: 'Montag', Di: 'Dienstag', Mi: 'Mittwoch', Do: 'Donnerstag',
    Fr: 'Freitag', Sa: 'Samstag', So: 'Sonntag',
};

export function HomePage() {
    const { data: home } = useGuestHome();
    const { data: branding } = useGuestBranding();

    // Beim Aufruf von /#location o.ä. zum Anker scrollen
    React.useEffect(() => {
        const id = window.location.hash.replace('#', '');
        if (id) {
            const el = document.getElementById(id);
            if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }, [home]);

    return (
        <div id="top">
            {/* Hero */}
            <section
                className="relative flex h-[70vh] items-center justify-center bg-cover bg-center text-center text-white"
                style={{
                    backgroundImage: `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url('${home?.bgImage || '/assets/hero-default.jpg'}')`,
                }}
            >
                <div className="px-6">
                    <h1 className="font-guest-display text-5xl font-bold md:text-7xl">
                        {home?.heroTitle || branding?.name || 'Willkommen'}
                    </h1>
                    <p className="mt-4 text-lg opacity-90 md:text-2xl">
                        {home?.heroSlogan || branding?.slogan || ''}
                    </p>
                    <Link
                        to="/speisekarte"
                        className="mt-8 inline-block rounded-full bg-secondary px-8 py-3 font-bold text-secondary-foreground"
                    >
                        Zur Speisekarte
                    </Link>
                </div>
            </section>

            {/* Promo */}
            {home?.promotionEnabled !== false && home?.promotionText && (
                <div className="bg-secondary py-3 text-center font-medium text-secondary-foreground">
                    {home.promotionText}
                </div>
            )}

            {/* Welcome */}
            {(home?.welcomeText || home?.welcomeImage) && (
                <section className="mx-auto grid max-w-5xl items-center gap-8 px-6 py-16 md:grid-cols-2">
                    <div>
                        <h2 className="font-guest-display text-4xl font-bold text-primary">
                            {home?.welcomeTitle || 'Willkommen'}
                        </h2>
                        <p className="mt-4 leading-relaxed text-muted-foreground">
                            {home?.welcomeText}
                        </p>
                    </div>
                    {home?.welcomeImage && (
                        <img src={home.welcomeImage} alt="" className="rounded-2xl object-cover shadow-lg" />
                    )}
                </section>
            )}

            {/* Speisekarte-Teaser → eigene Seite */}
            <section className="bg-muted/40 py-16 text-center">
                <UtensilsCrossed className="mx-auto mb-4 size-10 text-secondary" />
                <h2 className="font-guest-display text-3xl font-bold text-primary">
                    Unsere Speisekarte
                </h2>
                <p className="mx-auto mt-3 max-w-xl px-6 text-muted-foreground">
                    Entdecken Sie alle Gerichte – übersichtlich nach Kategorien sortiert und
                    durchsuchbar.
                </p>
                <Link
                    to="/speisekarte"
                    className="mt-6 inline-block rounded-full bg-primary px-8 py-3 font-bold text-primary-foreground"
                >
                    Zur Speisekarte
                </Link>
            </section>

            {/* Öffnungszeiten + Standort */}
            <section id="location" className="py-16">
                <div className="mx-auto grid max-w-5xl gap-8 px-6 md:grid-cols-2">
                    {home?.openingHours && (
                        <div>
                            <h2 className="mb-5 font-guest-display text-3xl font-bold text-primary">
                                Öffnungszeiten
                            </h2>
                            <div className="space-y-1.5">
                                {DAYS.map((d) => {
                                    const e = home.openingHours?.[d] || { closed: true };
                                    return (
                                        <div key={d} className="flex justify-between border-b py-1.5 text-sm">
                                            <span>{DAY_LABELS[d]}</span>
                                            <span className="text-muted-foreground">
                                                {e.closed ? 'Geschlossen' : `${e.open} – ${e.close}`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {home?.location?.address && (
                        <div>
                            <h2 className="mb-5 font-guest-display text-3xl font-bold text-primary">
                                Standort
                            </h2>
                            <p className="whitespace-pre-line text-muted-foreground">
                                {home.location.address}
                            </p>
                            {home.location.embedUrl && (
                                <iframe
                                    src={home.location.embedUrl}
                                    title="Karte"
                                    className="mt-4 h-64 w-full rounded-xl border"
                                    loading="lazy"
                                />
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
