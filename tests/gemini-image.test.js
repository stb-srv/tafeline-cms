const test = require('node:test');
const assert = require('node:assert');
const G = require('../server/services/gemini-image.js');

test('resolveModel: Default und Validierung', () => {
    assert.strictEqual(G.resolveModel(''), G.DEFAULT_MODEL);
    assert.strictEqual(G.resolveModel('../evil?x=1'), G.DEFAULT_MODEL);
    assert.strictEqual(G.resolveModel('gemini-3-pro-image'), 'gemini-3-pro-image');
});

test('buildDishPrompt: Stil-Prompt vor Gericht, Default bei leer', () => {
    const p = G.buildDishPrompt({
        stylePrompt: 'Dunkles Holz',
        name: 'Mousaka',
        description: 'Auberginen',
    });
    assert.ok(p.startsWith('Dunkles Holz'));
    assert.ok(p.includes('Mousaka') && p.includes('Auberginen'));
    assert.ok(G.buildDishPrompt({ name: 'X' }).includes(G.DEFAULT_STYLE_PROMPT));
});

test('findImage: findet Bildblock in verschachtelter Antwort', () => {
    const body = {
        steps: [
            {
                type: 'model_output',
                content: [
                    { type: 'text', text: 'hi' },
                    { type: 'image', data: 'AAAA', mime_type: 'image/jpeg' },
                ],
            },
        ],
    };
    assert.deepStrictEqual(G.findImage(body), { data: 'AAAA', mimeType: 'image/jpeg' });
    assert.strictEqual(G.findImage({ steps: [] }), null);
});

test('generateImage: Request-Format und Fehlerbehandlung', async () => {
    const orig = global.fetch;
    let seen;
    global.fetch = async (url, opts) => {
        seen = { url, opts };
        return {
            ok: true,
            status: 200,
            json: async () => ({
                steps: [{ content: [{ type: 'image', data: 'QUJD', mime_type: 'image/png' }] }],
            }),
        };
    };
    const img = await G.generateImage({ apiKey: 'k', prompt: 'p' });
    assert.strictEqual(img.data, 'QUJD');
    assert.strictEqual(seen.opts.headers['x-goog-api-key'], 'k');
    assert.ok(!seen.url.includes('key='));
    assert.strictEqual(JSON.parse(seen.opts.body).store, false);
    global.fetch = async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'quota' } }),
    });
    await assert.rejects(G.generateImage({ apiKey: 'k', prompt: 'p' }), (e) => e.status === 429);
    global.fetch = orig;
});
