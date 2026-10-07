const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tafeline-2fa-test-'));
process.env.SQLITE_PATH = path.join(dir, 'test.sqlite');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateSync } = require('otplib');
const DB = require('../server/db');
const createApp = require('../server/app.js');

const SECRET = 'test-secret-test-secret-test-secret-123456';
const ioStub = { emit() {}, to: () => ({ emit() {} }), on() {} };
const app = createApp({ ADMIN_SECRET: SECRET, SETUP_COMPLETE: true, SMTP: {} }, ioStub);
const tokenFor = (user, role = 'admin') => jwt.sign({ user, role }, SECRET);

test.before(async () => {
    for (const [user, role] of [
        ['chef', 'admin'],
        ['kellner', 'waiter'],
    ])
        DB.addUser({ user, pass: await bcrypt.hash('geheim123', 4), name: user, role });
});
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('Ohne 2FA liefert der Login weiter direkt ein Token', async () => {
    const res = await request(app)
        .post('/api/admin/login')
        .send({ user: 'kellner', pass: 'geheim123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.twoFactorRequired, undefined);
});

test('Setup liefert Secret und QR, ist aber erst nach Bestätigung aktiv', async () => {
    const h = { 'x-admin-token': tokenFor('chef') };
    const res = await request(app).post('/api/admin/2fa/setup').set(h);
    assert.equal(res.status, 200);
    assert.match(res.body.qr, /^data:image\/png;base64,/);
    assert.equal(DB.get2fa('chef').enabled, false);

    const bad = await request(app).post('/api/admin/2fa/enable').set(h).send({ code: '000000' });
    assert.equal(bad.status, 400);
    assert.equal(DB.get2fa('chef').enabled, false);

    const ok = await request(app)
        .post('/api/admin/2fa/enable')
        .set(h)
        .send({ code: generateSync({ secret: res.body.secret }) });
    assert.equal(ok.status, 200);
    assert.equal(DB.get2fa('chef').enabled, true);
});

test('Login mit aktivem 2FA: erst tempToken, Session erst mit gültigem Code', async () => {
    const step1 = await request(app)
        .post('/api/admin/login')
        .send({ user: 'chef', pass: 'geheim123' });
    assert.equal(step1.status, 200);
    assert.equal(step1.body.twoFactorRequired, true);
    assert.equal(step1.body.token, undefined);

    // tempToken ist keine Session
    const asSession = await request(app)
        .get('/api/reservations')
        .set('x-admin-token', step1.body.tempToken);
    assert.equal(asSession.status, 401);

    const bad = await request(app)
        .post('/api/admin/login/2fa')
        .send({ tempToken: step1.body.tempToken, code: '000000' });
    assert.equal(bad.status, 401);

    const code = generateSync({ secret: DB.get2fa('chef').secret });
    const ok = await request(app)
        .post('/api/admin/login/2fa')
        .send({ tempToken: step1.body.tempToken, code });
    assert.equal(ok.status, 200);
    assert.equal(jwt.verify(ok.body.token, SECRET).user, 'chef');
    assert.equal(ok.body.user.pass, undefined);
});

test('Gefälschtes oder fremdes tempToken wird abgelehnt', async () => {
    const code = generateSync({ secret: DB.get2fa('chef').secret });
    const fake = jwt.sign({ user: 'chef', purpose: '2fa' }, 'falsches-secret');
    assert.equal(
        (await request(app).post('/api/admin/login/2fa').send({ tempToken: fake, code })).status,
        401
    );
    // normales Session-Token ist kein tempToken
    assert.equal(
        (
            await request(app)
                .post('/api/admin/login/2fa')
                .send({ tempToken: tokenFor('chef'), code })
        ).status,
        401
    );
});

test('Deaktivieren braucht Passwort und Code', async () => {
    const h = { 'x-admin-token': tokenFor('chef') };
    const wrong = await request(app)
        .post('/api/admin/2fa/disable')
        .set(h)
        .send({ pass: 'falsch', code: generateSync({ secret: DB.get2fa('chef').secret }) });
    assert.equal(wrong.status, 400);
    assert.equal(DB.get2fa('chef').enabled, true);
});

test('Admin kann 2FA anderer zurücksetzen, Kellner nicht', async () => {
    DB.set2faSecret('kellner', 'JBSWY3DPEHPK3PXP');
    DB.enable2fa('kellner');
    const denied = await request(app)
        .delete('/api/admin/2fa/kellner')
        .set('x-admin-token', tokenFor('kellner', 'waiter'));
    assert.equal(denied.status, 403);
    const self = await request(app)
        .delete('/api/admin/2fa/chef')
        .set('x-admin-token', tokenFor('chef'));
    assert.equal(self.status, 400);
    const ok = await request(app)
        .delete('/api/admin/2fa/kellner')
        .set('x-admin-token', tokenFor('chef'));
    assert.equal(ok.status, 200);
    assert.equal(DB.get2fa('kellner'), null);
});

test('Nutzer löschen entfernt auch sein 2FA', () => {
    DB.set2faSecret('kellner', 'JBSWY3DPEHPK3PXP');
    DB.deleteUser('kellner');
    assert.equal(DB.get2fa('kellner'), null);
});
