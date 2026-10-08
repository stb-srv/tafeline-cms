/**
 * Fest hinterlegter Lizenzserver.
 *
 * Der Lizenzserver wird ausschließlich vom Betreiber (stb-srv) betrieben. Die URL ist
 * bewusst eine Konstante im Code und weder über config.json, Setup-Wizard,
 * Admin-Einstellungen noch .env änderbar – sonst ließe sich die Lizenzverwaltung umgehen.
 *
 * Einzige Ausnahme: Entwicklung (NODE_ENV=development) darf per LICENSE_SERVER_URL
 * auf einen lokalen Lizenzserver zeigen.
 */
const LICENSE_SERVER_URL = 'https://licens.stb-srv.de';

const isDevelopment = () => process.env.NODE_ENV === 'development';

const getLicenseServerUrl = () => {
    if (isDevelopment() && process.env.LICENSE_SERVER_URL) {
        return process.env.LICENSE_SERVER_URL.trim().replace(/\/+$/, '');
    }
    return LICENSE_SERVER_URL;
};

module.exports = { LICENSE_SERVER_URL, getLicenseServerUrl, isDevelopment };
