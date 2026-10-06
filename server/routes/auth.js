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
const {
    loginSchema,
    forgotPasswordSchema,
    changePasswordSchema,
} = require('../validation/schemas.js');

module.exports = (ADMIN_SECRET) => {
    const requireAuth = makeRequireAuth(ADMIN_SECRET);

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
