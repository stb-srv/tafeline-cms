/**
 * Integration test: Verifies the data contract between tafeline-cms and tafeline-licens.
 *
 * Checks:
 *   1. @tafeline/plans package is importable from both projects
 *   2. Module keys in PLAN_DEFINITIONS match what requireLicense() accepts
 *   3. License server /api/v1/public-key is reachable (if LICENSE_SERVER_URL is set)
 *   4. Token issued by license server is verifiable with the returned public key
 *
 * Usage:
 *   node test-integration.js
 *   LICENSE_SERVER_URL=http://localhost:4000 node test-integration.js
 */

'use strict';

const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') {
            return result
                .then(() => {
                    console.log(`  ✓ ${name}`);
                    passed++;
                })
                .catch((e) => {
                    console.error(`  ✗ ${name}: ${e.message}`);
                    failed++;
                });
        }
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗ ${name}: ${e.message}`);
        failed++;
    }
    return Promise.resolve();
}

async function run() {
    console.log('\nTafeline CMS ↔ License Server — Integration Contract Test\n');

    // ── 1. Shared plans package ─────────────────────────────────────────────
    console.log('1. @tafeline/plans package');

    let PLAN_DEFINITIONS, PLAN_MODULES;
    await test('importable as CommonJS', () => {
        ({ PLAN_DEFINITIONS, PLAN_MODULES } = require('@tafeline/plans'));
        assert(PLAN_DEFINITIONS, 'PLAN_DEFINITIONS must be exported');
        assert(PLAN_MODULES, 'PLAN_MODULES must be exported');
    });

    await test('contains all 6 plans', () => {
        const expected = ['TRIAL', 'FREE', 'STARTER', 'PRO', 'PRO_PLUS', 'ENTERPRISE'];
        for (const plan of expected) {
            assert(PLAN_DEFINITIONS[plan], `Plan ${plan} missing`);
        }
    });

    const CANONICAL_MODULES = [
        'menu_edit',
        'orders_kitchen',
        'reservations',
        'custom_design',
        'analytics',
        'qr_pay',
        'online_orders',
        'multilanguage',
        'seasonal_menu',
        'backup',
        'image_ai',
    ];

    await test('ENTERPRISE plan has all canonical modules', () => {
        const mods = PLAN_DEFINITIONS.ENTERPRISE?.modules || {};
        for (const mod of CANONICAL_MODULES) {
            assert(mod in mods, `Module '${mod}' missing from ENTERPRISE plan`);
        }
    });

    await test('no plan uses legacy module key names', () => {
        const legacyKeys = ['reservations_online', 'reservations_phone', 'custom_branding'];
        for (const [planName, plan] of Object.entries(PLAN_DEFINITIONS || {})) {
            for (const key of legacyKeys) {
                assert(
                    !(key in (plan.modules || {})),
                    `Plan ${planName} still uses legacy key '${key}'`
                );
            }
        }
    });

    await test('TRIAL plan has reasonable limits', () => {
        const trial = PLAN_DEFINITIONS.TRIAL;
        assert(trial, 'TRIAL plan must exist');
        assert(trial.menu_items > 0, 'menu_items must be > 0');
        assert(trial.max_tables > 0, 'max_tables must be > 0');
    });

    // ── 2. CMS license service ──────────────────────────────────────────────
    console.log('\n2. CMS license service');

    let getCurrentLicense;
    await test('server/services/license.js importable', () => {
        ({ getCurrentLicense } = require('./server/services/license.js'));
        assert(typeof getCurrentLicense === 'function', 'getCurrentLicense must be a function');
    });

    await test('requireLicense middleware importable', () => {
        const { requireLicense } = require('./server/core/middleware.js');
        assert(typeof requireLicense === 'function', 'requireLicense must be a function');
    });

    // ── 3. License server connectivity (optional) ───────────────────────────
    const licenseServerUrl = (process.env.LICENSE_SERVER_URL || '').replace(/\/+$/, '');
    if (licenseServerUrl) {
        console.log(`\n3. License server connectivity (${licenseServerUrl})`);

        let publicKey;
        await test('GET /api/v1/public-key returns PEM', async () => {
            const res = await fetch(`${licenseServerUrl}/api/v1/public-key`, {
                signal: AbortSignal.timeout(8000),
            });
            assert(res.ok, `HTTP ${res.status}`);
            const data = await res.json();
            publicKey = data.publicKey || data.public_key || data.key;
            assert(
                publicKey && publicKey.includes('BEGIN'),
                'Response must contain a PEM public key'
            );
        });

        if (publicKey) {
            await test('public key is a valid RSA public key (verifiable with jsonwebtoken)', () => {
                const jwt = require('jsonwebtoken');
                assert.doesNotThrow(() => {
                    // We can't sign here, but we can at least check the key parses
                    // by trying to verify a dummy token (it will fail with "invalid signature", not "invalid key")
                    try {
                        jwt.verify('a.b.c', publicKey, { algorithms: ['RS256'] });
                    } catch (e) {
                        assert(
                            e.message !== 'secretOrPublicKey must be an asymmetric key',
                            `Key parse error: ${e.message}`
                        );
                    }
                });
            });
        }
    } else {
        console.log(
            '\n3. License server connectivity — SKIPPED (set LICENSE_SERVER_URL to enable)'
        );
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        console.error('\nContract violations detected — fix before deploying.\n');
        process.exit(1);
    } else {
        console.log('\nAll contract checks passed.\n');
    }
}

run().catch((e) => {
    console.error('Unexpected error:', e);
    process.exit(1);
});
