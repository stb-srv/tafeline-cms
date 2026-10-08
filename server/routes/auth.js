/**
 * Routes – Authentication
 *
 * SECURITY:
 *  - SEC-07: Passwort-Mindestlänge 12 Zeichen
 *  - BUG-04: Timing-sicherer Token-Vergleich via crypto.timingSafeEqual()
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const DB = require('../db');
const Mailer = require('../services/mailer.js');
const {
    loginLimiter,
    forgotPasswordLimiter,
    requireAuth: makeRequireAuth,
} = require('../core/middleware.js');
const logger = require('../core/logger.js');
const validate = require('../validation/validate.js');
const Totp = require('../services/totp.js');
const {
    loginSchema,
    forgotPasswordSchema,
    changePasswordSchema,
} = require('../validation/schemas.js');

module.exports = (ADMIN_SECRET) => {
    const requireAuth = makeRequireAuth(ADMIN_SECRET);
    // Eigenes Secret für den Zwischenschritt, damit ein tempToken nie als Session taugt.
    const TEMP_SECRET = `${ADMIN_SECRET}:2fa-login`;

    router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
        try {
            const { user, pass } = req.body;
            const users = await DB.getUsers();
            const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuVGqzxVBBTvbPW8YtaRCfcHPp8yQb5au';
            const u = (users || []).find((x) => x.user === user);
            const hashToCompare = u?.pass || DUMMY_HASH;

            let isValid = false;
            try {
                isValid = await bcrypt.compare(pass, hashToCompare);
            } catch (e) {
                isValid = false;
            }

            if (!u || !isValid) {
                return res
                    .status(401)
                    .json({ success: false, reason: 'Benutzername oder Passwort falsch.' });
            }

            const requirePasswordChange = !!u.require_password_change;
            if (DB.get2fa(u.user)?.enabled) {
                const tempToken = jwt.sign({ user: u.user, purpose: '2fa' }, TEMP_SECRET, {
                    expiresIn: '5m',
                });
                return res.json({ success: true, twoFactorRequired: true, tempToken });
            }
            const token = jwt.sign(
                { user: u.user, role: u.role, requirePasswordChange },
                ADMIN_SECRET,
                { expiresIn: '12h' }
            );
            return res.json({
                success: true,
                token,
                user: { ...u, pass: undefined },
                requirePasswordChange,
            });
        } catch (e) {
            res.status(500).json({ success: false, reason: e.message });
        }
    });

    // ── Zwei-Faktor-Anmeldung (TOTP) ─────────────────────────────────────────
    router.post('/login/2fa', loginLimiter, async (req, res) => {
        try {
            const { tempToken, code } = req.body || {};
            let payload;
            try {
                payload = jwt.verify(String(tempToken || ''), TEMP_SECRET);
            } catch {
                return res.status(401).json({
                    success: false,
                    reason: 'Anmeldung abgelaufen. Bitte erneut anmelden.',
                });
            }
            if (payload.purpose !== '2fa')
                return res.status(401).json({ success: false, reason: 'Ungültiges Token.' });
            const rec = DB.get2fa(payload.user);
            const u = (await DB.getUsers()).find((x) => x.user === payload.user);
            if (!u || !rec?.enabled || !Totp.verifyCode(code, rec.secret))
                return res.status(401).json({ success: false, reason: 'Code ungültig.' });
            const requirePasswordChange = !!u.require_password_change;
            const token = jwt.sign(
                { user: u.user, role: u.role, requirePasswordChange },
                ADMIN_SECRET,
                { expiresIn: '12h' }
            );
            res.json({
                success: true,
                token,
                user: { ...u, pass: undefined },
                requirePasswordChange,
            });
        } catch (e) {
            logger.error({ err: e }, '2FA-Login Fehler');
            res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
        }
    });

    router.get('/2fa/status', requireAuth, (req, res) => {
        res.json({ success: true, enabled: !!DB.get2fa(req.admin.user)?.enabled });
    });

    // Neues Secret erzeugen (noch nicht aktiv, bis /2fa/enable mit gültigem Code bestätigt)
    router.post('/2fa/setup', requireAuth, async (req, res) => {
        try {
            if (DB.get2fa(req.admin.user)?.enabled)
                return res.status(400).json({ success: false, reason: '2FA ist bereits aktiv.' });
            const secret = Totp.newSecret();
            DB.set2faSecret(req.admin.user, secret);
            res.json({ success: true, secret, qr: await Totp.qrDataUrl(req.admin.user, secret) });
        } catch (e) {
            logger.error({ err: e }, '2FA-Setup Fehler');
            res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
        }
    });

    router.post('/2fa/enable', requireAuth, loginLimiter, (req, res) => {
        const rec = DB.get2fa(req.admin.user);
        if (!rec) return res.status(400).json({ success: false, reason: 'Zuerst 2FA einrichten.' });
        if (!Totp.verifyCode(req.body?.code, rec.secret))
            return res.status(400).json({ success: false, reason: 'Code ungültig.' });
        DB.enable2fa(req.admin.user);
        logger.info({ user: req.admin.user }, '2FA aktiviert');
        res.json({ success: true });
    });

    // Eigenes 2FA ausschalten: Passwort und aktueller Code nötig
    router.post('/2fa/disable', requireAuth, loginLimiter, async (req, res) => {
        try {
            const { pass, code } = req.body || {};
            const rec = DB.get2fa(req.admin.user);
            const u = (await DB.getUsers()).find((x) => x.user === req.admin.user);
            const passOk = u && (await bcrypt.compare(String(pass || ''), u.pass));
            if (!rec || !passOk || !Totp.verifyCode(code, rec.secret))
                return res
                    .status(400)
                    .json({ success: false, reason: 'Passwort oder Code ungültig.' });
            DB.delete2fa(req.admin.user);
            logger.info({ user: req.admin.user }, '2FA deaktiviert');
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ success: false, reason: 'Interner Serverfehler.' });
        }
    });

    // Notfall: Admin setzt 2FA eines anderen Kontos zurück (z. B. Handy verloren)
    router.delete('/2fa/:user', requireAuth, (req, res) => {
        if (req.admin.role !== 'admin')
            return res.status(403).json({ success: false, reason: 'Nur für Admins.' });
        if (req.params.user === req.admin.user)
            return res.status(400).json({
                success: false,
                reason: 'Eigenes 2FA bitte mit Passwort und Code deaktivieren.',
            });
        DB.delete2fa(req.params.user);
        logger.info({ user: req.params.user, by: req.admin.user }, '2FA zurückgesetzt');
        res.json({ success: true });
    });

    router.post(
        '/forgot-password',
        forgotPasswordLimiter,
        validate(forgotPasswordSchema),
        async (req, res) => {
            try {
                const { user } = req.body;
                const users = await DB.getUsers();
                const u = (users || []).find((x) => x.user === user);
                if (!u || !u.email) {
                    return res.json({
                        success: true,
                        message:
                            'Falls ein Konto mit diesem Benutzernamen und einer hinterlegten E-Mail existiert, wird eine E-Mail versendet.',
                    });
                }
                // Temporäres Passwort mit höherer Entropie (24 Zeichen)
                const plainPass = crypto.randomBytes(12).toString('hex');
                const hashed = await bcrypt.hash(plainPass, 12);

                // Setzt Passwort und markiert require_password_change = 1
                await DB.setUserPass(u.user, hashed, true);
                await Mailer.sendUserCredentials(u.email, u.name || u.user, u.user, plainPass, DB);

                logger.info(
                    { user: u.user },
                    'Temporäres Passwort versendet. Passwort-Änderung beim nächsten Login ist obligatorisch.'
                );
                res.json({
                    success: true,
                    message:
                        'Falls ein Konto mit diesem Benutzernamen und einer hinterlegten E-Mail existiert, wird eine E-Mail versendet.',
                });
            } catch (e) {
                logger.error({ err: e }, 'Forgot-password Mailer-Fehler');
                res.status(500).json({
                    success: false,
                    reason: 'E-Mail konnte nicht gesendet werden. Bitte SMTP-Konfiguration prüfen.',
                });
            }
        }
    );

    router.post(
        '/change-password',
        requireAuth,
        validate(changePasswordSchema),
        async (req, res) => {
            try {
                const { newPassword } = req.body;
                // SEC-07: Mindestlänge 12 Zeichen (statt zuvor 6)
                if (!newPassword || newPassword.length < 12)
                    return res
                        .status(400)
                        .json({ success: false, reason: 'Passwort zu kurz (min. 12 Zeichen).' });
                const hashed = await bcrypt.hash(newPassword, 12);
                await DB.setUserPass(req.admin.user, hashed, false);
                const token = jwt.sign(
                    { user: req.admin.user, role: req.admin.role, requirePasswordChange: false },
                    ADMIN_SECRET,
                    { expiresIn: '12h' }
                );
                res.json({ success: true, token });
            } catch (e) {
                res.status(500).json({ success: false, reason: e.message });
            }
        }
    );

    router.post('/refresh', requireAuth, (req, res) => {
        const token = jwt.sign(
            { user: req.admin.user, role: req.admin.role, requirePasswordChange: false },
            ADMIN_SECRET,
            { expiresIn: '12h' }
        );
        res.json({ success: true, token });
    });

    return router;
};
