/**
 * Zentraler Logger – pino
 * Verwendung: const logger = require('./logger');
 *
 * Im Produktionsbetrieb: JSON-Output (strukturiert, maschinenlesbar)
 * Im Entwicklungsmodus:  via "npm run dev" wird pino-pretty verwendet
 */
const pino = require('pino');

const isDev = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development';

const logger = pino({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    base: { pid: process.pid, app: 'Tafeline CMS' },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Sensible Felder aus Logs herausfiltern
    redact: {
        paths: [
            'req.headers["x-admin-token"]',
            'body.pass',
            'body.password',
            'body.adminPass',
            'body.smtp.pass',
        ],
        censor: '[REDACTED]',
    },
});

module.exports = logger;
