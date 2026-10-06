const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tafeline-api-test-'));
process.env.SQLITE_PATH = path.join(dir, 'test.sqlite');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DB = require('../server/db');
const createApp = require('../server/app.js');
const { requireRole } = require('../server/core/middleware.js');

const SECRET = 'test-secret-test-secret-test-secret-123456';
const ioStub = { emit() {}, to: () => ({ emit() {} }), on() {} };
const app = createApp({ ADMIN_SECRET: SECRET, SETUP_COMPLETE: true, SMTP: {} }, ioStub);

test.before(async () => {
    DB.addUser({
        user: 'chef',
        pass: await bcrypt.hash('geheim123', 4),
        name: 'Chef',
        role: 'admin',
    });
});
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('Login mit falschem Passwort liefert 401', async () => {
    const res = await request(app).post('/api/admin/login').send({ user: 'chef', pass: 'falsch' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
});

test('Login mit unbekanntem Nutzer liefert 401', async () => {
    const res = await request(app).post('/api/admin/login').send({ user: 'nobody', pass: 'x' });
    assert.equal(res.status, 401);
});

test('Login ohne Felder wird validiert (400)', async () => {
    const res = await request(app).post('/api/admin/login').send({});
    assert.equal(res.status, 400);
});

test('Login mit richtigen Daten liefert Token ohne Passwort-Hash', async () => {
    const res = await request(app)
        .post('/api/admin/login')
        .send({ user: 'chef', pass: 'geheim123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.pass, undefined);
    assert.equal(jwt.verify(res.body.token, SECRET).role, 'admin');
});

test('Geschützte Route ohne Token liefert 401', async () => {
    const res = await request(app).get('/api/reservations');
    assert.equal(res.status, 401);
});

test('Geschützte Route mit gefälschtem Token liefert 401', async () => {
    const bad = jwt.sign({ user: 'x', role: 'admin' }, 'anderes-secret');
    const res = await request(app).get('/api/reservations').set('x-admin-token', bad);
    assert.equal(res.status, 401);
});

test('Admin-Token darf Reservierungen lesen', async () => {
    const token = jwt.sign({ user: 'chef', role: 'admin' }, SECRET);
    const res = await request(app).get('/api/reservations').set('x-admin-token', token);
    assert.equal(res.status, 200);
});

test('Kellner darf Reservierung nicht löschen (403)', async () => {
    const token = jwt.sign({ user: 'kellner', role: 'waiter' }, SECRET);
    const res = await request(app).delete('/api/reservations/abc').set('x-admin-token', token);
    assert.equal(res.status, 403);
});

test('Öffentliche Speisekarte und Kategorien sind ohne Login erreichbar', async () => {
    for (const url of ['/api/menu', '/api/categories', '/api/allergens']) {
        const res = await request(app).get(url);
        assert.equal(res.status, 200, url);
    }
});

test('Speisekarte anlegen ohne Token liefert 401', async () => {
    const res = await request(app).post('/api/menu').send({ name: 'Test', price: 1 });
    assert.equal(res.status, 401);
});

test('requireRole: admin darf alles, andere nur genannte Rollen', () => {
    const run = (role, roles) => {
        let code = null;
        const res = {
            status(c) {
                code = c;
                return this;
            },
            json() {},
        };
        requireRole(...roles)({ admin: role ? { role } : undefined }, res, () => {
            code = 'next';
        });
        return code;
    };
    assert.equal(run('admin', ['kitchen']), 'next');
    assert.equal(run('waiter', ['waiter']), 'next');
    assert.equal(run('waiter', ['kitchen']), 403);
    assert.equal(run(null, ['waiter']), 403);
});
