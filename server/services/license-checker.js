/**
 * Tafeline CMS – License Checker (Stufe 3: Periodische Online-Validierung)
 *
 * Beim Start wird zuerst der RSA Public Key vom Lizenzserver abgerufen
 * (via initPublicKey), danach erst die Token-Prüfung gestartet.
 */

const { verifyLicenseToken, initPublicKey, initPlans } = require('./license.js');
const logger = require('../core/logger.js');
const { getLicenseServerUrl } = require('../core/license-server.js');

const CHECK_INTERVAL_MS = 72 * 60 * 60 * 1000; // 72h
const STARTUP_DELAY_MS = 5 * 1000; // 5s nach Boot
const TOKEN_REFRESH_THRESHOLD_H = 60; // Token-Gültigkeit ist 80h → Refresh wenn <60h übrig
const MAX_FAILURES = 3;

class LicenseChecker {
    constructor(DB, _licenseServerUrl, host) {
        this.DB = DB;
        this.licenseServerUrl = getLicenseServerUrl();
        this.host = host || 'localhost';
        this.failCount = 0;
        this.timer = null;
        this.startupTimer = null;
        this.degraded = false;
    }

    start() {
        this.startupTimer = setTimeout(async () => {
            // 1. Public Key + Plan-Definitionen vom Lizenzserver laden
            await Promise.all([initPublicKey(), initPlans()]);
            // 2. Token-Prüfung
            await this._checkIfTokenNeedsRefresh();
            // 3. Periodischer Check
            this.timer = setInterval(() => this._check(), CHECK_INTERVAL_MS);
        }, STARTUP_DELAY_MS);
        logger.info(
            `🔒 LicenseChecker gestartet – Public Key-Abruf + Startup-Check in 5s, dann alle 72h.`
        );
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        if (this.startupTimer) clearTimeout(this.startupTimer);
    }

    async _checkIfTokenNeedsRefresh() {
        try {
            const settings = await this.DB.getKV('settings', {});
            const lic = settings.license || {};

            if (!lic.key || lic.isTrial) return;

            const token = lic.licenseToken || null;
            const payload = token ? verifyLicenseToken(token, this.host) : null;

            if (!payload) {
                logger.info(`🔄 [Startup] Kein gültiges Token gefunden – sofortiger Refresh...`);
                await this._check();
                return;
            }

            const nowSec = Math.floor(Date.now() / 1000);
            const hoursLeft = ((payload.exp || 0) - nowSec) / 3600;

            if (hoursLeft < TOKEN_REFRESH_THRESHOLD_H) {
                logger.info(
                    `🔄 [Startup] Token läuft in ${hoursLeft.toFixed(1)}h ab – sofortiger Refresh...`
                );
                await this._check();
            } else {
                logger.info(
                    `✅ [Startup] Token noch ${hoursLeft.toFixed(1)}h gültig – kein sofortiger Refresh nötig.`
                );
            }
        } catch (e) {
            logger.warn(
                `⚠️  [Startup] Token-Prüfung fehlgeschlagen: ${e.message} – starte normalen Check...`
            );
            await this._check();
        }
    }

    async _check() {
        const settings = await this.DB.getKV('settings', {});
        const lic = settings.license || {};

        if (!lic.key || lic.isTrial) return;

        logger.info(`🔄 [${new Date().toISOString()}] Lizenz-Online-Check läuft...`);

        try {
            const response = await fetch(`${this.licenseServerUrl}/api/v1/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ license_key: lic.key, domain: this.host }),
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const rawToken = data.token || data.license_token || null;

            if (data.status === 'active' && rawToken) {
                const payload = verifyLicenseToken(rawToken, this.host);
                if (!payload) throw new Error('Server returned token with invalid signature');

                settings.license.licenseToken = rawToken;
                settings.license.lastKnownType = payload.type;
                settings.license.lastKnownModules =
                    payload.allowed_modules && Object.keys(payload.allowed_modules).length > 0
                        ? payload.allowed_modules
                        : null;
                settings.license.lastKnownLimits = payload.limits || null;
                settings.license.lastKnownAt = new Date().toISOString();
                delete settings.license.degraded;
                delete settings.license.degradedReason;
                delete settings.license.degradedAt;
                await this.DB.setKV('settings', settings);

                this.failCount = 0;
                this.degraded = false;
                logger.info(
                    `✅ [${new Date().toISOString()}] Lizenz-Token erfolgreich erneuert (Plan: ${payload.type}, Domain: ${payload.domain}).`
                );
            } else if (data.status === 'revoked' || data.status === 'cancelled') {
                logger.warn(
                    `⚠️  Lizenz wurde vom Server widerrufen (${data.status}). Degradiere auf FREE.`
                );
                await this._degrade(settings, 'revoked');
            } else {
                throw new Error(`Unerwartete Serverantwort: ${JSON.stringify(data)}`);
            }
        } catch (e) {
            this.failCount++;
            logger.warn(
                `⚠️  [${new Date().toISOString()}] Lizenz-Check Fehler (${this.failCount}/${MAX_FAILURES}): ${e.message}`
            );
            if (this.failCount >= MAX_FAILURES) {
                logger.warn(
                    `⚠️  Lizenz-Check ${MAX_FAILURES}x fehlgeschlagen – Offline-Fallback aktiv.`
                );
                await this._setOfflineFallback(settings);
            }
        }
    }

    async _setOfflineFallback(settings) {
        this.degraded = true;
        if (settings.license) {
            settings.license.degraded = true;
            settings.license.degradedReason = 'unreachable';
            settings.license.degradedAt = new Date().toISOString();
            await this.DB.setKV('settings', settings);
        }
    }

    async _degrade(settings, reason) {
        this.degraded = true;
        if (settings.license) {
            settings.license.degraded = true;
            settings.license.degradedReason = reason;
            settings.license.degradedAt = new Date().toISOString();
            delete settings.license.licenseToken;
            await this.DB.setKV('settings', settings);
        }
    }

    isDegraded() {
        return this.degraded;
    }
}

module.exports = LicenseChecker;
