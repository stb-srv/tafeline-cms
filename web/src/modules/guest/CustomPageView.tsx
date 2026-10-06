import { useParams, Link } from 'react-router-dom';
import { useGuestHome } from './guest-api';

export function CustomPageView() {
    const { slug } = useParams<{ slug: string }>();
    const { data: home, isLoading } = useGuestHome();

    if (isLoading) {
        return (
            <div className="flex min-h-64 items-center justify-center text-muted-foreground">
                Lade…
            </div>
        );
    }

    const page = (
        home?.pages as
            | Array<{
                  id: string;
                  title: string;
                  slug?: string;
                  enabled?: boolean;
                  image?: string;
                  headline?: string;
                  content?: string;
              }>
            | undefined
    )?.find((p) => (p.slug || p.id) === slug && p.enabled !== false);

    if (!page) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <p className="text-6xl font-bold text-muted-foreground/30">404</p>
                <p className="text-muted-foreground">
                    Diese Seite existiert nicht oder ist nicht verfügbar.
                </p>
                <Link to="/" className="text-sm underline hover:text-primary">
                    Zurück zur Startseite
                </Link>
            </div>
        );
    }

    let textContent = page.content || '';
    let headlineFromBlock = page.headline || '';
    try {
        const parsed = JSON.parse(page.content || '');
        if (parsed.version === 1 && Array.isArray(parsed.blocks)) {
            const block = parsed.blocks.find((b: { type: string }) => b.type === 'text');
            if (block) {
                headlineFromBlock = block.heading || headlineFromBlock;
                textContent = block.text || '';
            }
        }
    } catch {
        /* use raw content */
    }

    return (
        <article className="mx-auto max-w-3xl px-4 py-12">
            {page.image && (
                <div className="mb-8 overflow-hidden rounded-2xl">
                    <img
                        src={page.image}
                        alt={page.title}
                        className="h-64 w-full object-cover sm:h-80"
                    />
                </div>
            )}
            <h1 className="mb-2 text-3xl font-bold">{headlineFromBlock || page.title}</h1>
            {textContent && (
                <div className="prose prose-neutral dark:prose-invert mt-6 max-w-none whitespace-pre-line text-muted-foreground">
                    {textContent}
                </div>
            )}
        </article>
    );
}
