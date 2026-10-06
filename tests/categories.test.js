const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tafeline-test-'));
process.env.SQLITE_PATH = path.join(dir, 'test.sqlite');

const DB = require('../server/db');
const { normalizeCatId, dishMatchesCategory } = require('../server/routes/menu.js')._internals;

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('updateCategory: translations werden nicht mehrfach JSON-kodiert', () => {
    DB.addCategory({
        id: 'aus_dem_topf',
        label: 'Aus dem Topf',
        translations: { en: 'From the pot' },
    });
    for (let i = 0; i < 3; i++) DB.updateCategory('aus_dem_topf', { label: `Aus dem Topf ${i}` });
    const cat = DB.getCategories().find((c) => c.id === 'aus_dem_topf');
    assert.deepEqual(cat.translations, { en: 'From the pot' });
});

test('updateCategory: neue translations ersetzen die alten als Objekt', () => {
    const res = DB.updateCategory('aus_dem_topf', { translations: { en: 'Pot', fr: 'Pot' } });
    assert.deepEqual(res.translations, { en: 'Pot', fr: 'Pot' });
    const cat = DB.getCategories().find((c) => c.id === 'aus_dem_topf');
    assert.deepEqual(cat.translations, { en: 'Pot', fr: 'Pot' });
});

test('updateCategory: unbekannte ID liefert null', () => {
    assert.equal(DB.updateCategory('gibt_es_nicht', { label: 'x' }), null);
});

test('normalizeCatId: mehrwortige Labels ergeben die Kategorie-ID', () => {
    assert.equal(normalizeCatId('Aus dem Topf'), 'aus_dem_topf');
    assert.equal(normalizeCatId(''), '');
});

test('dishMatchesCategory: Zuordnung per ID, normalisierter ID und Label', () => {
    assert.ok(dishMatchesCategory('aus_dem_topf', 'aus_dem_topf', 'Aus dem Topf'));
    assert.ok(dishMatchesCategory('Aus dem Topf', 'aus_dem_topf', 'Aus dem Topf'));
    assert.ok(dishMatchesCategory('aus dem topf', 'aus_dem_topf', 'Aus dem Topf'));
    assert.ok(!dishMatchesCategory('salate', 'aus_dem_topf', 'Aus dem Topf'));
    assert.ok(!dishMatchesCategory('', 'aus_dem_topf', 'Aus dem Topf'));
});
