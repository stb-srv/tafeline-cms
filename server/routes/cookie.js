/**
 * Tafeline CMS – Cookie Consent API
 * DSGVO Art. 7, ePrivacy-Richtlinie, EuGH Planet49
 *
 * Öffentliche Endpoints (keine Auth):
 *   GET  /api/cookie-config          → Aktive Kategorien für Banner
 *   POST /api/cookie-consent         → Consent-Eintrag speichern (Nachweis)
 *
 * Admin-Endpoints (requireAuth):
 *   GET  /api/cookie-config/admin    → Vollständige Config inkl. deaktivierter Kategorien
 *   POST /api/cookie-config/admin    → Config speichern
 *   GET  /api/cookie-consent/log     → Consent-Log abrufen
 *   DELETE /api/cookie-consent/log   → Log leeren
 *   POST /api/cookie-consent/recons  → Re-Consent-Trigger (erhöht Version)
 */

const router = require('express').Router();
const crypto = require('crypto');
const DB = require('../db');
const logger = require('../core/logger.js');

// Standard-Config – wird beim ersten Aufruf in DB gespeichert
const DEFAULT_CONFIG = {
    version: '1.0',
    privacy_url: '/datenschutz',
    banner_text:
        'Wir setzen Cookies und ähnliche Technologien ein. ' +
        'Technisch notwendige Cookies gewährleisten die Grundfunktionen der Website. ' +
        'Mit Ihrer Einwilligung aktivieren wir optionale Cookies für Funktionen, ' +
        'Analyse und externe Dienste (z.B. Google Maps). ' +
        'Sie können Ihre Einwilligung jederzeit widerrufen.',
    categories: {
        necessary: {
            id: 'necessary',
            label: 'Technisch notwendig',
            description:
                'Diese Cookies sind für den Betrieb der Website zwingend erforderlich und können nicht deaktiviert werden.',
            required: true,
            enabled: true,
            cookies: [
                {
                    name: 'tafeline_consent',
                    purpose: 'Speichert Ihre Cookie-Einstellungen',
                    duration: '12 Monate',
                    provider: 'Tafeline CMS',
                },
            ],
        },
        functional: {
            id: 'functional',
            label: 'Funktional',
            description:
                'Diese Cookies ermöglichen erweiterte Funktionen wie gespeicherte Spracheinstellungen oder Tischpräferenzen.',
            required: false,
            enabled: true,
            cookies: [
                {
                    name: 'tafeline_lang',
                    purpose: 'Gespeicherte Spracheinstellung',
                    duration: '12 Monate',
                    provider: 'Tafeline CMS',
                },
            ],
        },
        analytics: {
            id: 'analytics',
            label: 'Analyse',
            description:
                'Helfen uns zu verstehen, wie Besucher mit der Website interagieren, um sie zu verbessern. Keine personenbezogenen Daten.',
            required: false,
            enabled: false,
            cookies: [],
        },
        marketing: {
            id: 'marketing',
            label: 'Marketing & Externe Medien',
            description:
                'Werden von externen Diensten wie Google Maps benötigt. ' +
                'Bei Aktivierung werden Daten (inkl. IP-Adresse) an Google LLC (USA) übertragen. ' +
                'Grundlage: Einwilligung gem. DSGVO Art. 6 Abs. 1 lit. a i.V.m. Art. 49 Abs. 1 lit. a (Drittlandtransfer).',
            required: false,
            enabled: false,
            cookies: [
                {
                    name: 'NID, 1P_JAR, CONSENT',
                    purpose: 'Google Maps Kartendarstellung und Standortdienste',
                    duration: '6 Monate – 2 Jahre',
                    provider: 'Google LLC, USA (Datenschutz: https://policies.google.com/privacy)',
                },
            ],
        },
    },
};

const MAX_LOG_ENTRIES = 5000;
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000; // DSGVO Art. 5 Abs. 1e – Speicherbegrenzung

function getClientIp(req) {
    return (
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'unknown'
    );
}

function hashValue(val) {
    return crypto.createHash('sha256').update(String(val)).digest('hex').slice(0, 16);
}

