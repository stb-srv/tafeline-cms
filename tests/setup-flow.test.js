const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tafeline-setup-test-'));
process.env.SQLITE_PATH = path.join(dir, 'test.sqlite');

const request = require('supertest');
const DB = require('../server/db');
const createApp = require('../server/app.js');
const { INFO_FILE } = require('../server/core/setup-token.js');

const CONFIG_FILE = path.join(__dirname, '..', 'server', 'config.json');
const ioStub = { emit() {}, to: () => ({ emit() {} }), on() {} };
const TOKEN = 'testtoken1234567890';
// Browser senden bei POST-Fetches auch same-origin einen Origin-Header
const HOST = 'cms.example.de';
const ORIGIN = `https://${HOST}`;

// Exakt das Payload des Wizards (web/public/setup-assets/setup.js, finishSetup)
const payload = {
    setupToken: TOKEN,
    licenseKey: '',
    smtp: { host: '', port: 465, secure: true, user: '', pass: '', from: '' },
    restaurant: {
        name: 'Testrestaurant',
        phone: '',
        address: '',
        website: '',
        lang: 'de',
        timezone: 'Europe/Berlin',
    },
    adminUser: 'admin',
    adminName: 'Test Admin',
    adminEmail: 'admin@example.de',
    adminPass: 'ein-langes-passwort-123',
};

const hadConfig = fs.existsSync(CONFIG_FILE);
const app = createApp(
    { ADMIN_SECRET: 'test-secret-test-secret-test-secret-123456', SETUP_COMPLETE: false, SMTP: {} },
    ioStub
);

test.before(() => {
    global._setupToken = TOKEN;
});
test.after(() => {
    if (!hadConfig) fs.rmSync(CONFIG_FILE, { force: true });
    fs.rmSync(INFO_FILE, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
});

const post = (url) => request(app).post(url).set('Host', HOST).set('Origin', ORIGIN);

test('Setup-Wizard: Status vor dem Setup', async () => {
    const res = await request(app).get('/api/setup/status').set('Host', HOST).set('Origin', ORIGIN);
    assert.equal(res.status, 200);
    assert.equal(res.body.setupComplete, false);
});

test('Setup-Wizard: falsches Token wird abgelehnt', async () => {
    const res = await post('/api/setup/verify-token').send({ token: 'falsch' });
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, false);
});

test('Setup-Wizard: Token prüfen über Domain (same-origin, kein CORS-500)', async () => {
    const res = await post('/api/setup/verify-token').send({ token: TOKEN });
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
});

test('Fremde Origin liefert keinen 500er', async () => {
    const res = await request(app)
        .post('/api/setup/verify-token')
        .set('Host', HOST)
        .set('Origin', 'https://evil.example')
        .send({ token: TOKEN });
    assert.notEqual(res.status, 500);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('Setup-Wizard: kompletter Abschluss legt Admin an', async () => {
    const res = await post('/api/setup').send(payload);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(res.body.recovery_codes.length, 3);
    assert.ok(fs.existsSync(CONFIG_FILE));
    assert.equal(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).SETUP_COMPLETE, true);
    const admin = DB.getUserByUsername ? await DB.getUserByUsername('admin') : null;
    if (admin) assert.equal(admin.role, 'admin');
    const branding = await DB.getKV('branding', {});
    assert.equal(branding.name, 'Testrestaurant');
});

test('Setup ist danach gesperrt', async () => {
    const res = await post('/api/setup').send(payload);
    assert.equal(res.status, 403);
});
