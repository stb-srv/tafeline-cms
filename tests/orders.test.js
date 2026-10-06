const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tafeline-orders-test-'));
process.env.SQLITE_PATH = path.join(dir, 'test.sqlite');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const createApp = require('../server/app.js');

const SECRET = 'test-secret-test-secret-test-secret-123456';
const ioStub = { emit() {}, to: () => ({ emit() {} }), on() {} };
const app = createApp({ ADMIN_SECRET: SECRET, SETUP_COMPLETE: true, SMTP: {} }, ioStub);
const tokenFor = (role) => jwt.sign({ user: role, role }, SECRET);

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('Bestellung mit leerem Warenkorb wird abgelehnt (400)', async () => {
    const res = await request(app).post('/api/orders').send({ type: 'pickup', items: [] });
    assert.equal(res.status, 400);
});

test('Bestellung mit ungültigem Typ wird abgelehnt (400)', async () => {
    const res = await request(app)
        .post('/api/orders')
        .send({ type: 'teleport', items: [{ id: 1 }] });
    assert.equal(res.status, 400);
});

test('Bestellung ohne passende Lizenz wird abgelehnt (403)', async () => {
    const res = await request(app)
        .post('/api/orders')
        .send({ type: 'pickup', items: [{ id: 1, qty: 1 }] });
    assert.equal(res.status, 403);
});

test('Bestellliste: ohne Token 401, Rolle ohne Recht 403', async () => {
    assert.equal((await request(app).get('/api/orders')).status, 401);
    const bad = await request(app).get('/api/orders').set('x-admin-token', tokenFor('guest'));
    assert.equal(bad.status, 403);
});

test('Statusseite mit unbekanntem Token liefert 404', async () => {
    const res = await request(app).get('/api/orders/status/gibtsnicht');
    assert.equal(res.status, 404);
});

test('Status-Update: ohne Token 401, ungültiger Status 400', async () => {
    const noAuth = await request(app).put('/api/orders/1/status').send({ status: 'ready' });
    assert.equal(noAuth.status, 401);
    const bad = await request(app)
        .put('/api/orders/1/status')
        .set('x-admin-token', tokenFor('kitchen'))
        .send({ status: 'flying' });
    assert.equal(bad.status, 400);
});

test('Bestellung löschen darf nur der Admin', async () => {
    assert.equal((await request(app).delete('/api/orders/1')).status, 401);
    const kitchen = await request(app)
        .delete('/api/orders/1')
        .set('x-admin-token', tokenFor('kitchen'));
    assert.equal(kitchen.status, 403);
});

test('Exporte (CSV/PDF) sind nur für Admins', async () => {
    for (const url of ['/api/orders/export/csv', '/api/orders/export/pdf']) {
        const res = await request(app).get(url).set('x-admin-token', tokenFor('waiter'));
        assert.equal(res.status, 403, url);
    }
});

test('Reservierungsprüfung: fehlende Felder 400, ohne Lizenz 403', async () => {
    const bad = await request(app).post('/api/reservations/check').send({ date: '2030-01-01' });
    assert.equal(bad.status, 400);
    const res = await request(app)
        .post('/api/reservations/check')
        .send({ date: '2030-01-01', time: '19:00', guests: 2 });
    assert.equal(res.status, 403);
});

test('Reservierung bestätigen/stornieren mit unbekanntem Token zeigt keinen Erfolg', async () => {
    for (const url of ['/api/reservations/cancel/xyz', '/api/reservations/confirm/xyz']) {
        const res = await request(app).get(url);
        assert.ok(res.status >= 400 || !/erfolgreich/i.test(res.text), url);
    }
});
