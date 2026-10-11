/**
 * Gemini Bildgenerierung ("Nano Banana") über die Interactions-API.
 * Modellname und Stil-Prompt kommen aus den Admin-Einstellungen (settings.imageApiKeys).
 * Der API-Key verlässt den Server nie.
 */
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_MODEL = 'gemini-nano-banana-2.1';
const MODEL_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/i;

const DEFAULT_STYLE_PROMPT =
    'Professionelles Food-Foto, Draufsicht leicht schräg, das Gericht frisch angerichtet auf einem ' +
    'schlichten Teller, weicher natürlicher Lichteinfall, ruhiger heller Hintergrund, ' +
    'quadratisches Format, kein Text, keine Personen, keine Logos.';

function resolveModel(model) {
    return typeof model === 'string' && MODEL_RE.test(model.trim()) ? model.trim() : DEFAULT_MODEL;
}

function buildDishPrompt({ stylePrompt, name, description, category }) {
    const style = (stylePrompt || '').trim() || DEFAULT_STYLE_PROMPT;
    const dish = [name, category && `(Kategorie: ${category})`, description]
        .filter(Boolean)
        .join(' ')
        .slice(0, 600);
    return `${style.slice(0, 1500)}\n\nAbzubildendes Gericht: ${dish}`;
}

// Sucht rekursiv den ersten Bildblock ({type:'image', data}) – robust gegen Änderungen der Step-Struktur.
function findImage(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 8) return null;
    if (node.type === 'image' && typeof node.data === 'string' && node.data) {
        return { data: node.data, mimeType: node.mime_type || 'image/png' };
    }
    for (const v of Object.values(node)) {
        const hit = findImage(v, depth + 1);
        if (hit) return hit;
    }
    return null;
}

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

async function generateImage({ apiKey, model, prompt, timeoutMs = 60000 }) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
            model: resolveModel(model),
            input: [{ type: 'text', text: prompt }],
            store: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(body?.error?.message || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    const img = findImage(body);
    if (!img || !ALLOWED_MIME.has(img.mimeType)) {
        const err = new Error('Das Modell hat kein Bild geliefert.');
        err.status = 422;
        throw err;
    }
    return img;
}

module.exports = {
    DEFAULT_MODEL,
    DEFAULT_STYLE_PROMPT,
    resolveModel,
    buildDishPrompt,
    findImage,
    generateImage,
};
