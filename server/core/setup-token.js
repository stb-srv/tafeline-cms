/**
 * Setup-Token: einmaliges Token für die Ersteinrichtung (Setup-Wizard).
 * Wird zusätzlich in SETUP-INFO.txt (Modus 600) geschrieben, damit es nach dem
 * Installationsskript leicht auffindbar ist (`sudo bash setup.sh --show-token`).
 * Die Datei enthält ein kurzlebiges Einmal-Token und wird nach dem Setup gelöscht.
 */
const fs = require('fs');
const path = require('path');

const INFO_FILE = path.join(__dirname, '..', '..', 'SETUP-INFO.txt');

const writeSetupInfo = (token, port) => {
    const body = [
        'Tafeline CMS – Ersteinrichtung',
        '',
        `Setup-URL:   http://<deine-domain-oder-ip>/setup   (lokal: http://localhost:${port}/setup)`,
        `Setup-Token: ${token}`,
        '',
        'Das Token gilt bis zum nächsten Neustart des Services und wird nach der',
        'Ersteinrichtung automatisch gelöscht. Wieder anzeigen: sudo bash setup.sh --show-token',
        '',
    ].join('\n');
    try {
        fs.writeFileSync(INFO_FILE, body, { mode: 0o600 });
        fs.chmodSync(INFO_FILE, 0o600);
    } catch (_) {
        // Nicht kritisch – das Token steht weiterhin in der Konsole/im Journal
    }
};

const clearSetupInfo = () => {
    try {
        fs.rmSync(INFO_FILE, { force: true });
    } catch (_) {}
};

module.exports = { INFO_FILE, writeSetupInfo, clearSetupInfo };