// ── Öffentlich: Config abrufen ──────────────────────────────────────────────
router.get('/cookie-config', async (req, res) => {
    try {
        let config = await DB.getKV('cookie_config', null);
        if (!config) {
            config = DEFAULT_CONFIG;
            await DB.setKV('cookie_config', config);
        }
        // Nur aktivierte Kategorien zurückgeben + keine internen Felder
        const publicCategories = {};
        for (const [id, cat] of Object.entries(config.categories || {})) {
            if (cat.enabled !== false) {
                publicCategories[id] = {
                    id: cat.id,
                    label: cat.label,
                    description: cat.description,
                    required: cat.required || false,
                    cookies: (cat.cookies || []).map((c) => ({
                        name: c.name,
                        purpose: c.purpose,
                        duration: c.duration,
                        provider: c.provider,
                    })),
                };
            }
        }
        res.json({
            version: config.version,
            banner_text: config.banner_text,
            privacy_url: config.privacy_url,
            categories: publicCategories,
        });
    } catch (e) {
        logger.error({ err: e }, 'cookie-config error:');
        res.status(500).json({ success: false, reason: e.message });
    }
});

// ── Öffentlich: Consent speichern (Nachweis-Log) ────────────────────────────
router.post('/cookie-consent', async (req, res) => {
    try {
        const { choices, config_version, source } = req.body;
        if (!choices || typeof choices !== 'object') {
            return res.status(400).json({ success: false, reason: 'choices fehlt' });
        }

        const ip = getClientIp(req);
        const ua = req.headers['user-agent'] || '';
        const entry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            config_version: config_version || '1.0',
            ip_hash: hashValue(ip),
            ua_hash: hashValue(ua),
            choices,
            source: source || 'banner',
        };

        const log = await DB.getKV('consent_log', { entries: [] });
        log.entries.unshift(entry);
        // DSGVO Art. 5 Abs. 1e – Einträge älter als 3 Jahre automatisch löschen
        const now = Date.now();
        log.entries = log.entries.filter((e) => {
            const age = now - new Date(e.timestamp).getTime();
            return age < THREE_YEARS_MS;
        });
        // FIFO – max. MAX_LOG_ENTRIES behalten
        if (log.entries.length > MAX_LOG_ENTRIES) {
            log.entries = log.entries.slice(0, MAX_LOG_ENTRIES);
        }
        await DB.setKV('consent_log', log);
        res.json({ success: true, id: entry.id });
    } catch (e) {
        logger.error({ err: e }, 'cookie-consent log error:');
        res.status(500).json({ success: false, reason: e.message });
    }
});

// ── Admin: Vollständige Config abrufen ──────────────────────────────────────
module.exports = (requireAuth) => {
    router.get('/cookie-config/admin', requireAuth, async (req, res) => {
        try {
            let config = await DB.getKV('cookie_config', null);
            if (!config) {
                config = DEFAULT_CONFIG;
                await DB.setKV('cookie_config', config);
            }
            res.json(config);
        } catch (e) {
            res.status(500).json({ success: false, reason: e.message });
        }
    });

    // ── Admin: Config speichern ─────────────────────────────────────────────
    router.post('/cookie-config/admin', requireAuth, async (req, res) => {
        try {
            const incoming = req.body;
            if (!incoming || !incoming.categories) {
                return res.status(400).json({ success: false, reason: 'Ungültige Config-Daten.' });
            }
            // necessary.required darf nie false sein
            if (incoming.categories.necessary) {
                incoming.categories.necessary.required = true;
                incoming.categories.necessary.enabled = true;
            }
            await DB.setKV('cookie_config', incoming);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ success: false, reason: e.message });
        }
    });

    // ── Admin: Re-Consent auslösen (Version erhöhen) ────────────────────────
    router.post('/cookie-consent/recons', requireAuth, async (req, res) => {
        try {
            const config = await DB.getKV('cookie_config', DEFAULT_CONFIG);
            const parts = (config.version || '1.0').split('.');
            parts[1] = String((parseInt(parts[1]) || 0) + 1);
            config.version = parts.join('.');
            await DB.setKV('cookie_config', config);
            res.json({
                success: true,
                new_version: config.version,
                message: 'Alle Besucher werden beim nächsten Aufruf erneut gefragt.',
            });
        } catch (e) {
            res.status(500).json({ success: false, reason: e.message });
        }
    });

    // ── Admin: Consent-Log abrufen ──────────────────────────────────────────
    router.get('/cookie-consent/log', requireAuth, async (req, res) => {
        try {
            const log = await DB.getKV('consent_log', { entries: [] });
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const start = (page - 1) * limit;
            const slice = log.entries.slice(start, start + limit);
            res.json({
                total: log.entries.length,
                page,
                limit,
                entries: slice,
            });
        } catch (e) {
            res.status(500).json({ success: false, reason: e.message });
        }
    });

    // ── Admin: Consent-Log leeren ───────────────────────────────────────────
    router.delete('/cookie-consent/log', requireAuth, async (req, res) => {
        try {
            await DB.setKV('consent_log', { entries: [] });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ success: false, reason: e.message });
        }
    });

    return router;
};
