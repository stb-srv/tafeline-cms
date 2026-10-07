const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const modPath = path.join(__dirname, '..', 'server', 'core', 'license-server.js');
const withEnv = (env, fn) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try {
        return fn(require(modPath));
    } finally {
        process.env = saved;
    }
};

test('Lizenzserver ist fest hinterlegt, .env-Override wird in Produktion ignoriert', () => {
    withEnv({ NODE_ENV: 'production', LICENSE_SERVER_URL: 'http://evil.example' }, (m) => {
        assert.strictEqual(m.getLicenseServerUrl(), 'https://licens.stb-srv.de');
    });
});

test('Entwicklungs-Override nur bei NODE_ENV=development', () => {
    withEnv({ NODE_ENV: 'development', LICENSE_SERVER_URL: 'http://localhost:4000/' }, (m) => {
        assert.strictEqual(m.getLicenseServerUrl(), 'http://localhost:4000');
    });
});
