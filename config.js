/**
 * Tafeline CMS GLOBAL CONFIGURATION
 * Priorität: config.json (Setup-Wizard) > .env > Defaults
 *
 * SECURITY:
 *  - SEC-04: Server-Start wird verweigert wenn ADMIN_SECRET nicht gesetzt
 *            oder noch der unsichere Default-Wert verwendet wird.
 */

const fs = require('fs');
const path = require('path');

try {
    require('dotenv').config();
} catch (e) {}

let CONFIG_PATH = path.join(__dirname, 'server', 'config.json');
if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(path.join(__dirname, 'config.json'))) {
    CONFIG_PATH = path.join(__dirname, 'config.json');
}

const INSECURE_SECRET_DEFAULT = 'change-me-before-production';

const DEFAULT_CONFIG = {
    LICENSE_SERVER_URL: process.env.LICENSE_SERVER_URL || 'https://licens-prod.stb-srv.de',
    PORT: parseInt(process.env.PORT) || 5000,
    ADMIN_SECRET: process.env.ADMIN_SECRET || INSECURE_SECRET_DEFAULT,
    DEV_MODE: process.env.DEV_MODE === 'true',
    DB_TYPE: process.env.DB_TYPE || 'sqlite',
    BACKUP_DIR: process.env.BACKUP_DIR || path.join(__dirname, 'backups'),
    BACKUP_MAX_AGE_DAYS: parseInt(process.env.BACKUP_MAX_AGE_DAYS) || 30,
    BACKUP_MIN_COUNT: parseInt(process.env.BACKUP_MIN_COUNT) || 7,
    SMTP: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_SECURE !== 'false',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || '',
    },
    SETUP_COMPLETE: false,
};

let CONFIG = { ...DEFAULT_CONFIG };

if (fs.existsSync(CONFIG_PATH)) {
    try {
        const fileContent = fs.readFileSync(CONFIG_PATH, 'utf8');
        const loadedConfig = JSON.parse(fileContent);

        // SMTP aus config.json (Setup-Wizard) hat Vorrang vor .env
        const mergedSmtp = { ...DEFAULT_CONFIG.SMTP };
        if (loadedConfig.SMTP) {
            Object.keys(loadedConfig.SMTP).forEach((key) => {
                if (loadedConfig.SMTP[key] !== undefined && loadedConfig.SMTP[key] !== '') {
                    mergedSmtp[key] = loadedConfig.SMTP[key];
                }
            });
        }

        CONFIG = {
            ...DEFAULT_CONFIG,
            ...loadedConfig,
            SMTP: mergedSmtp,
            SETUP_COMPLETE: true,
        };

        if (!loadedConfig.LICENSE_SERVER_URL) {
            CONFIG.LICENSE_SERVER_URL =
                process.env.LICENSE_SERVER_URL || 'https://licens-prod.stb-srv.de';
        }
        // PORT & ADMIN_SECRET aus .env haben Vorrang (Security: nie in config.json überschreiben)
        if (process.env.PORT) CONFIG.PORT = parseInt(process.env.PORT);
        if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET !== INSECURE_SECRET_DEFAULT) {
            CONFIG.ADMIN_SECRET = process.env.ADMIN_SECRET;
        }
    } catch (e) {
        console.error('❌ Error loading config.json, using defaults:', e);
    }
}

// SEC-04: Kritische Sicherheitsprüfung – Server-Start verweigern bei unsicherem Secret
if (!CONFIG.ADMIN_SECRET || CONFIG.ADMIN_SECRET === INSECURE_SECRET_DEFAULT) {
    if (CONFIG.SETUP_COMPLETE) {
        // Nach Setup ist kein unsicheres Secret tolerierbar – harter Abbruch
        console.error('\n❌❌❌ KRITISCHER SICHERHEITSFEHLER ❌❌❌');
        console.error('ADMIN_SECRET ist nicht gesetzt oder verwendet den unsicheren Default-Wert.');
        console.error('Der Server wird NICHT gestartet.');
        console.error(
            'Bitte ADMIN_SECRET in der .env Datei auf einen langen zufälligen String setzen.'
        );
        console.error(
            "Beispiel: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
        console.error('');
        process.exit(1);
    } else {
        // Vor dem Setup: Warnung genügt (Setup-Wizard setzt das Secret)
        console.warn(
            '⚠⚠⚠  WARNING: ADMIN_SECRET ist nicht gesetzt! Bitte Setup-Wizard ausführen oder ADMIN_SECRET in .env setzen.'
        );
    }
}

module.exports = CONFIG;
