const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const CONFIG = require('./config.js');
const logger = require('./server/core/logger.js');
const DB = require('./server/db');
const { requireAuth: makeRequireAuth, requireLicense } = require('./server/core/middleware.js');
const { startCron } = require('./server/cron.js');
const LicenseChecker = require('./server/services/license-checker.js');
const { version: APP_VERSION } = require('./package.json');

const setupSocket = require('./server/socket.js');
const createApp = require('./server/app.js');

const PORT = CONFIG.PORT || 5000;
const PLUGINS_DIR = path.join(__dirname, 'plugins');

if (!CONFIG.SETUP_COMPLETE) {
    global._setupToken = crypto.randomBytes(16).toString('hex');
    require('./server/core/setup-token.js').writeSetupInfo(global._setupToken, CONFIG.PORT || 5000);
}
const requireAuth = makeRequireAuth(CONFIG.ADMIN_SECRET);

startCron();

// Reihenfolge ist wichtig: Express MUSS der Request-Handler des HTTP-Servers sein,
// BEVOR Socket.IO sich anhängt. Sonst registriert Engine.IO einen zweiten,
// konkurrierenden 'request'-Listener und der ausgelieferte Client (/socket.io/socket.io.js)
// kollidiert mit Express → leere Antwort / 502 hinter dem Proxy.
const io = setupSocket(null, DB, CONFIG); // io zunächst losgelöst erzeugen
const app = createApp(CONFIG, io);
const server = http.createServer(app); // Express ist der Basis-Request-Handler
io.attach(server); // Engine.IO übernimmt Express als Fallback-Listener

// Fehlgeschlagene Plugins global verfügbar machen (für /api/health)
global._failedPlugins = [];

async function start() {
    try {
        const enabledPlugins = await DB.getKV('plugins', []);
        enabledPlugins
            .filter((p) => p.enabled)
            .forEach((p) => {
                const safeId = path.basename(p.id);
                const resolvedPath = path.resolve(PLUGINS_DIR, safeId, 'server.js');
                if (!resolvedPath.startsWith(path.resolve(PLUGINS_DIR)))
                    return logger.warn(
                        { plugin: safeId },
                        'Plugin abgelehnt: Path Traversal erkannt'
                    );
                if (fs.existsSync(resolvedPath)) {
                    try {
                        logger.info({ plugin: safeId, path: resolvedPath }, 'Plugin geladen');
                        const plug = require(resolvedPath);
                        if (typeof plug === 'function')
                            plug(app, { DB, requireAuth, requireLicense });
                    } catch (e) {
                        logger.error({ err: e, plugin: safeId }, 'Plugin load failed');
                        global._failedPlugins.push({ id: safeId, error: e.message });
                    }
                }
            });
    } catch (e) {
        logger.warn({ err: e }, 'Plugin-Loader Fehler');
    }

    // SMTP-Konfigurationsprüfung beim Start
    try {
        const settings = await DB.getKV('settings', {});
        const smtp = settings?.smtp || {};
        if (!smtp.host && !process.env.SMTP_HOST) {
            logger.warn(
                'SMTP nicht konfiguriert – E-Mail-Versand (Reservierungserinnerungen, Bestätigungen) ist deaktiviert.'
            );
        }
    } catch (_) {}

    server.listen(PORT, () => {
        const allowedOrigins = (CONFIG.CORS_ORIGINS || process.env.CORS_ORIGINS || '')
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean);
        logger.info(
            {
                version: APP_VERSION,
                port: PORT,
                licenseServer: CONFIG.LICENSE_SERVER_URL,
                cors: allowedOrigins,
            },
            'Tafeline CMS gestartet'
        );

        if (!CONFIG.SETUP_COMPLETE && global._setupToken) {
            const border = '═'.repeat(60);
            console.log(`\n${border}`);
            console.log('  TAFELINE CMS – ERSTEINRICHTUNG ERFORDERLICH');
            console.log(border);
            console.log(`  Öffne:  http://localhost:${PORT}/setup`);
            console.log(`  Token:  ${global._setupToken}`);
            console.log(`  (auch in SETUP-INFO.txt im App-Verzeichnis)`);
            console.log(`${border}\n`);
        }

        _licenseChecker = new LicenseChecker(
            DB,
            CONFIG.LICENSE_SERVER_URL,
            process.env.HOST || require('os').hostname()
        );
        _licenseChecker.start();
    });
}

let _licenseChecker = null;

function shutdown(signal) {
    logger.info({ signal }, 'Shutdown eingeleitet...');
    if (_licenseChecker) _licenseChecker.stop();
    server.close(() => {
        logger.info('Server gestoppt.');
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((e) => {
    logger.fatal({ err: e }, 'Server-Start fehlgeschlagen');
    process.exit(1);
});
